import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CalendarWorkflowSessionRepository } from '../repositories/calendar-workflow-session.repository';
import { PreMeetingContextAgent } from '../agents/pre-meeting-context.agent';
import { MeetingBriefGenerationAgent } from '../agents/meeting-brief-generation.agent';
import {
  CalendarWorkflowState,
  CalendarWorkflowStage,
  CalendarWorkflowStep,
  CalendarWorkflowOptions
} from '../interfaces/calendar-workflow-state.interface';
import { CalendarEvent } from '../../../calendar/interfaces/calendar-event.interface';

export interface WorkflowStartOptions {
  calendarEvent: CalendarEvent;
  userId: string;
  options?: CalendarWorkflowOptions;
}

export interface WorkflowExecutionResult {
  sessionId: string;
  status: 'completed' | 'failed' | 'in_progress';
  stage: CalendarWorkflowStage;
  progress: number;
  error?: string;
  result?: CalendarWorkflowState;
}

@Injectable()
export class CalendarWorkflowService {
  private readonly logger = new Logger(CalendarWorkflowService.name);
  private readonly activeWorkflows = new Map<string, CalendarWorkflowState>();

  constructor(
    private readonly sessionRepository: CalendarWorkflowSessionRepository,
    private readonly preContextAgent: PreMeetingContextAgent,
    private readonly briefGenerationAgent: MeetingBriefGenerationAgent,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start a new calendar workflow session
   */
  async startWorkflow(options: WorkflowStartOptions): Promise<WorkflowExecutionResult> {
    const sessionId = `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`Starting calendar workflow session: ${sessionId}`);

    try {
      // Initialize workflow state
      const initialState: CalendarWorkflowState = {
        sessionId,
        userId: options.userId,
        eventId: options.calendarEvent.id,
        calendarEvent: options.calendarEvent,
        meetingStatus: 'scheduled',
        preContext: null,
        meetingBrief: null,
        meetingTranscript: null,
        meetingRecording: null,
        analysisResult: null,
        followUpPlan: null,
        stage: CalendarWorkflowStage.INITIALIZED,
        currentStep: CalendarWorkflowStep.START,
        progress: 0,
        error: null,
        context: options.options || {},
        metadata: {
          startedAt: new Date().toISOString(),
          workflowType: 'calendar',
          userId: options.userId
        },
        processingMetadata: {
          agentsUsed: [],
          ragEnhanced: options.options?.useRAG !== false,
          performanceMetrics: {},
          startTime: new Date().toISOString()
        },
        autonomyLevel: options.options?.autonomyLevel || 'assisted',
        approvalRequired: false,
        userInteractions: []
      };

      // Save initial state
      await this.sessionRepository.createSession(initialState);
      this.activeWorkflows.set(sessionId, initialState);

      // Emit workflow started event
      this.eventEmitter.emit('calendar.workflow.started', {
        sessionId,
        eventId: options.calendarEvent.id,
        calendarEvent: options.calendarEvent
      });

      // Start workflow execution
      const result = await this.executeWorkflow(sessionId);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error starting workflow session ${sessionId}: ${errorMessage}`);
      
      return {
        sessionId,
        status: 'failed',
        stage: CalendarWorkflowStage.ERROR,
        progress: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Execute the complete workflow
   */
  private async executeWorkflow(sessionId: string): Promise<WorkflowExecutionResult> {
    let currentState = this.activeWorkflows.get(sessionId);
    
    if (!currentState) {
      throw new Error(`Workflow session ${sessionId} not found`);
    }

    try {
      // Phase 1: Pre-meeting context gathering
      this.logger.log(`Phase 1: Gathering pre-meeting context for ${sessionId}`);
      currentState = await this.executePreMeetingContext(currentState);
      await this.saveStateAndEmitProgress(currentState);

      // Phase 2: Meeting brief generation (if enabled)
      if (currentState.context.generateBrief !== false) {
        this.logger.log(`Phase 2: Generating meeting brief for ${sessionId}`);
        currentState = await this.executeBriefGeneration(currentState);
        await this.saveStateAndEmitProgress(currentState);
      }

      // Phase 3: Brief delivery (if enabled and brief was generated)
      if (currentState.meetingBrief && currentState.context.deliverBrief !== false) {
        this.logger.log(`Phase 3: Delivering meeting brief for ${sessionId}`);
        currentState = await this.executeBriefDelivery(currentState);
        await this.saveStateAndEmitProgress(currentState);
      }

      // Complete workflow
      currentState = await this.completeWorkflow(currentState);
      await this.saveStateAndEmitProgress(currentState);

      // Remove from active workflows
      this.activeWorkflows.delete(sessionId);

      this.logger.log(`Calendar workflow completed successfully for session: ${sessionId}`);

      return {
        sessionId,
        status: 'completed',
        stage: currentState.stage as CalendarWorkflowStage,
        progress: currentState.progress,
        result: currentState
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error executing workflow ${sessionId}: ${errorMessage}`);
      
      // Update state with error
      currentState = {
        ...currentState,
        stage: CalendarWorkflowStage.ERROR,
        error: errorMessage,
        processingMetadata: {
          ...currentState.processingMetadata,
          endTime: new Date().toISOString()
        }
      };

      await this.saveStateAndEmitProgress(currentState);
      this.activeWorkflows.delete(sessionId);

      this.eventEmitter.emit('calendar.workflow.error', {
        sessionId,
        error: errorMessage,
        stage: currentState.stage as CalendarWorkflowStage
      });

      return {
        sessionId,
        status: 'failed',
        stage: currentState.stage as CalendarWorkflowStage,
        progress: currentState.progress,
        error: errorMessage
      };
    }
  }

  /**
   * Execute pre-meeting context gathering phase
   */
  private async executePreMeetingContext(state: CalendarWorkflowState): Promise<CalendarWorkflowState> {
    this.logger.log(`Executing pre-meeting context for session: ${state.sessionId}`);

    const updatedState = {
      ...state,
      stage: CalendarWorkflowStage.PRE_MEETING_CONTEXT,
      currentStep: CalendarWorkflowStep.GATHER_CONTEXT,
      progress: 10
    };

    // Execute pre-meeting context agent
    const result = await this.preContextAgent.processState(updatedState);

    this.logger.log(`Pre-meeting context completed for session: ${state.sessionId}`);
    return result;
  }

  /**
   * Execute meeting brief generation phase
   */
  private async executeBriefGeneration(state: CalendarWorkflowState): Promise<CalendarWorkflowState> {
    this.logger.log(`Executing brief generation for session: ${state.sessionId}`);

    const updatedState = {
      ...state,
      stage: CalendarWorkflowStage.BRIEF_GENERATION,
      currentStep: CalendarWorkflowStep.GENERATE_BRIEF,
      progress: 40
    };

    // Execute meeting brief generation agent
    const result = await this.briefGenerationAgent.processState(updatedState);

    // Emit brief generated event
    if (result.meetingBrief) {
      this.eventEmitter.emit('calendar.brief.generated', {
        sessionId: state.sessionId,
        brief: result.meetingBrief
      });
    }

    this.logger.log(`Brief generation completed for session: ${state.sessionId}`);
    return result;
  }

  /**
   * Execute brief delivery phase
   */
  private async executeBriefDelivery(state: CalendarWorkflowState): Promise<CalendarWorkflowState> {
    this.logger.log(`Executing brief delivery for session: ${state.sessionId}`);

    const updatedState = {
      ...state,
      stage: CalendarWorkflowStage.BRIEF_DELIVERY,
      currentStep: CalendarWorkflowStep.DELIVER_BRIEF,
      progress: 70,
      briefDeliveryStatus: {
        delivered: true,
        deliveryMethods: ['email', 'calendar'],
        deliveryTime: new Date().toISOString(),
        recipients: state.preContext?.participantAnalysis.map(p => p.email) || []
      }
    };

    // Simulate brief delivery (would integrate with actual delivery services)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Emit brief delivered event
    this.eventEmitter.emit('calendar.brief.delivered', {
      sessionId: state.sessionId,
      deliveryStatus: updatedState.briefDeliveryStatus
    });

    this.logger.log(`Brief delivery completed for session: ${state.sessionId}`);
    return updatedState;
  }

  /**
   * Complete the workflow
   */
  private async completeWorkflow(state: CalendarWorkflowState): Promise<CalendarWorkflowState> {
    this.logger.log(`Completing workflow for session: ${state.sessionId}`);

    const finalState = {
      ...state,
      stage: CalendarWorkflowStage.COMPLETED,
      currentStep: CalendarWorkflowStep.END,
      progress: 100,
      processingMetadata: {
        ...state.processingMetadata,
        endTime: new Date().toISOString()
      }
    };

    // Emit workflow completed event
    this.eventEmitter.emit('calendar.workflow.completed', {
      sessionId: state.sessionId,
      finalState
    });

    return finalState;
  }

  /**
   * Save state to database and emit progress event
   */
  private async saveStateAndEmitProgress(state: CalendarWorkflowState): Promise<void> {
    try {
      await this.sessionRepository.updateSession(state.sessionId, state);
      this.activeWorkflows.set(state.sessionId, state);

      // Emit progress event
      this.eventEmitter.emit('calendar.workflow.progress', {
        sessionId: state.sessionId,
        stage: state.stage,
        progress: state.progress,
        currentStep: state.currentStep
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error saving workflow state: ${errorMessage}`);
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(sessionId: string): Promise<WorkflowExecutionResult | null> {
    try {
      // Check active workflows first
      const activeState = this.activeWorkflows.get(sessionId);
      if (activeState) {
        return {
          sessionId,
          status: 'in_progress',
          stage: activeState.stage as CalendarWorkflowStage,
          progress: activeState.progress,
          result: activeState
        };
      }

      // Check database
      const state = await this.sessionRepository.getSession(sessionId);
      if (!state) {
        return null;
      }

      const status = state.stage === CalendarWorkflowStage.COMPLETED ? 'completed' :
                    state.stage === CalendarWorkflowStage.ERROR ? 'failed' : 'in_progress';

      return {
        sessionId,
        status,
        stage: state.stage as CalendarWorkflowStage,
        progress: state.progress,
        error: state.error || undefined,
        result: state
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error getting workflow status: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Cancel an active workflow
   */
  async cancelWorkflow(sessionId: string): Promise<boolean> {
    try {
      const state = this.activeWorkflows.get(sessionId);
      if (!state) {
        this.logger.warn(`Attempted to cancel non-existent workflow: ${sessionId}`);
        return false;
      }

      // Update state to cancelled
      const cancelledState = {
        ...state,
        stage: CalendarWorkflowStage.ERROR,
        error: 'Workflow cancelled by user',
        processingMetadata: {
          ...state.processingMetadata,
          endTime: new Date().toISOString()
        }
      };

      await this.sessionRepository.updateSession(sessionId, cancelledState);
      this.activeWorkflows.delete(sessionId);

      this.eventEmitter.emit('calendar.workflow.cancelled', {
        sessionId,
        reason: 'User cancellation'
      });

      this.logger.log(`Workflow cancelled: ${sessionId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error cancelling workflow: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get workflow statistics for a user
   */
  async getUserWorkflowStats(userId: string): Promise<{
    totalWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    averageCompletionTime: number;
    recentWorkflows: any[];
  }> {
    try {
      const stats = await this.sessionRepository.getSessionStats(userId);
      
      return {
        totalWorkflows: stats.totalSessions,
        completedWorkflows: stats.completedSessions,
        failedWorkflows: stats.erroredSessions,
        averageCompletionTime: stats.averageProcessingTimeMs,
        recentWorkflows: [] // TODO: Implement recent workflows query
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error getting user workflow stats: ${errorMessage}`);
      return {
        totalWorkflows: 0,
        completedWorkflows: 0,
        failedWorkflows: 0,
        averageCompletionTime: 0,
        recentWorkflows: []
      };
    }
  }

  /**
   * Event handler for calendar events
   */
  @OnEvent('calendar.meeting.created')
  async handleMeetingCreated(payload: { eventId: string; calendarEvent: CalendarEvent; userId: string }): Promise<void> {
    this.logger.log(`Handling meeting created event: ${payload.eventId}`);

    try {
      // Auto-start workflow for new meetings (if configured)
      const autoStartEnabled = true; // This would come from configuration
      
      if (autoStartEnabled) {
        await this.startWorkflow({
          calendarEvent: payload.calendarEvent,
          userId: payload.userId,
          options: {
            generateBrief: true,
            deliverBrief: true,
            useRAG: true,
            autonomyLevel: 'assisted'
          }
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling meeting created event: ${errorMessage}`);
    }
  }

  @OnEvent('calendar.meeting.started')
  async handleMeetingStarted(payload: { sessionId: string; eventId: string }): Promise<void> {
    this.logger.log(`Handling meeting started event: ${payload.eventId}`);

    try {
      // Update meeting status in workflow state
      const state = await this.sessionRepository.getSession(payload.sessionId);
      if (state) {
        const updatedState = { ...state.toObject() };
        updatedState.meetingStatus = 'started';
        await this.sessionRepository.updateSession(payload.sessionId, updatedState);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling meeting started event: ${errorMessage}`);
    }
  }

  @OnEvent('calendar.meeting.ended')
  async handleMeetingEnded(payload: { sessionId: string; eventId: string; recordingData?: any }): Promise<void> {
    this.logger.log(`Handling meeting ended event: ${payload.eventId}`);

    try {
      // Update meeting status and trigger post-meeting workflow
      const state = await this.sessionRepository.getSession(payload.sessionId);
      if (state) {
        const updatedState = { ...state.toObject() };
        updatedState.meetingStatus = 'ended';
        updatedState.meetingRecording = payload.recordingData || null;
        
        // Start post-meeting processing if enabled
        if (updatedState.context.processPostMeeting !== false) {
          // This would trigger meeting analysis workflow
          this.eventEmitter.emit('meeting.analysis.trigger', {
            sessionId: payload.sessionId,
            meetingId: payload.eventId,
            recordingData: payload.recordingData
          });
        }

        await this.sessionRepository.updateSession(payload.sessionId, updatedState);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Error handling meeting ended event: ${errorMessage}`);
    }
  }
}
