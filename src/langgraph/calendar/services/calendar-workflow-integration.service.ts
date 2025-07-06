import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { GoogleMeetingTrackerService, MeetingSession, MeetingRecording } from './google-meeting-tracker.service';
import { MeetingAnalysisTriggerService, AnalysisWorkflowResult } from './meeting-analysis-trigger.service';
import { UnifiedWorkflowService } from '../../unified-workflow.service';
import { CalendarWorkflowService } from '../../../calendar/services/calendar-workflow.service';
import { CalendarEvent } from '../../../calendar/interfaces/calendar-event.interface';

export interface CalendarWorkflowEvent {
  eventType: 'meeting.started' | 'meeting.ended' | 'recording.available' | 'analysis.completed' | 'analysis.failed';
  eventId: string;
  userId: string;
  timestamp: string;
  data: {
    meetingSession?: MeetingSession;
    recording?: MeetingRecording;
    analysisResult?: AnalysisWorkflowResult;
    transcript?: string;
    calendarEvent?: CalendarEvent;
    error?: string;
  };
  metadata: Record<string, any>;
}

export interface WorkflowIntegrationStatus {
  coreConnected: boolean;
  enhancedServicesActive: boolean;
  eventListenersRegistered: boolean;
  activeIntegrations: {
    meetingTracker: boolean;
    analysisTrigger: boolean;
    calendarWorkflow: boolean;
    unifiedWorkflow: boolean;
  };
  statistics: {
    eventsProcessed: number;
    workflowsTriggered: number;
    integrationErrors: number;
    lastEventTime?: string;
  };
}

export interface IntegratedWorkflowData {
  // Core calendar data
  calendarEvent: CalendarEvent;
  preMeetingContext?: any;
  meetingBrief?: any;
  
  // Enhanced meeting data
  meetingSession: MeetingSession;
  recording?: MeetingRecording;
  transcript?: string;
  analysisResult?: AnalysisWorkflowResult;
  
  // Integration metadata
  integratedAt: string;
  workflowVersion: string;
  dataConsistency: {
    coreValid: boolean;
    enhancedValid: boolean;
    synchronized: boolean;
  };
}

@Injectable()
export class CalendarWorkflowIntegrationService {
  private readonly logger = new Logger(CalendarWorkflowIntegrationService.name);
  
  // Integration statistics
  private statistics = {
    eventsProcessed: 0,
    workflowsTriggered: 0,
    integrationErrors: 0,
    lastEventTime: undefined as string | undefined,
  };

  // Active workflow sessions
  private readonly activeWorkflows = new Map<string, IntegratedWorkflowData>();
  
