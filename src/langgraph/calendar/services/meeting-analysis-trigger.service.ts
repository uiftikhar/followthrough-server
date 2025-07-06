import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { GoogleMeetingTrackerService, MeetingRecording, MeetingSession } from './google-meeting-tracker.service';
import { UnifiedWorkflowService } from '../../unified-workflow.service';
import { CalendarEvent } from '../../../calendar/interfaces/calendar-event.interface';

export interface MeetingAnalysisTrigger {
  eventId: string;
  userId: string;
  meetingSession: MeetingSession;
  recording?: MeetingRecording;
  transcript?: string;
  triggerType: 'automatic' | 'manual' | 'scheduled' | 'retry';
  triggeredAt: string;
  metadata: Record<string, any>;
}

export interface AnalysisWorkflowResult {
  sessionId: string;
  status: 'initiated' | 'processing' | 'completed' | 'failed';
  triggerId: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface RecordingAvailabilityCheck {
  eventId: string;
  checkCount: number;
  lastChecked: string;
  nextCheckAt: string;
  maxRetries: number;
  recordingFound: boolean;
  transcriptFound: boolean;
}

@Injectable()
export class MeetingAnalysisTriggerService {
  private readonly logger = new Logger(MeetingAnalysisTriggerService.name);
  
  // Track pending meeting analysis triggers
  private readonly pendingAnalysis = new Map<string, MeetingAnalysisTrigger>();
  
  // Track recording availability checks
  private readonly recordingChecks = new Map<string, RecordingAvailabilityCheck>();
  
  // Track active analysis workflows
  private readonly activeWorkflows = new Map<string, AnalysisWorkflowResult>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly googleMeetingTracker: GoogleMeetingTrackerService,
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
  ) {
    // Start periodic recording availability checks
    this.startPeriodicRecordingChecks();
  }

  /**
   * Listen for meeting ended events from calendar workflow
   */
  @OnEvent('calendar.meeting.ended')
  async handleMeetingEnded(payload: {
    eventId: string;
    userId: string;
    calendarEvent: CalendarEvent;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`🎯 Meeting ended event received for: ${payload.eventId}`);

    try {
      // Get meeting session data
      const meetingSession = this.googleMeetingTracker.getActiveMeeting(payload.eventId);
      
      if (!meetingSession) {
        this.logger.warn(`No active meeting session found for event: ${payload.eventId}`);
        // Try to track the ended meeting retroactively
        await this.googleMeetingTracker.trackMeetingEnd(payload.eventId, payload.userId);
      }

      // Initialize analysis trigger
      await this.initiateMeetingAnalysisTrigger({
        eventId: payload.eventId,
        userId: payload.userId,
        calendarEvent: payload.calendarEvent,
        triggerType: 'automatic',
        metadata: {
          source: 'calendar.meeting.ended',
          originalPayload: payload
        }
      });

    } catch (error) {
      this.logger.error(`Error handling meeting ended event: ${error.message}`);
    }
  }

