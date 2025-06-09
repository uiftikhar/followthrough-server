import { Injectable, Logger } from '@nestjs/common';
import { TeamHandler } from '../../langgraph/core/interfaces/team-handler.interface';
import { CalendarSyncService } from './calendar-sync.service';
import { BriefDeliveryService } from './brief-delivery.service';
import { CalendarAgentFactory } from '../agents/calendar-agent.factory';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { MeetingContext, MeetingContextOptions } from '../interfaces/meeting-context.interface';
import { MeetingBrief, BriefGenerationOptions } from '../interfaces/meeting-brief.interface';

export interface CalendarWorkflowState {
  sessionId: string;
  type: 'calendar_sync' | 'meeting_brief' | 'meeting_prep';
  userId: string;
  calendarEvent?: CalendarEvent;
  upcomingEvents?: CalendarEvent[];
  meetingBrief?: MeetingBrief;
  meetingContext?: MeetingContext;
  stage: string;
  context?: any;
  error?: string;
}

@Injectable()
export class CalendarWorkflowService implements TeamHandler<any, CalendarWorkflowState> {
  private readonly logger = new Logger(CalendarWorkflowService.name);

  constructor(
    private readonly calendarSyncService: CalendarSyncService,
    private readonly briefDeliveryService: BriefDeliveryService,
    private readonly calendarAgentFactory: CalendarAgentFactory,
  ) {}

  /**
   * Process calendar workflow input
   */
  async process(input: any): Promise<CalendarWorkflowState> {
    this.logger.log(`Processing calendar workflow input: ${JSON.stringify(input)}`);
    
    try {
      // Determine workflow type
      const workflowType = this.determineWorkflowType(input);
      const userId = input.userId || input.user?.id || 'default';
      const sessionId = input.sessionId || `calendar-${Date.now()}`;

      // Initialize state
      const initialState: CalendarWorkflowState = {
        sessionId,
        type: workflowType,
        userId,
        stage: 'initialization',
        context: input.metadata || {},
      };

      // Process based on workflow type
      switch (workflowType) {
        case 'calendar_sync':
          return this.processCalendarSync(initialState);
        
        case 'meeting_brief':
          return this.processMeetingBrief(initialState, input.calendarEvent);
        
        case 'meeting_prep':
          return this.processMeetingPrep(initialState);
        
        default:
          throw new Error(`Unknown calendar workflow type: ${workflowType}`);
      }
      
    } catch (error) {
      this.logger.error(`Error processing calendar workflow: ${error.message}`);
      return this.createErrorResult(input, error.message);
    }
  }

  /**
   * Get team name for registration
   */
  getTeamName(): string {
    return 'calendar_workflow';
  }

  /**
   * Determine workflow type from input
   */
  private determineWorkflowType(input: any): 'calendar_sync' | 'meeting_brief' | 'meeting_prep' {
    if (input.type) {
      return input.type;
    }

    // Auto-detect based on input content
    if (input.calendarEvent || input.eventId) {
      return 'meeting_brief';
    }

    if (input.action === 'sync' || input.sync) {
      return 'calendar_sync';
    }

    // Default to calendar sync
    return 'calendar_sync';
  }

  /**
   * Process calendar sync workflow
   */
  private async processCalendarSync(state: CalendarWorkflowState): Promise<CalendarWorkflowState> {
    this.logger.log(`Processing calendar sync for user ${state.userId}`);
    
    try {
      // Sync user's calendar
      const upcomingEvents = await this.calendarSyncService.syncUserCalendar(state.userId);
      
      return {
        ...state,
        upcomingEvents,
        stage: 'sync_completed',
      };
      
    } catch (error) {
      this.logger.error(`Error in calendar sync: ${error.message}`);
      return {
        ...state,
        stage: 'sync_failed',
        error: error.message,
      };
    }
  }

