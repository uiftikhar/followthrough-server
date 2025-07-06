import { Injectable, Logger } from '@nestjs/common';
import { google, drive_v3, calendar_v3 } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService } from '../../../integrations/google/services/google-oauth.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface GoogleMeetingSession {
  sessionId: string;
  meetingId: string;
  calendarEventId: string;
  userId: string;
  
  // Meeting details
  meetingDetails: {
    title: string;
    startTime: string;
    endTime: string;
    participants: string[];
    meetingUrl: string;
    conferenceId?: string;
  };
  
  // Recording tracking
  recordingStatus: 'not_started' | 'recording' | 'processing' | 'available' | 'failed';
  recordingDetails?: {
    driveFileId: string;
    fileName: string;
    fileSize: number;
    downloadUrl: string;
    transcriptFileId?: string;
    createdTime: string;
    permissions: string[];
  };
  
  // Transcript tracking
  transcriptStatus: 'not_available' | 'generating' | 'available' | 'failed';
  transcriptContent?: string;
  transcriptMetadata?: {
    language: string;
    confidence: number;
    speakers: number;
    duration: number;
  };
  
  // Lifecycle tracking
  status: 'scheduled' | 'starting' | 'active' | 'ended' | 'post_processing';
  timestamps: {
    created: string;
    started?: string;
    ended?: string;
    recordingAvailable?: string;
    transcriptAvailable?: string;
  };
  
  // Error handling
  errors: Array<{
    type: 'recording' | 'transcript' | 'permissions' | 'api';
    message: string;
    timestamp: string;
    retryable: boolean;
  }>;
  
  // Metadata
  retryCount: number;
  lastChecked: string;
  metadata: Record<string, any>;
}

export interface RecordingAvailabilityCheck {
  checkId: string;
  sessionId: string;
  checkCount: number;
  maxChecks: number;
  intervalMinutes: number;
  nextCheck: string;
  completed: boolean;
}

@Injectable()
export class EnhancedGoogleMeetingTrackerService {
  private readonly logger = new Logger(EnhancedGoogleMeetingTrackerService.name);
  
  // Active meeting sessions
  private readonly activeSessions = new Map<string, GoogleMeetingSession>();
  
  // Recording availability checks
  private readonly pendingChecks = new Map<string, RecordingAvailabilityCheck>();
  