  // Event queue for processing
  private readonly eventQueue: CalendarWorkflowEvent[] = [];
  private processingQueue = false;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly googleMeetingTracker: GoogleMeetingTrackerService,
    private readonly meetingAnalysisTrigger: MeetingAnalysisTriggerService,
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
    private readonly calendarWorkflowService: CalendarWorkflowService,
  ) {
    this.logger.log('🔗 Calendar Workflow Integration Service initialized');
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for core and enhanced calendar integration
   */
  private initializeEventListeners(): void {
    this.logger.log('📡 Setting up Core ↔ Enhanced calendar integration event listeners');

    // Listen for core calendar events
    this.eventEmitter.on('calendar.meeting.created', this.handleMeetingCreated.bind(this));
    this.eventEmitter.on('calendar.meeting.updated', this.handleMeetingUpdated.bind(this));
    this.eventEmitter.on('calendar.meeting.started', this.handleMeetingStarted.bind(this));
    this.eventEmitter.on('calendar.meeting.ended', this.handleMeetingEnded.bind(this));

    // Listen for enhanced meeting events
    this.eventEmitter.on('enhanced.recording.available', this.handleRecordingAvailable.bind(this));
    this.eventEmitter.on('enhanced.analysis.completed', this.handleAnalysisCompleted.bind(this));
    this.eventEmitter.on('enhanced.analysis.failed', this.handleAnalysisFailed.bind(this));

    // Start event queue processing
    this.startEventQueueProcessing();
  }

  /**
   * Handle meeting updated events from core calendar
   */
  @OnEvent('calendar.meeting.updated')
  private async handleMeetingUpdated(payload: {
    eventId: string;
    userId: string;
    calendarEvent: CalendarEvent;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`📝 Meeting updated: ${payload.eventId} - Updating enhanced tracking`);

    try {
      // Update existing workflow data
      const workflowData = this.activeWorkflows.get(payload.eventId);
      if (workflowData) {
        workflowData.calendarEvent = payload.calendarEvent;
        workflowData.dataConsistency.synchronized = false; // Needs re-sync
      }

      this.statistics.eventsProcessed++;
    } catch (error) {
      this.logger.error(`Error handling meeting updated: ${error.message}`);
      this.statistics.integrationErrors++;
    }
  }

  /**
   * Handle meeting created events from core calendar
   */
  @OnEvent('calendar.meeting.created')
  private async handleMeetingCreated(payload: {
    eventId: string;
    userId: string;
    calendarEvent: CalendarEvent;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`📅 Meeting created: ${payload.eventId} - Setting up enhanced tracking`);

    try {
      // Initialize integrated workflow data
      const workflowData: IntegratedWorkflowData = {
        calendarEvent: payload.calendarEvent,
        meetingSession: {
          meetingId: payload.eventId,
          sessionId: `pending-${payload.eventId}`,
          startTime: payload.calendarEvent.startTime,
          participants: [],
          recordingEnabled: true,
          transcriptionEnabled: true,
          status: 'scheduled',
        },
        integratedAt: new Date().toISOString(),
        workflowVersion: '2.0',
        dataConsistency: {
          coreValid: true,
          enhancedValid: false, // Will be updated when enhanced tracking starts
          synchronized: false,
        },
      };

      this.activeWorkflows.set(payload.eventId, workflowData);

      // Emit enhanced integration event
      await this.emitEnhancedEvent({
        eventType: 'meeting.started',
        eventId: payload.eventId,
        userId: payload.userId,
        timestamp: new Date().toISOString(),
        data: {
          calendarEvent: payload.calendarEvent,
          meetingSession: workflowData.meetingSession,
        },
        metadata: {
          source: 'core.calendar.meeting.created',
          integrationVersion: '2.0',
        },
      });

      this.statistics.eventsProcessed++;
      this.statistics.lastEventTime = new Date().toISOString();

    } catch (error) {
      this.logger.error(`Error handling meeting created: ${error.message}`);
      this.statistics.integrationErrors++;
    }
  }

  /**
   * Handle meeting started events from core calendar
   */
  @OnEvent('calendar.meeting.started')
  private async handleMeetingStarted(payload: {
    eventId: string;
    userId: string;
    calendarEvent: CalendarEvent;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`▶️ Meeting started: ${payload.eventId} - Initiating enhanced tracking`);

    try {
      // Start Google Meet tracking
      const meetingSession = await this.googleMeetingTracker.trackMeetingStart(
        payload.eventId,
        payload.userId
      );

      // Update workflow data with actual meeting session
      const workflowData = this.activeWorkflows.get(payload.eventId);
      if (workflowData) {
        workflowData.meetingSession = meetingSession;
        workflowData.dataConsistency.enhancedValid = true;
        workflowData.dataConsistency.synchronized = true;
      }

      // Emit enhanced event
      await this.emitEnhancedEvent({
        eventType: 'meeting.started',
        eventId: payload.eventId,
        userId: payload.userId,
        timestamp: new Date().toISOString(),
        data: {
          calendarEvent: payload.calendarEvent,
          meetingSession,
        },
        metadata: {
          source: 'core.calendar.meeting.started',
          trackingActive: true,
        },
      });

      this.statistics.eventsProcessed++;
      this.statistics.workflowsTriggered++;

    } catch (error) {
      this.logger.error(`Error handling meeting started: ${error.message}`);
      this.statistics.integrationErrors++;
    }
  }

  /**
   * Handle meeting ended events from core calendar
   */
  @OnEvent('calendar.meeting.ended')
  private async handleMeetingEnded(payload: {
    eventId: string;
    userId: string;
    calendarEvent: CalendarEvent;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`🏁 Meeting ended: ${payload.eventId} - Finalizing enhanced workflow`);

    try {
      // Stop Google Meet tracking
      const meetingSession = await this.googleMeetingTracker.trackMeetingEnd(payload.eventId, payload.userId);

      // Get recording and transcript separately
      const recording = await this.googleMeetingTracker.getMeetingRecording(payload.eventId, payload.userId);
      const transcript = await this.googleMeetingTracker.extractMeetingTranscript(payload.eventId, payload.userId);

      // Update workflow data
      const workflowData = this.activeWorkflows.get(payload.eventId);
      if (workflowData) {
        workflowData.recording = recording || undefined;
        workflowData.transcript = transcript || undefined;
      }

      // Trigger analysis workflow through the trigger service
      await this.triggerIntegratedAnalysisWorkflow(payload.eventId, payload.userId, payload.calendarEvent);

      this.statistics.eventsProcessed++;

    } catch (error) {
      this.logger.error(`Error handling meeting ended: ${error.message}`);
      this.statistics.integrationErrors++;
    }
  }

  /**
   * Handle recording available events from enhanced services
   */
  @OnEvent('enhanced.recording.available')
  private async handleRecordingAvailable(payload: {
    eventId: string;
    userId: string;
    recording: MeetingRecording;
    transcript?: string;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`🎥 Recording available: ${payload.eventId} - Preparing for analysis`);

    try {
      // Update workflow data with recording info
      const workflowData = this.activeWorkflows.get(payload.eventId);
      if (workflowData) {
        workflowData.recording = payload.recording;
        workflowData.transcript = payload.transcript;
      }

      // Trigger analysis if transcript is available
      if (payload.transcript && workflowData?.calendarEvent) {
        await this.meetingAnalysisTrigger.initiateMeetingAnalysisTrigger({
          eventId: payload.eventId,
          userId: payload.userId,
          calendarEvent: workflowData.calendarEvent,
          triggerType: 'automatic',
          metadata: {
            transcript: payload.transcript,
            recording: payload.recording,
            source: 'enhanced.recording.available'
          }
        });
      }

      this.statistics.eventsProcessed++;

    } catch (error) {
      this.logger.error(`Error handling recording available: ${error.message}`);
      this.statistics.integrationErrors++;
    }
  }

  /**
   * Handle analysis completed events from enhanced services
   */
  @OnEvent('enhanced.analysis.completed')
  private async handleAnalysisCompleted(payload: {
    sessionId: string;
    eventId: string;
    userId: string;
    analysisResult: AnalysisWorkflowResult;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`✅ Analysis completed: ${payload.eventId} - Integrating with core workflow`);

    try {
      // Update workflow data with analysis results
      const workflowData = this.activeWorkflows.get(payload.eventId);
      if (workflowData) {
        workflowData.analysisResult = payload.analysisResult;
        workflowData.dataConsistency.synchronized = true;
      }

      // Trigger core calendar post-meeting workflow with enhanced data
      await this.triggerCorePostMeetingWorkflow(payload.eventId, payload.userId, workflowData);

      // Emit completion event
      await this.emitEnhancedEvent({
        eventType: 'analysis.completed',
        eventId: payload.eventId,
        userId: payload.userId,
        timestamp: new Date().toISOString(),
        data: {
          analysisResult: payload.analysisResult,
          calendarEvent: workflowData?.calendarEvent,
        },
        metadata: {
          source: 'enhanced.analysis.completed',
          integrationComplete: true,
        },
      });

      this.statistics.eventsProcessed++;
      this.statistics.workflowsTriggered++;

    } catch (error) {
      this.logger.error(`Error handling analysis completed: ${error.message}`);
      this.statistics.integrationErrors++;
    }
  }

  /**
   * Handle analysis failed events from enhanced services
   */
  @OnEvent('enhanced.analysis.failed')
  private async handleAnalysisFailed(payload: {
    sessionId: string;
    eventId: string;
    userId: string;
    error: string;
    timestamp: string;
  }): Promise<void> {
    this.logger.error(`❌ Analysis failed: ${payload.eventId} - Error: ${payload.error}`);

    try {
      // Update workflow data with error state
      const workflowData = this.activeWorkflows.get(payload.eventId);
      if (workflowData) {
        workflowData.dataConsistency.synchronized = false;
      }

      // Still try to trigger core workflow without enhanced analysis
      await this.triggerCorePostMeetingWorkflow(payload.eventId, payload.userId, workflowData);

      // Emit failure event
      await this.emitEnhancedEvent({
        eventType: 'analysis.failed',
        eventId: payload.eventId,
        userId: payload.userId,
        timestamp: new Date().toISOString(),
        data: {
          error: payload.error,
          calendarEvent: workflowData?.calendarEvent,
        },
        metadata: {
          source: 'enhanced.analysis.failed',
          fallbackTriggered: true,
        },
      });

      this.statistics.integrationErrors++;

    } catch (error) {
      this.logger.error(`Error handling analysis failure: ${error.message}`);
      this.statistics.integrationErrors++;
    }
  }

  /**
   * Trigger integrated analysis workflow with core calendar context
   */
  private async triggerIntegratedAnalysisWorkflow(
    eventId: string,
    userId: string,
    calendarEvent: CalendarEvent
  ): Promise<void> {
    this.logger.log(`🚀 Triggering integrated analysis workflow for: ${eventId}`);

    try {
      const workflowData = this.activeWorkflows.get(eventId);
      
      if (!workflowData?.recording && !workflowData?.transcript) {
        this.logger.warn(`No recording/transcript available for ${eventId} - checking for availability`);
        
        // Check if recording is available now
        const recordingStatus = await this.googleMeetingTracker.getMeetingRecordingStatus(eventId, userId);
        
        if (recordingStatus.available) {
          this.logger.log(`Recording now available for ${eventId} - proceeding with analysis`);
          
          // Get the recording and transcript
          const recording = await this.googleMeetingTracker.getMeetingRecording(eventId, userId);
          const transcript = await this.googleMeetingTracker.extractMeetingTranscript(eventId, userId);
          
          // Update workflow data
          if (workflowData) {
            workflowData.recording = recording || undefined;
            workflowData.transcript = transcript || undefined;
          }
          
          // Trigger analysis with all available data
          await this.meetingAnalysisTrigger.initiateMeetingAnalysisTrigger({
            eventId,
            userId,
            calendarEvent,
            triggerType: 'automatic',
            metadata: {
              transcript: transcript || undefined,
              recording: recording || undefined,
              preMeetingContext: workflowData?.preMeetingContext,
              meetingBrief: workflowData?.meetingBrief,
              source: 'integrated.analysis.workflow'
            }
          });
        } else {
          this.logger.log(`Recording not yet available for ${eventId} - analysis trigger will wait`);
          // The MeetingAnalysisTriggerService will handle periodic checks
        }
      } else {
        // We have recording/transcript, proceed with analysis
        await this.meetingAnalysisTrigger.initiateMeetingAnalysisTrigger({
          eventId,
          userId,
          calendarEvent,
          triggerType: 'automatic',
          metadata: {
            transcript: workflowData.transcript,
            recording: workflowData.recording,
            preMeetingContext: workflowData.preMeetingContext,
            meetingBrief: workflowData.meetingBrief,
            source: 'integrated.analysis.direct'
          }
        });
      }

    } catch (error) {
      this.logger.error(`Error triggering integrated analysis workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger core calendar post-meeting workflow with enhanced data
   */
  private async triggerCorePostMeetingWorkflow(
    eventId: string,
    userId: string,
    workflowData?: IntegratedWorkflowData
  ): Promise<void> {
    this.logger.log(`🎬 Triggering core post-meeting workflow for: ${eventId}`);

    try {
      // Get core calendar context
      const coreContext = await this.getCoreWorkflowContext(eventId, userId);

      // Prepare enhanced input for unified workflow
      const enhancedInput = {
        type: 'post_meeting_orchestration',
        eventId,
        userId,
        calendarEvent: workflowData?.calendarEvent,
        meetingAnalysisResult: workflowData?.analysisResult,
        metadata: {
          // Core calendar data
          preMeetingContext: workflowData?.preMeetingContext || coreContext?.preMeetingContext,
          meetingBrief: workflowData?.meetingBrief || coreContext?.meetingBrief,
          
          // Enhanced meeting data
          meetingSession: workflowData?.meetingSession,
          recording: workflowData?.recording,
          transcript: workflowData?.transcript,
          
          // Integration metadata
          integrationVersion: workflowData?.workflowVersion || '2.0',
          enhancedDataAvailable: !!(workflowData?.recording || workflowData?.transcript),
          analysisCompleted: !!workflowData?.analysisResult,
          workflowIntegrated: true,
        },
      };

      // Trigger unified workflow with enhanced data
      const result = await this.unifiedWorkflowService.processInput(enhancedInput, enhancedInput.metadata, userId);

      this.logger.log(`✅ Core post-meeting workflow triggered successfully: ${result.sessionId}`);

    } catch (error) {
      this.logger.error(`Error triggering core post-meeting workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get core calendar workflow context
   */
  private async getCoreWorkflowContext(eventId: string, userId: string): Promise<any> {
    try {
      // This would integrate with existing core calendar services
      // For now, return basic context
      return {
        eventId,
        userId,
        source: 'core_calendar',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(`Could not retrieve core workflow context: ${error.message}`);
      return null;
    }
  }

  /**
   * Emit enhanced workflow event
   */
  private async emitEnhancedEvent(event: CalendarWorkflowEvent): Promise<void> {
    try {
      this.eventQueue.push(event);
      this.eventEmitter.emit(`enhanced.workflow.${event.eventType}`, event);
    } catch (error) {
      this.logger.error(`Error emitting enhanced event: ${error.message}`);
    }
  }

  /**
   * Start processing queued events
   */
  private startEventQueueProcessing(): void {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;
    setInterval(async () => {
      if (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          try {
            await this.processQueuedEvent(event);
          } catch (error) {
            this.logger.error(`Error processing queued event: ${error.message}`);
          }
        }
      }
    }, 1000); // Process every second
  }

  /**
   * Process a queued event
   */
  private async processQueuedEvent(event: CalendarWorkflowEvent): Promise<void> {
    this.logger.debug(`Processing queued event: ${event.eventType} for ${event.eventId}`);

    switch (event.eventType) {
      case 'meeting.started':
        await this.processStartedMeetingEvent(event);
        break;
      case 'meeting.ended':
        await this.processEndedMeetingEvent(event);
        break;
      case 'recording.available':
        await this.processRecordingAvailableEvent(event);
        break;
      case 'analysis.completed':
        await this.processAnalysisCompletedEvent(event);
        break;
    }
  }

  private async processStartedMeetingEvent(event: CalendarWorkflowEvent): Promise<void> {
    // Additional processing for started meetings
    this.logger.debug(`Enhanced processing for meeting started: ${event.eventId}`);
  }

  private async processEndedMeetingEvent(event: CalendarWorkflowEvent): Promise<void> {
    // Additional processing for ended meetings
    this.logger.debug(`Enhanced processing for meeting ended: ${event.eventId}`);
  }

  private async processRecordingAvailableEvent(event: CalendarWorkflowEvent): Promise<void> {
    // Additional processing for recording availability
    this.logger.debug(`Enhanced processing for recording available: ${event.eventId}`);
  }

  private async processAnalysisCompletedEvent(event: CalendarWorkflowEvent): Promise<void> {
    // Additional processing for completed analysis
    this.logger.debug(`Enhanced processing for analysis completed: ${event.eventId}`);
  }

  /**
   * Get integration status
   */
  getIntegrationStatus(): WorkflowIntegrationStatus {
    return {
      coreConnected: true, // Assuming core calendar is always connected
      enhancedServicesActive: !!(this.googleMeetingTracker && this.meetingAnalysisTrigger),
      eventListenersRegistered: true,
      activeIntegrations: {
        meetingTracker: !!this.googleMeetingTracker,
        analysisTrigger: !!this.meetingAnalysisTrigger,
        calendarWorkflow: !!this.calendarWorkflowService,
        unifiedWorkflow: !!this.unifiedWorkflowService,
      },
      statistics: { ...this.statistics },
    };
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows(): IntegratedWorkflowData[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get specific workflow data
   */
  getWorkflowData(eventId: string): IntegratedWorkflowData | undefined {
    return this.activeWorkflows.get(eventId);
  }

  /**
   * Clean up completed workflows
   */
  cleanupCompletedWorkflows(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [eventId, workflowData] of this.activeWorkflows.entries()) {
      const integratedTime = new Date(workflowData.integratedAt);
      
      if (integratedTime < cutoffTime && workflowData.analysisResult) {
        this.activeWorkflows.delete(eventId);
        cleanedCount++;
      }
    }

    this.logger.log(`🧹 Cleaned up ${cleanedCount} completed workflows older than ${olderThanHours} hours`);
    return cleanedCount;
  }
} 