  /**
   * Process meeting brief generation (Phase 2 implementation)
   */
  private async processMeetingBrief(
    state: CalendarWorkflowState, 
    calendarEvent?: CalendarEvent
  ): Promise<CalendarWorkflowState> {
    this.logger.log(`Processing meeting brief for event: ${calendarEvent?.title || 'unknown'}`);
    
    if (!calendarEvent) {
      return {
        ...state,
        stage: 'brief_failed',
        error: 'No calendar event provided for brief generation',
      };
    }

    try {
      // Step 1: Gather meeting context using MeetingContextAgent
      this.logger.log('Step 1: Gathering meeting context');
      const contextAgent = this.calendarAgentFactory.getMeetingContextAgent();
      const contextOptions: MeetingContextOptions = {
        lookbackDays: 90,
        maxPreviousMeetings: 10,
        includeParticipantHistory: true,
        includeTopicPredictions: true,
        useRAG: true
      };
      
      const meetingContext = await contextAgent.gatherMeetingContext(calendarEvent, contextOptions);
      
      // Step 2: Generate meeting brief using MeetingBriefAgent
      this.logger.log('Step 2: Generating meeting brief');
      const briefAgent = this.calendarAgentFactory.getMeetingBriefAgent();
      const briefOptions: BriefGenerationOptions = {
        includeDetailedAgenda: true,
        includeParticipantPrep: true,
        includeTimeManagement: true,
        includeDeliveryFormats: true,
        complexity: 'standard',
        focusAreas: ['agenda', 'preparation', 'objectives'],
        deliveryFormat: ['email', 'calendar'],
        useRAG: true
      };
      
      const meetingBrief = await briefAgent.generateMeetingBrief(calendarEvent, meetingContext, briefOptions);
      
      // Step 3: Deliver the brief (optional, based on configuration)
      this.logger.log('Step 3: Brief generation completed');
      
      return {
        ...state,
        calendarEvent,
        meetingContext,
        meetingBrief,
        stage: 'brief_completed',
        context: {
          ...state.context,
          briefGenerated: true,
          briefId: meetingBrief.briefId,
          contextConfidence: meetingContext.retrievalMetadata.confidence,
          briefConfidence: meetingBrief.generationMetadata.confidence,
        },
      };
      
    } catch (error) {
      this.logger.error(`Error generating meeting brief: ${error.message}`);
      return {
        ...state,
        calendarEvent,
        stage: 'brief_failed',
        error: error.message,
      };
    }
  }

  /**
   * Deliver meeting brief through specified channels
   */
  async deliverMeetingBrief(
    briefId: string,
    deliveryMethods: Array<'email' | 'slack' | 'calendar'> = ['email'],
    options?: {
      scheduleDelivery?: boolean;
      hoursBeforeMeeting?: number;
      customRecipients?: string[];
    }
  ): Promise<any> {
    this.logger.log(`Delivering meeting brief ${briefId} via: ${deliveryMethods.join(', ')}`);
    
    try {
      // In a real implementation, we would retrieve the brief from storage
      // For now, this is a placeholder that demonstrates the delivery flow
      
      const deliveryOptions = {
        emailRecipients: options?.customRecipients,
        scheduleDelivery: options?.scheduleDelivery ? new Date().toISOString() : undefined,
      };

      // TODO: Retrieve brief from storage and deliver
      // const brief = await this.getBriefById(briefId);
      // const deliveryResults = await this.briefDeliveryService.deliverBrief(brief, deliveryMethods, deliveryOptions);
      
      this.logger.log(`Brief delivery initiated for ${briefId}`);
      return {
        success: true,
        briefId,
        deliveryMethods,
        message: 'Brief delivery initiated successfully'
      };
      
    } catch (error) {
      this.logger.error(`Error delivering brief ${briefId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process meeting preparation workflow
   */
  private async processMeetingPrep(state: CalendarWorkflowState): Promise<CalendarWorkflowState> {
    this.logger.log(`Processing meeting preparation for user ${state.userId}`);
    
    try {
      // Get events happening soon
      const eventsHappeningSoon = await this.calendarSyncService.getEventsHappeningSoon(state.userId);
      
      return {
        ...state,
        upcomingEvents: eventsHappeningSoon,
        stage: 'prep_ready',
        context: {
          ...state.context,
          eventsNeedingPrep: eventsHappeningSoon.length,
        },
      };
      
    } catch (error) {
      this.logger.error(`Error in meeting prep: ${error.message}`);
      return {
        ...state,
        stage: 'prep_failed',
        error: error.message,
      };
    }
  }

  /**
   * Create error result state
   */
  private createErrorResult(input: any, errorMessage: string): CalendarWorkflowState {
    return {
      sessionId: input.sessionId || `error-${Date.now()}`,
      type: 'calendar_sync',
      userId: input.userId || 'unknown',
      stage: 'error',
      error: errorMessage,
    };
  }

  /**
   * Check if input can be handled by this team
   */
  async canHandle(input: any): Promise<boolean> {
    // Handle calendar-related inputs
    return !!(
      input.type === 'calendar_sync' ||
      input.type === 'meeting_brief' ||
      input.type === 'meeting_prep' ||
      input.calendarEvent ||
      input.eventId ||
      input.action === 'sync'
    );
  }
} 