  // Check intervals
  private readonly checkIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.startPeriodicCleanup();
  }

  /**
   * 🚀 Start tracking a Google Meet session
   */
  async trackMeetingStart(
    calendarEventId: string,
    userId: string,
    meetingDetails?: {
      title?: string;
      participants?: string[];
      startTime?: string;
      endTime?: string;
      meetingUrl?: string;
    }
  ): Promise<GoogleMeetingSession> {
    this.logger.log(`🎯 Starting meeting tracking for event ${calendarEventId}, user ${userId}`);

    try {
      // Generate session ID
      const sessionId = `session-${calendarEventId}-${Date.now()}`;
      
      // Get enhanced calendar event details if not provided
      const calendarEvent = await this.getCalendarEventDetails(userId, calendarEventId);
      
      // Extract Google Meet details
      const meetUrl = meetingDetails?.meetingUrl || 
                      calendarEvent?.hangoutLink || 
                      calendarEvent?.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ||
                      '';
      
      const conferenceId = this.extractConferenceId(meetUrl);
      
      // Create meeting session
      const session: GoogleMeetingSession = {
        sessionId,
        meetingId: conferenceId || calendarEventId,
        calendarEventId,
        userId,
        meetingDetails: {
          title: meetingDetails?.title || calendarEvent?.summary || 'Unknown Meeting',
          startTime: meetingDetails?.startTime || calendarEvent?.start?.dateTime || new Date().toISOString(),
          endTime: meetingDetails?.endTime || calendarEvent?.end?.dateTime || new Date(Date.now() + 60*60*1000).toISOString(),
          participants: meetingDetails?.participants || calendarEvent?.attendees?.map((a: any) => a.email) || [],
          meetingUrl: meetUrl,
          conferenceId: conferenceId || undefined
        },
        recordingStatus: 'not_started',
        transcriptStatus: 'not_available',
        status: 'starting',
        timestamps: {
          created: new Date().toISOString(),
          started: new Date().toISOString()
        },
        errors: [],
        retryCount: 0,
        lastChecked: new Date().toISOString(),
        metadata: {
          calendarEvent: calendarEvent,
          trackingStarted: new Date().toISOString()
        }
      };

      // Store active session
      this.activeSessions.set(sessionId, session);

      // Check for immediate recording availability (some meetings auto-record)
      setTimeout(() => this.checkRecordingAvailability(sessionId), 60000); // Check after 1 minute

      // Emit meeting started event
      this.eventEmitter.emit('google.meeting.started', {
        sessionId,
        calendarEventId,
        userId,
        meetingDetails: session.meetingDetails
      });

      this.logger.log(`✅ Meeting tracking started for session ${sessionId}`);
      return session;

    } catch (error) {
      this.logger.error(`❌ Error starting meeting tracking: ${error.message}`);
      throw new Error(`Failed to start meeting tracking: ${error.message}`);
    }
  }

  /**
   * 🏁 End tracking a Google Meet session
   */
  async trackMeetingEnd(
    calendarEventId: string,
    userId: string
  ): Promise<GoogleMeetingSession | null> {
    this.logger.log(`🏁 Ending meeting tracking for event ${calendarEventId}, user ${userId}`);

    try {
      // Find active session
      const session = Array.from(this.activeSessions.values()).find(
        s => s.calendarEventId === calendarEventId && s.userId === userId
      );

      if (!session) {
        this.logger.warn(`No active session found for event ${calendarEventId}`);
        return null;
      }

      // Update session status
      session.status = 'ended';
      session.timestamps.ended = new Date().toISOString();
      session.lastChecked = new Date().toISOString();

      // Start periodic recording availability checks
      await this.initiateRecordingChecks(session.sessionId);

      // Emit meeting ended event
      this.eventEmitter.emit('google.meeting.ended', {
        sessionId: session.sessionId,
        calendarEventId,
        userId,
        meetingDetails: session.meetingDetails,
        recordingStatus: session.recordingStatus
      });

      this.logger.log(`✅ Meeting tracking ended for session ${session.sessionId}`);
      return session;

    } catch (error) {
      this.logger.error(`❌ Error ending meeting tracking: ${error.message}`);
      throw new Error(`Failed to end meeting tracking: ${error.message}`);
    }
  }

  /**
   * 📹 Check for meeting recording availability
   */
  async checkRecordingAvailability(sessionId: string): Promise<GoogleMeetingSession | null> {
    this.logger.log(`📹 Checking recording availability for session ${sessionId}`);

    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.logger.warn(`Session ${sessionId} not found`);
        return null;
      }

      session.lastChecked = new Date().toISOString();

      // Search for recordings in Google Drive
      const recordings = await this.searchForMeetingRecordings(session.userId, session.meetingDetails);

      if (recordings.length > 0) {
        const recording = recordings[0]; // Get the most recent recording
        
        // Update session with recording details
        session.recordingStatus = 'available';
        session.recordingDetails = {
          driveFileId: recording.id!,
          fileName: recording.name!,
          fileSize: parseInt(recording.size || '0'),
          downloadUrl: recording.webViewLink!,
          createdTime: recording.createdTime!,
          permissions: recording.permissions?.map((p: any) => p.emailAddress).filter(Boolean) || []
        };
        session.timestamps.recordingAvailable = new Date().toISOString();

        // Check for transcript
        await this.checkTranscriptAvailability(sessionId);

        // Emit recording available event
        this.eventEmitter.emit('google.meeting.recording_available', {
          sessionId,
          calendarEventId: session.calendarEventId,
          userId: session.userId,
          recordingDetails: session.recordingDetails
        });

        this.logger.log(`📹 Recording found for session ${sessionId}: ${recording.name}`);
        return session;
      }

      // No recording found yet
      this.logger.log(`📹 No recording found yet for session ${sessionId}`);
      return session;

    } catch (error) {
      this.logger.error(`❌ Error checking recording availability: ${error.message}`);
      
      // Add error to session
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.errors.push({
          type: 'recording',
          message: error.message,
          timestamp: new Date().toISOString(),
          retryable: true
        });
        session.retryCount++;
      }
      
      return session || null;
    }
  }

  /**
   * 📝 Check for meeting transcript availability
   */
  async checkTranscriptAvailability(sessionId: string): Promise<GoogleMeetingSession | null> {
    this.logger.log(`📝 Checking transcript availability for session ${sessionId}`);

    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || !session.recordingDetails) {
        return null;
      }

      // Search for transcript files related to the meeting
      const transcripts = await this.searchForMeetingTranscripts(session.userId, session.meetingDetails);

      if (transcripts.length > 0) {
        const transcript = transcripts[0];
        
        // Download and extract transcript content
        const transcriptContent = await this.extractTranscriptContent(session.userId, transcript.id!);
        
        // Update session with transcript details
        session.transcriptStatus = 'available';
        session.transcriptContent = transcriptContent;
        session.transcriptMetadata = {
          language: 'en', // TODO: Detect language
          confidence: 0.85, // TODO: Calculate from transcript
          speakers: this.countSpeakers(transcriptContent),
          duration: this.estimateDuration(session.meetingDetails.startTime, session.meetingDetails.endTime)
        };
        session.timestamps.transcriptAvailable = new Date().toISOString();

        if (session.recordingDetails) {
          session.recordingDetails.transcriptFileId = transcript.id!;
        }

        // Emit transcript available event
        this.eventEmitter.emit('google.meeting.transcript_available', {
          sessionId,
          calendarEventId: session.calendarEventId,
          userId: session.userId,
          transcriptContent: session.transcriptContent,
          transcriptMetadata: session.transcriptMetadata
        });

        this.logger.log(`📝 Transcript found for session ${sessionId}`);
        return session;
      }

      this.logger.log(`📝 No transcript found yet for session ${sessionId}`);
      return session;

    } catch (error) {
      this.logger.error(`❌ Error checking transcript availability: ${error.message}`);
      
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.errors.push({
          type: 'transcript',
          message: error.message,
          timestamp: new Date().toISOString(),
          retryable: true
        });
      }
      
      return session || null;
    }
  }

  /**
   * 🔄 Initiate periodic recording availability checks
   */
  private async initiateRecordingChecks(sessionId: string): Promise<void> {
    this.logger.log(`🔄 Initiating periodic recording checks for session ${sessionId}`);

    const checkId = `check-${sessionId}-${Date.now()}`;
    const check: RecordingAvailabilityCheck = {
      checkId,
      sessionId,
      checkCount: 0,
      maxChecks: 12, // Check for 1 hour (12 checks * 5 minutes)
      intervalMinutes: 5,
      nextCheck: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Start checking in 5 minutes
      completed: false
    };

    this.pendingChecks.set(checkId, check);

    // Schedule first check
    const intervalId = setInterval(async () => {
      await this.performScheduledCheck(checkId);
    }, check.intervalMinutes * 60 * 1000);

    this.checkIntervals.set(checkId, intervalId);
  }

  /**
   * ⏰ Perform scheduled recording check
   */
  private async performScheduledCheck(checkId: string): Promise<void> {
    const check = this.pendingChecks.get(checkId);
    if (!check || check.completed) {
      return;
    }

    check.checkCount++;
    this.logger.log(`⏰ Performing scheduled check ${check.checkCount}/${check.maxChecks} for session ${check.sessionId}`);

    try {
      const session = await this.checkRecordingAvailability(check.sessionId);
      
      // Check if recording is available or if we've reached max checks
      if (session?.recordingStatus === 'available' || check.checkCount >= check.maxChecks) {
        check.completed = true;
        
        // Clean up interval
        const intervalId = this.checkIntervals.get(checkId);
        if (intervalId) {
          clearInterval(intervalId);
          this.checkIntervals.delete(checkId);
        }
        
        this.pendingChecks.delete(checkId);
        
        if (session?.recordingStatus === 'available') {
          this.logger.log(`✅ Recording found after ${check.checkCount} checks for session ${check.sessionId}`);
        } else {
          this.logger.warn(`⏰ Recording check timeout for session ${check.sessionId} after ${check.checkCount} checks`);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error in scheduled check: ${error.message}`);
    }
  }

  /**
   * 🔍 Search for meeting recordings in Google Drive
   */
  private async searchForMeetingRecordings(userId: string, meetingDetails: any): Promise<drive_v3.Schema$File[]> {
    try {
      const auth = await this.googleOAuth.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth });

      // Build search query for meeting recordings
      const meetingTitle = meetingDetails.title.replace(/[^\w\s]/gi, '').trim();
      const searchDate = new Date(meetingDetails.startTime).toISOString().split('T')[0];
      
      const query = [
        `name contains '${meetingTitle}'`,
        `mimeType contains 'video/'`,
        `createdTime >= '${searchDate}T00:00:00'`,
        `createdTime <= '${searchDate}T23:59:59'`,
        'trashed = false'
      ].join(' and ');

      const response = await drive.files.list({
        q: query,
        orderBy: 'createdTime desc',
        pageSize: 10,
        fields: 'files(id,name,size,webViewLink,createdTime,mimeType,permissions(emailAddress))'
      });

      return response.data.files || [];
    } catch (error) {
      this.logger.error(`❌ Error searching for recordings: ${error.message}`);
      return [];
    }
  }

  /**
   * 📝 Search for meeting transcripts in Google Drive
   */
  private async searchForMeetingTranscripts(userId: string, meetingDetails: any): Promise<drive_v3.Schema$File[]> {
    try {
      const auth = await this.googleOAuth.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth });

      const meetingTitle = meetingDetails.title.replace(/[^\w\s]/gi, '').trim();
      const searchDate = new Date(meetingDetails.startTime).toISOString().split('T')[0];
      
      const query = [
        `name contains '${meetingTitle}'`,
        `(name contains 'transcript' or name contains 'captions' or mimeType = 'text/plain' or mimeType = 'application/vnd.google-apps.document')`,
        `createdTime >= '${searchDate}T00:00:00'`,
        `createdTime <= '${searchDate}T23:59:59'`,
        'trashed = false'
      ].join(' and ');

      const response = await drive.files.list({
        q: query,
        orderBy: 'createdTime desc',
        pageSize: 5,
        fields: 'files(id,name,mimeType,createdTime)'
      });

      return response.data.files || [];
    } catch (error) {
      this.logger.error(`❌ Error searching for transcripts: ${error.message}`);
      return [];
    }
  }

  /**
   * 📄 Extract transcript content from Google Drive file
   */
  private async extractTranscriptContent(userId: string, fileId: string): Promise<string> {
    try {
      const auth = await this.googleOAuth.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth });

      // Get file metadata
      const fileMetadata = await drive.files.get({
        fileId,
        fields: 'mimeType,name'
      });

      // Download file content based on type
      let content = '';
      
      if (fileMetadata.data.mimeType === 'application/vnd.google-apps.document') {
        // Export Google Doc as plain text
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/plain'
        });
        content = response.data as string;
      } else {
        // Download as is
        const response = await drive.files.get({
          fileId,
          alt: 'media'
        });
        content = response.data as string;
      }

      return content || '';
    } catch (error) {
      this.logger.error(`❌ Error extracting transcript content: ${error.message}`);
      return '';
    }
  }

  /**
   * 📅 Get calendar event details
   */
  private async getCalendarEventDetails(userId: string, eventId: string): Promise<calendar_v3.Schema$Event | null> {
    try {
      const auth = await this.googleOAuth.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      return response.data;
    } catch (error) {
      this.logger.error(`❌ Error getting calendar event: ${error.message}`);
      return null;
    }
  }

  /**
   * 🔧 Helper methods
   */
  private extractConferenceId(meetUrl: string): string | null {
    // Extract conference ID from Google Meet URL
    const match = meetUrl.match(/meet\.google\.com\/([a-z-]+)/);
    return match ? match[1] : null;
  }

  private countSpeakers(transcript: string): number {
    // Simple speaker counting - could be enhanced with better parsing
    const speakerMatches = transcript.match(/Speaker \d+:/g);
    return speakerMatches ? new Set(speakerMatches).size : 1;
  }

  private estimateDuration(startTime: string, endTime: string): number {
    return Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 / 60);
  }

  /**
   * 🧹 Cleanup and maintenance
   */
  private startPeriodicCleanup(): void {
    // Clean up old sessions every hour
    setInterval(() => {
      this.cleanupOldSessions();
    }, 60 * 60 * 1000);
  }

  private cleanupOldSessions(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (new Date(session.timestamps.created) < cutoff && session.status === 'ended') {
        this.activeSessions.delete(sessionId);
        this.logger.log(`🧹 Cleaned up old session ${sessionId}`);
      }
    }
  }

  /**
   * 📊 Public methods for external access
   */
  async getMeetingSession(sessionId: string): Promise<GoogleMeetingSession | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  async getMeetingRecording(calendarEventId: string, userId: string): Promise<any> {
    const session = Array.from(this.activeSessions.values()).find(
      s => s.calendarEventId === calendarEventId && s.userId === userId
    );
    return session?.recordingDetails || null;
  }

  async extractMeetingTranscript(calendarEventId: string, userId: string): Promise<string | null> {
    const session = Array.from(this.activeSessions.values()).find(
      s => s.calendarEventId === calendarEventId && s.userId === userId
    );
    return session?.transcriptContent || null;
  }

  async getAllActiveSessions(): Promise<GoogleMeetingSession[]> {
    return Array.from(this.activeSessions.values());
  }

  async getSessionsByUser(userId: string): Promise<GoogleMeetingSession[]> {
    return Array.from(this.activeSessions.values()).filter(s => s.userId === userId);
  }

  async getRecordingStatus(sessionId: string): Promise<string | null> {
    const session = this.activeSessions.get(sessionId);
    return session?.recordingStatus || null;
  }
} 