  /**
   * Initiate meeting analysis trigger after a meeting ends
   */
  async initiateMeetingAnalysisTrigger(options: {
    eventId: string;
    userId: string;
    calendarEvent: CalendarEvent;
    triggerType: 'automatic' | 'manual' | 'scheduled' | 'retry';
    metadata?: Record<string, any>;
  }): Promise<string> {
    this.logger.log(`🚀 Initiating meeting analysis trigger for: ${options.eventId}`);

    try {
      const triggerId = `trigger-${options.eventId}-${Date.now()}`;

      // Get or create meeting session
      let meetingSession = this.googleMeetingTracker.getActiveMeeting(options.eventId);
      if (!meetingSession) {
        // Try to get session from ended meeting
        meetingSession = await this.googleMeetingTracker.trackMeetingEnd(options.eventId, options.userId);
        if (!meetingSession) {
          // Create minimal session data
          meetingSession = {
            meetingId: options.eventId,
            sessionId: `session-${options.eventId}-ended`,
            startTime: options.calendarEvent.startTime,
            endTime: options.calendarEvent.endTime,
            participants: [],
            recordingEnabled: true, // Assume recording is enabled
            transcriptionEnabled: true,
            status: 'ended'
          };
        }
      }

      // Create analysis trigger
      const trigger: MeetingAnalysisTrigger = {
        eventId: options.eventId,
        userId: options.userId,
        meetingSession,
        triggerType: options.triggerType,
        triggeredAt: new Date().toISOString(),
        metadata: {
          calendarEvent: options.calendarEvent,
          ...options.metadata
        }
      };

      // Store pending analysis
      this.pendingAnalysis.set(triggerId, trigger);

      // Check for recording availability
      const recordingStatus = await this.checkRecordingAvailability(options.eventId, options.userId);

      if (recordingStatus.recordingFound && recordingStatus.transcriptFound) {
        // Recording and transcript are available - trigger analysis immediately
        this.logger.log(`📹 Recording and transcript available for ${options.eventId} - triggering analysis`);
        await this.triggerMeetingAnalysis(triggerId);
      } else {
        // Schedule periodic checks for recording availability
        this.logger.log(`⏳ Recording not yet available for ${options.eventId} - scheduling periodic checks`);
        await this.scheduleRecordingAvailabilityChecks(options.eventId, options.userId, triggerId);
      }

      return triggerId;
    } catch (error) {
      this.logger.error(`Error initiating meeting analysis trigger: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if recording and transcript are available for a meeting
   */
  private async checkRecordingAvailability(eventId: string, userId: string): Promise<{
    recordingFound: boolean;
    transcriptFound: boolean;
    recording?: MeetingRecording;
    transcript?: string;
  }> {
    this.logger.log(`🔍 Checking recording availability for meeting: ${eventId}`);

    try {
      // Check recording status
      const recordingStatus = await this.googleMeetingTracker.getMeetingRecordingStatus(eventId, userId);
      
      if (!recordingStatus.available) {
        return {
          recordingFound: false,
          transcriptFound: false
        };
      }

      // Get recording data
      const recording = await this.googleMeetingTracker.getMeetingRecording(eventId, userId);
      
      if (!recording) {
        return {
          recordingFound: false,
          transcriptFound: false
        };
      }

      // Extract transcript
      const transcript = await this.googleMeetingTracker.extractMeetingTranscript(eventId, userId);

      return {
        recordingFound: true,
        transcriptFound: !!transcript,
        recording,
        transcript: transcript || undefined
      };
    } catch (error) {
      this.logger.error(`Error checking recording availability: ${error.message}`);
      return {
        recordingFound: false,
        transcriptFound: false
      };
    }
  }

  /**
   * Schedule periodic checks for recording availability
   */
  private async scheduleRecordingAvailabilityChecks(
    eventId: string,
    userId: string,
    triggerId: string
  ): Promise<void> {
    this.logger.log(`📅 Scheduling recording availability checks for: ${eventId}`);

    const check: RecordingAvailabilityCheck = {
      eventId,
      checkCount: 0,
      lastChecked: new Date().toISOString(),
      nextCheckAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Check in 5 minutes
      maxRetries: 12, // Check for 1 hour (5 min intervals)
      recordingFound: false,
      transcriptFound: false
    };

    this.recordingChecks.set(triggerId, check);
  }

  /**
   * Trigger meeting analysis workflow with recording and transcript
   */
  private async triggerMeetingAnalysis(triggerId: string): Promise<AnalysisWorkflowResult> {
    this.logger.log(`🎯 Triggering meeting analysis for trigger: ${triggerId}`);

    try {
      const trigger = this.pendingAnalysis.get(triggerId);
      if (!trigger) {
        throw new Error(`No pending analysis found for trigger: ${triggerId}`);
      }

      // Get recording and transcript data
      const availability = await this.checkRecordingAvailability(trigger.eventId, trigger.userId);
      
      if (!availability.recordingFound || !availability.transcript) {
        throw new Error(`Recording or transcript not available for ${trigger.eventId}`);
      }

      // Prepare meeting analysis input
      const analysisInput = {
        type: 'meeting_transcript',
        transcript: availability.transcript,
        participants: trigger.meetingSession.participants.map(p => p.email),
        meetingTitle: trigger.metadata.calendarEvent?.title || 'Unknown Meeting',
        date: trigger.meetingSession.startTime,
        duration: this.calculateMeetingDuration(trigger.meetingSession),
        metadata: {
          calendarEventId: trigger.eventId,
          sessionId: trigger.meetingSession.sessionId,
          recordingId: availability.recording?.id,
          triggerId,
          triggerType: trigger.triggerType,
          meetingRecording: availability.recording,
          originalCalendarEvent: trigger.metadata.calendarEvent,
          autoTriggered: trigger.triggerType === 'automatic'
        }
      };

      // Trigger unified workflow for meeting analysis
      const workflowResult = await this.unifiedWorkflowService.processInput(
        analysisInput,
        analysisInput.metadata,
        trigger.userId
      );

      // Create analysis workflow result
      const result: AnalysisWorkflowResult = {
        sessionId: workflowResult.sessionId,
        status: 'initiated',
        triggerId,
        startedAt: new Date().toISOString()
      };

      // Store active workflow
      this.activeWorkflows.set(workflowResult.sessionId, result);

      // Clean up pending analysis
      this.pendingAnalysis.delete(triggerId);
      this.recordingChecks.delete(triggerId);

      this.logger.log(`✅ Meeting analysis triggered successfully - Session: ${workflowResult.sessionId}`);

      // Emit event for tracking
      this.eventEmitter.emit('meeting.analysis.triggered', {
        triggerId,
        sessionId: workflowResult.sessionId,
        eventId: trigger.eventId,
        userId: trigger.userId,
        triggerType: trigger.triggerType,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      this.logger.error(`Error triggering meeting analysis: ${error.message}`);
      
      // Update workflow result with error
      const errorResult: AnalysisWorkflowResult = {
        sessionId: 'failed',
        status: 'failed',
        triggerId,
        startedAt: new Date().toISOString(),
        error: error.message
      };

      return errorResult;
    }
  }

  /**
   * Listen for meeting analysis completion events
   */
  @OnEvent('meeting.analysis.completed')
  async handleMeetingAnalysisCompleted(payload: {
    sessionId: string;
    result: any;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`🎉 Meeting analysis completed for session: ${payload.sessionId}`);

    try {
      const workflow = this.activeWorkflows.get(payload.sessionId);
      if (workflow) {
        workflow.status = 'completed';
        workflow.completedAt = new Date().toISOString();
        
        this.logger.log(`✅ Analysis workflow completed: ${workflow.triggerId}`);
        
        // Emit event for post-meeting orchestration
        this.eventEmitter.emit('meeting.analysis.result.available', {
          sessionId: payload.sessionId,
          triggerId: workflow.triggerId,
          analysisResult: payload.result,
          completedAt: workflow.completedAt,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error(`Error handling meeting analysis completion: ${error.message}`);
    }
  }

  /**
   * Periodic check for recording availability
   */
  private startPeriodicRecordingChecks(): void {
    this.logger.log('🕒 Starting periodic recording availability checks');

    setInterval(async () => {
      await this.performRecordingAvailabilityChecks();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Perform recording availability checks for pending triggers
   */
  private async performRecordingAvailabilityChecks(): Promise<void> {
    const now = new Date();
    const checksToPerform: string[] = [];

    // Find checks that are due
    for (const [triggerId, check] of this.recordingChecks.entries()) {
      if (new Date(check.nextCheckAt) <= now && check.checkCount < check.maxRetries) {
        checksToPerform.push(triggerId);
      }
    }

    if (checksToPerform.length === 0) {
      return; // No checks needed
    }

    this.logger.log(`🔍 Performing ${checksToPerform.length} recording availability checks`);

    for (const triggerId of checksToPerform) {
      try {
        await this.performSingleRecordingCheck(triggerId);
      } catch (error) {
        this.logger.error(`Error in recording check for ${triggerId}: ${error.message}`);
      }
    }
  }

  /**
   * Perform a single recording availability check
   */
  private async performSingleRecordingCheck(triggerId: string): Promise<void> {
    const check = this.recordingChecks.get(triggerId);
    const trigger = this.pendingAnalysis.get(triggerId);

    if (!check || !trigger) {
      this.recordingChecks.delete(triggerId);
      return;
    }

    // Update check metadata
    check.checkCount++;
    check.lastChecked = new Date().toISOString();
    check.nextCheckAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Check recording availability
    const availability = await this.checkRecordingAvailability(trigger.eventId, trigger.userId);

    if (availability.recordingFound && availability.transcriptFound) {
      this.logger.log(`📹 Recording now available for ${trigger.eventId} - triggering analysis`);
      
      check.recordingFound = true;
      check.transcriptFound = true;
      
      // Trigger analysis
      await this.triggerMeetingAnalysis(triggerId);
    } else if (check.checkCount >= check.maxRetries) {
      this.logger.warn(`⏰ Max retries reached for ${trigger.eventId} - giving up on recording`);
      
      // Clean up
      this.recordingChecks.delete(triggerId);
      this.pendingAnalysis.delete(triggerId);
      
      // Emit timeout event
      this.eventEmitter.emit('meeting.analysis.timeout', {
        triggerId,
        eventId: trigger.eventId,
        userId: trigger.userId,
        reason: 'recording_not_available',
        checkCount: check.checkCount,
        timestamp: new Date().toISOString()
      });
    } else {
      this.logger.debug(`⏳ Recording not yet available for ${trigger.eventId} (check ${check.checkCount}/${check.maxRetries})`);
    }
  }

  /**
   * Manually trigger meeting analysis (for testing or retry)
   */
  async manuallyTriggerAnalysis(
    eventId: string,
    userId: string,
    calendarEvent: CalendarEvent,
    options?: {
      forceWithoutRecording?: boolean;
      testTranscript?: string;
    }
  ): Promise<AnalysisWorkflowResult> {
    this.logger.log(`🔧 Manually triggering analysis for: ${eventId}`);

    try {
      if (options?.forceWithoutRecording && options?.testTranscript) {
        // Create test trigger with provided transcript
        const triggerId = await this.initiateMeetingAnalysisTrigger({
          eventId,
          userId,
          calendarEvent,
          triggerType: 'manual',
          metadata: {
            testMode: true,
            testTranscript: options.testTranscript
          }
        });

        // Override transcript for testing
        const trigger = this.pendingAnalysis.get(triggerId);
        if (trigger) {
          trigger.transcript = options.testTranscript;
        }

        return await this.triggerMeetingAnalysis(triggerId);
      } else {
        // Normal manual trigger
        const triggerId = await this.initiateMeetingAnalysisTrigger({
          eventId,
          userId,
          calendarEvent,
          triggerType: 'manual'
        });

        // Check if recording is available and trigger immediately if so
        const availability = await this.checkRecordingAvailability(eventId, userId);
        if (availability.recordingFound && availability.transcriptFound) {
          return await this.triggerMeetingAnalysis(triggerId);
        } else {
          throw new Error('Recording or transcript not available for manual trigger');
        }
      }
    } catch (error) {
      this.logger.error(`Error manually triggering analysis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get status of all pending and active analysis triggers
   */
  getAnalysisStatus(): {
    pending: number;
    active: number;
    pendingChecks: number;
    pendingTriggers: Array<{
      triggerId: string;
      eventId: string;
      triggerType: string;
      triggeredAt: string;
    }>;
    activeWorkflows: Array<{
      sessionId: string;
      triggerId: string;
      status: string;
      startedAt: string;
    }>;
  } {
    return {
      pending: this.pendingAnalysis.size,
      active: this.activeWorkflows.size,
      pendingChecks: this.recordingChecks.size,
      pendingTriggers: Array.from(this.pendingAnalysis.entries()).map(([triggerId, trigger]) => ({
        triggerId,
        eventId: trigger.eventId,
        triggerType: trigger.triggerType,
        triggeredAt: trigger.triggeredAt
      })),
      activeWorkflows: Array.from(this.activeWorkflows.entries()).map(([sessionId, workflow]) => ({
        sessionId,
        triggerId: workflow.triggerId,
        status: workflow.status,
        startedAt: workflow.startedAt
      }))
    };
  }

  // Utility methods

  private calculateMeetingDuration(meetingSession: MeetingSession): number {
    if (!meetingSession.endTime) {
      return 0;
    }

    const start = new Date(meetingSession.startTime);
    const end = new Date(meetingSession.endTime);
    
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Duration in minutes
  }
} 