import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService } from '../../../integrations/google/services/google-oauth.service';
import { drive_v3, meet_v2 } from 'googleapis';

export interface MeetingRecording {
  id: string;
  meetingId: string;
  recordingUrl: string;
  transcriptUrl?: string;
  duration: number;
  participants: string[];
  recordingStartTime: string;
  recordingEndTime: string;
  recordingStatus: 'processing' | 'completed' | 'failed';
  metadata: {
    meetingTitle: string;
    organizerId: string;
    participantCount: number;
    fileSize?: number;
    format: 'mp4' | 'webm' | 'audio';
  };
}

export interface RecordingStatus {
  available: boolean;
  processing: boolean;
  error?: string;
  estimatedCompletionTime?: string;
}

export interface MeetingParticipant {
  id: string;
  email: string;
  displayName: string;
  joinTime: string;
  leaveTime?: string;
  role: 'organizer' | 'presenter' | 'attendee';
}

export interface MeetingSession {
  meetingId: string;
  sessionId: string;
  startTime: string;
  endTime?: string;
  participants: MeetingParticipant[];
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  status: 'scheduled' | 'in_progress' | 'ended' | 'cancelled';
}

@Injectable()
export class GoogleMeetingTrackerService {
  private readonly logger = new Logger(GoogleMeetingTrackerService.name);
  private readonly activeMeetings = new Map<string, MeetingSession>();

  constructor(
    private readonly configService: ConfigService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  /**
   * Track meeting start - called when a Google Meet session begins
   */
  async trackMeetingStart(eventId: string, userId: string): Promise<MeetingSession> {
    this.logger.log(`Tracking meeting start for event: ${eventId}`);

    try {
      // Get authenticated Google client
      const auth = await this.googleOAuthService.getAuthenticatedClient(userId);

      // Create meeting session tracking
      const meetingSession: MeetingSession = {
        meetingId: eventId,
        sessionId: `session-${eventId}-${Date.now()}`,
        startTime: new Date().toISOString(),
        participants: [],
        recordingEnabled: await this.isRecordingEnabled(eventId, auth),
        transcriptionEnabled: await this.isTranscriptionEnabled(eventId, auth),
        status: 'in_progress'
      };

      // Store active meeting
      this.activeMeetings.set(eventId, meetingSession);

      this.logger.log(`Meeting session started: ${meetingSession.sessionId}`);
      return meetingSession;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error tracking meeting start: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Track meeting end - called when a Google Meet session ends
   */
  async trackMeetingEnd(eventId: string, userId: string): Promise<MeetingSession | null> {
    this.logger.log(`Tracking meeting end for event: ${eventId}`);

    try {
      const meetingSession = this.activeMeetings.get(eventId);
      if (!meetingSession) {
        this.logger.warn(`No active meeting session found for event: ${eventId}`);
        return null;
      }

      // Update session with end time
      meetingSession.endTime = new Date().toISOString();
      meetingSession.status = 'ended';

      // Get final participant list
      const auth = await this.googleOAuthService.getAuthenticatedClient(userId);
      meetingSession.participants = await this.getMeetingParticipants(eventId, auth);

      // Remove from active meetings
      this.activeMeetings.delete(eventId);

      this.logger.log(`Meeting session ended: ${meetingSession.sessionId}`);
      return meetingSession;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error tracking meeting end: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Extract meeting transcript from Google Meet recording
   */
  async extractMeetingTranscript(eventId: string, userId: string): Promise<string | null> {
    this.logger.log(`Extracting transcript for meeting: ${eventId}`);

    try {
      // Get authenticated Google client
      const auth = await this.googleOAuthService.getAuthenticatedClient(userId);

      // Find recording in Google Drive
      const recording = await this.findMeetingRecording(eventId, auth);
      if (!recording) {
        this.logger.warn(`No recording found for meeting: ${eventId}`);
        return null;
      }

      // Extract transcript from recording metadata or separate transcript file
      const transcript = await this.extractTranscriptFromRecording(recording, auth);
      
      if (transcript) {
        this.logger.log(`Successfully extracted transcript for meeting: ${eventId} (${transcript.length} characters)`);
      } else {
        this.logger.warn(`No transcript available for meeting: ${eventId}`);
      }

      return transcript;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error extracting transcript: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get meeting recording data
   */
  async getMeetingRecording(eventId: string, userId: string): Promise<MeetingRecording | null> {
    this.logger.log(`Getting meeting recording for event: ${eventId}`);

    try {
      const auth = await this.googleOAuthService.getAuthenticatedClient(userId);
      
      // Find recording file in Google Drive
      const recordingFile = await this.findMeetingRecording(eventId, auth);
      if (!recordingFile) {
        return null;
      }

      // Get recording metadata
      const recording: MeetingRecording = {
        id: recordingFile.id || '',
        meetingId: eventId,
        recordingUrl: `https://drive.google.com/file/d/${recordingFile.id}/view`,
        transcriptUrl: await this.findTranscriptFile(eventId, auth),
        duration: await this.getRecordingDuration(recordingFile, auth),
        participants: await this.getRecordingParticipants(recordingFile, auth),
        recordingStartTime: recordingFile.createdTime || new Date().toISOString(),
        recordingEndTime: recordingFile.modifiedTime || new Date().toISOString(),
        recordingStatus: 'completed',
        metadata: {
          meetingTitle: recordingFile.name || `Meeting ${eventId}`,
          organizerId: userId,
          participantCount: 0, // Will be populated by getRecordingParticipants
          fileSize: recordingFile.size ? parseInt(recordingFile.size) : undefined,
          format: this.determineFileFormat(recordingFile.mimeType || '')
        }
      };

      return recording;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error getting meeting recording: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Check if recording is available for a meeting
   */
  async getMeetingRecordingStatus(eventId: string, userId: string): Promise<RecordingStatus> {
    this.logger.log(`Checking recording status for meeting: ${eventId}`);

    try {
      const auth = await this.googleOAuthService.getAuthenticatedClient(userId);
      const recordingFile = await this.findMeetingRecording(eventId, auth);

      if (!recordingFile) {
        return {
          available: false,
          processing: false,
          error: 'No recording found'
        };
      }

      // Check if recording is still processing
      const isProcessing = recordingFile.mimeType?.includes('processing') || false;

      return {
        available: !isProcessing,
        processing: isProcessing,
        estimatedCompletionTime: isProcessing ? 
          new Date(Date.now() + 5 * 60 * 1000).toISOString() : // 5 minutes estimate
          undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error checking recording status: ${errorMessage}`);
      return {
        available: false,
        processing: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get list of active meetings being tracked
   */
  getActiveMeetings(): MeetingSession[] {
    return Array.from(this.activeMeetings.values());
  }

  /**
   * Get specific active meeting session
   */
  getActiveMeeting(eventId: string): MeetingSession | null {
    return this.activeMeetings.get(eventId) || null;
  }

  // Private helper methods

  private async isRecordingEnabled(eventId: string, auth: any): Promise<boolean> {
    try {
      // Check Google Calendar event for recording settings
      // This would integrate with Google Calendar API to check meeting settings
      // For now, return true as default
      return true;
    } catch (error) {
      this.logger.warn(`Could not determine recording status for ${eventId}`);
      return false;
    }
  }

  private async isTranscriptionEnabled(eventId: string, auth: any): Promise<boolean> {
    try {
      // Check if transcription is enabled for the meeting
      // This would check Google Meet settings
      return true;
    } catch (error) {
      this.logger.warn(`Could not determine transcription status for ${eventId}`);
      return false;
    }
  }

  private async getMeetingParticipants(eventId: string, auth: any): Promise<MeetingParticipant[]> {
    try {
      // This would integrate with Google Meet API to get participant data
      // For now, return empty array as this requires additional Google Meet API access
      this.logger.debug(`Getting participants for meeting ${eventId} - API integration pending`);
      return [];
    } catch (error) {
      this.logger.warn(`Could not get participants for meeting ${eventId}`);
      return [];
    }
  }

  private async findMeetingRecording(eventId: string, auth: any): Promise<drive_v3.Schema$File | null> {
    try {
      const drive = new drive_v3.Drive({ auth });

      // Search for recording file in Google Drive
      // Google Meet recordings are typically saved with specific naming patterns
      const searchQuery = `name contains '${eventId}' and mimeType contains 'video'`;
      
      const response = await drive.files.list({
        q: searchQuery,
        fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,parents)',
        orderBy: 'createdTime desc'
      });

      const files = response.data.files || [];
      
      if (files.length === 0) {
        // Try alternative search patterns
        const altSearchQuery = `name contains 'Meet recording' and createdTime > '${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}'`;
        const altResponse = await drive.files.list({
          q: altSearchQuery,
          fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,parents)',
          orderBy: 'createdTime desc'
        });
        
        return altResponse.data.files?.[0] || null;
      }

      return files[0];
    } catch (error) {
      this.logger.error(`Error finding meeting recording: ${error}`);
      return null;
    }
  }

  private async findTranscriptFile(eventId: string, auth: any): Promise<string | undefined> {
    try {
      const drive = new drive_v3.Drive({ auth });

      // Search for transcript file
      const searchQuery = `name contains '${eventId}' and name contains 'transcript'`;
      
      const response = await drive.files.list({
        q: searchQuery,
        fields: 'files(id,name)',
        orderBy: 'createdTime desc'
      });

      const transcriptFile = response.data.files?.[0];
      
      return transcriptFile ? `https://drive.google.com/file/d/${transcriptFile.id}/view` : undefined;
    } catch (error) {
      this.logger.warn(`Could not find transcript file: ${error}`);
      return undefined;
    }
  }

  private async extractTranscriptFromRecording(recordingFile: drive_v3.Schema$File, auth: any): Promise<string | null> {
    try {
      // First, try to find a separate transcript file
      const transcriptFile = await this.findTranscriptFileByRecording(recordingFile, auth);
      
      if (transcriptFile) {
        return await this.downloadTranscriptContent(transcriptFile, auth);
      }

      // If no separate transcript file, check if transcript is embedded in recording metadata
      // This would require additional processing capabilities
      this.logger.debug('No separate transcript file found, transcript extraction from video not implemented yet');
      return null;
    } catch (error) {
      this.logger.error(`Error extracting transcript: ${error}`);
      return null;
    }
  }

  private async findTranscriptFileByRecording(recordingFile: drive_v3.Schema$File, auth: any): Promise<drive_v3.Schema$File | null> {
    try {
      const drive = new drive_v3.Drive({ auth });
      
      // Search for transcript file in same folder as recording
      const parentFolder = recordingFile.parents?.[0];
      let searchQuery = `name contains 'transcript' and mimeType contains 'text'`;
      
      if (parentFolder) {
        searchQuery += ` and parents in '${parentFolder}'`;
      }

      const response = await drive.files.list({
        q: searchQuery,
        fields: 'files(id,name,mimeType)',
        orderBy: 'createdTime desc'
      });

      return response.data.files?.[0] || null;
    } catch (error) {
      this.logger.warn(`Error finding transcript file: ${error}`);
      return null;
    }
  }

  private async downloadTranscriptContent(transcriptFile: drive_v3.Schema$File, auth: any): Promise<string | null> {
    try {
      const drive = new drive_v3.Drive({ auth });
      
      const response = await drive.files.get({
        fileId: transcriptFile.id || '',
        alt: 'media'
      });

      return response.data as string;
    } catch (error) {
      this.logger.error(`Error downloading transcript content: ${error}`);
      return null;
    }
  }

  private async getRecordingDuration(recordingFile: drive_v3.Schema$File, auth: any): Promise<number> {
    try {
      // This would require video metadata extraction
      // For now, estimate based on file size or return default
      const fileSize = recordingFile.size ? parseInt(recordingFile.size) : 0;
      
      // Rough estimation: 1MB per minute for compressed video
      const estimatedMinutes = Math.max(fileSize / (1024 * 1024), 30); // Default to 30 minutes
      
      return estimatedMinutes * 60; // Return seconds
    } catch (error) {
      this.logger.warn(`Could not determine recording duration: ${error}`);
      return 1800; // Default 30 minutes
    }
  }

  private async getRecordingParticipants(recordingFile: drive_v3.Schema$File, auth: any): Promise<string[]> {
    try {
      // This would extract participant information from recording metadata
      // For now, return empty array as this requires additional processing
      return [];
    } catch (error) {
      this.logger.warn(`Could not get recording participants: ${error}`);
      return [];
    }
  }

  private determineFileFormat(mimeType: string): 'mp4' | 'webm' | 'audio' {
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('audio')) return 'audio';
    return 'mp4'; // Default
  }

  /**
   * Development/Testing Methods
   */

  /**
   * Simulate real meeting with test data (for development/testing only)
   */
  async simulateRealMeetingWithTestData(
    eventId: string, 
    transcriptFile: string, 
    userId: string
  ): Promise<MeetingRecording> {
    this.logger.log(`🧪 TESTING: Simulating real meeting for event: ${eventId}`);

    try {
      // Read test transcript file (this would be replaced with actual transcript)
      const testTranscript = transcriptFile; // In real implementation, read from file

      // Create simulated recording data
      const simulatedRecording: MeetingRecording = {
        id: `test-recording-${eventId}`,
        meetingId: eventId,
        recordingUrl: `https://test-recordings.example.com/${eventId}`,
        transcriptUrl: `https://test-transcripts.example.com/${eventId}`,
        duration: 1800, // 30 minutes
        participants: ['test-user-1@example.com', 'test-user-2@example.com'],
        recordingStartTime: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        recordingEndTime: new Date().toISOString(),
        recordingStatus: 'completed',
        metadata: {
          meetingTitle: `Test Meeting ${eventId}`,
          organizerId: userId,
          participantCount: 2,
          fileSize: 50 * 1024 * 1024, // 50MB
          format: 'mp4'
        }
      };

      this.logger.log(`🧪 TESTING: Simulated recording created for ${eventId}`);
      return simulatedRecording;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`🧪 TESTING: Error simulating meeting: ${errorMessage}`);
      throw error;
    }
  }
} 