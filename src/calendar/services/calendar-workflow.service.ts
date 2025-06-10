import { Injectable, Logger } from '@nestjs/common';
import { TeamHandler } from '../../langgraph/core/interfaces/team-handler.interface';
import { CalendarSyncService } from './calendar-sync.service';
import { BriefDeliveryService } from './brief-delivery.service';
import { CalendarAgentFactory } from '../agents/calendar-agent.factory';
import { CalendarWorkflowGraphBuilder } from '../builders/calendar-workflow-graph.builder';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { MeetingContext, MeetingContextOptions } from '../interfaces/meeting-context.interface';
import { MeetingBrief, BriefGenerationOptions } from '../interfaces/meeting-brief.interface';

export interface CalendarWorkflowState {
  sessionId: string;
  type: 'calendar_sync' | 'meeting_brief' | 'meeting_prep' | 'post_meeting';
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
  private builtGraph: any;

  constructor(
    private readonly calendarSyncService: CalendarSyncService,
    private readonly briefDeliveryService: BriefDeliveryService,
    private readonly calendarAgentFactory: CalendarAgentFactory,
    private readonly calendarWorkflowGraphBuilder: CalendarWorkflowGraphBuilder,
  ) {
    // Build the graph during service initialization
    this.initializeGraph();
  }

  /**
   * Initialize the calendar workflow graph
   */
  private async initializeGraph(): Promise<void> {
    try {
      this.logger.log('🏗️ Building calendar workflow graph...');
      this.builtGraph = await this.calendarWorkflowGraphBuilder.buildGraph();
      this.logger.log('✅ Calendar workflow graph built successfully');
    } catch (error) {
      this.logger.error(`❌ Failed to build calendar workflow graph: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process calendar workflow input using the built graph
   */
  async process(input: any): Promise<CalendarWorkflowState> {
    this.logger.log(`🚀 Processing calendar workflow input: ${JSON.stringify({ type: input.type, userId: input.userId, sessionId: input.sessionId })}`);
    
    try {
      // Ensure graph is built
      if (!this.builtGraph) {
        await this.initializeGraph();
      }

      // Determine workflow type and prepare initial state
      const workflowType = this.determineWorkflowType(input);
      const userId = input.userId || input.user?.id || 'default';
      const sessionId = input.sessionId || `calendar-${Date.now()}`;

      // Create initial state for graph execution
      const initialState: CalendarWorkflowState = {
        sessionId,
        type: workflowType,
        userId,
        calendarEvent: input.calendarEvent || input.event,
        stage: 'initialization',
        context: {
          ...input.metadata,
          inputReceived: new Date().toISOString(),
          originalInput: input,
        },
      };

      this.logger.log(`📊 Executing calendar workflow graph for type: ${workflowType}`);

      // Execute the workflow through the graph
      const finalState = await this.builtGraph.execute(initialState);

      this.logger.log(`✅ Calendar workflow completed for session ${sessionId} with stage: ${finalState.stage}`);
      
      return finalState;
      
    } catch (error) {
      this.logger.error(`❌ Error processing calendar workflow: ${error.message}`, error.stack);
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
   * Check if input can be handled by this team
   */
  async canHandle(input: any): Promise<boolean> {
    // Handle calendar-related inputs
    const canHandle = !!(
      input.type === 'calendar_sync' ||
      input.type === 'meeting_brief' ||
      input.type === 'meeting_prep' ||
      input.type === 'post_meeting' ||
      input.calendarEvent ||
      input.eventId ||
      input.action === 'sync' ||
      input.workflow === 'calendar'
    );

    this.logger.debug(`🔍 Can handle input: ${canHandle} for type: ${input.type}`);
    return canHandle;
  }

  // ================================
  // ENHANCED WORKFLOW METHODS
  // ================================

  /**
   * Generate meeting brief with comprehensive context (Enhanced Phase 2 Implementation)
   */
  async generateMeetingBrief(
    calendarEvent: CalendarEvent,
    options?: {
      useGraph?: boolean;
      contextOptions?: MeetingContextOptions;
      briefOptions?: BriefGenerationOptions;
      deliveryMethods?: Array<'email' | 'slack' | 'calendar'>;
    }
  ): Promise<CalendarWorkflowState> {
    this.logger.log(`📝 Generating enhanced meeting brief for: ${calendarEvent.title}`);

    const input = {
      type: 'meeting_brief',
      calendarEvent,
      userId: calendarEvent.organizer?.email || 'default',
      metadata: options,
    };

    if (options?.useGraph !== false) {
      // Use graph-based execution for full workflow
      return this.process(input);
    } else {
      // Direct execution for backwards compatibility
      return this.processMeetingBriefDirect(input, calendarEvent);
    }
  }

  /**
   * Sync calendar with intelligent event detection
   */
  async syncCalendarIntelligent(
    userId: string,
    options?: {
      detectUpcomingMeetings?: boolean;
      generateBriefsForUpcoming?: boolean;
      triggerPreMeetingPrep?: boolean;
    }
  ): Promise<CalendarWorkflowState> {
    this.logger.log(`🔄 Intelligent calendar sync for user: ${userId}`);

    const input = {
      type: 'calendar_sync',
      userId,
      metadata: {
        intelligent: true,
        ...options,
      },
    };

    return this.process(input);
  }

  /**
   * Prepare for upcoming meetings with context gathering
   */
  async prepareUpcomingMeetings(
    userId: string,
    options?: {
      hoursAhead?: number;
      generateBriefs?: boolean;
      prioritizeByImportance?: boolean;
    }
  ): Promise<CalendarWorkflowState> {
    this.logger.log(`🎯 Preparing upcoming meetings for user: ${userId}`);

    const input = {
      type: 'meeting_prep',
      userId,
      metadata: {
        hoursAhead: options?.hoursAhead || 2,
        generateBriefs: options?.generateBriefs !== false,
        prioritizeByImportance: options?.prioritizeByImportance !== false,
      },
    };

    return this.process(input);
  }

  /**
   * Handle post-meeting orchestration
   */
  async orchestratePostMeeting(
    calendarEvent: CalendarEvent,
    meetingAnalysisResult?: any,
    options?: {
      generateFollowUps?: boolean;
      scheduleNextMeetings?: boolean;
      updateActionItems?: boolean;
    }
  ): Promise<CalendarWorkflowState> {
    this.logger.log(`🎬 Orchestrating post-meeting workflow for: ${calendarEvent.title}`);

    const input = {
      type: 'post_meeting',
      calendarEvent,
      userId: calendarEvent.organizer?.email || 'default',
      metadata: {
        meetingAnalysisResult,
        ...options,
      },
    };

    return this.process(input);
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
      priority?: 'high' | 'medium' | 'low';
    }
  ): Promise<any> {
    this.logger.log(`📧 Delivering meeting brief ${briefId} via: ${deliveryMethods.join(', ')}`);
    
    try {
      const deliveryOptions = {
        emailRecipients: options?.customRecipients,
        scheduleDelivery: options?.scheduleDelivery ? new Date().toISOString() : undefined,
        priority: options?.priority || 'medium',
        hoursBeforeMeeting: options?.hoursBeforeMeeting || 0.5,
      };

      // In production, this would retrieve the brief from storage and use BriefDeliveryService
      const deliveryResult = await this.briefDeliveryService.deliverBrief(
        { briefId } as any, // Placeholder - would be actual brief object
        deliveryMethods,
        deliveryOptions
      );
      
      this.logger.log(`✅ Brief delivery completed for ${briefId}`);
      return {
        success: true,
        briefId,
        deliveryMethods,
        deliveryResult,
        message: 'Brief delivery completed successfully'
      };
      
    } catch (error) {
      this.logger.error(`❌ Error delivering brief ${briefId}: ${error.message}`);
      throw error;
    }
  }

  // ================================
  // WORKFLOW ROUTING & UTILITIES
  // ================================

  /**
   * Determine workflow type from input with enhanced detection
   */
  private determineWorkflowType(input: any): CalendarWorkflowState['type'] {
    if (input.type) {
      return input.type;
    }

    // Enhanced auto-detection based on input content
    if (input.calendarEvent || input.eventId) {
      // Check if this is post-meeting
      if (input.metadata?.meetingAnalysisResult || input.transcript || input.meetingEnded) {
        return 'post_meeting';
      }
      return 'meeting_brief';
    }

    if (input.action === 'sync' || input.sync || input.workflow === 'sync') {
      return 'calendar_sync';
    }

    if (input.action === 'prep' || input.preparation || input.upcoming) {
      return 'meeting_prep';
    }

    if (input.action === 'post_meeting' || input.orchestrate || input.followUp) {
      return 'post_meeting';
    }

    // Default to calendar sync
    return 'calendar_sync';
  }

  /**
   * Direct meeting brief processing (backwards compatibility)
   */
  private async processMeetingBriefDirect(
    input: any,
    calendarEvent: CalendarEvent
  ): Promise<CalendarWorkflowState> {
    this.logger.log(`📝 Direct meeting brief processing for: ${calendarEvent.title}`);
    
    const sessionId = input.sessionId || `brief-${Date.now()}`;
    const state: CalendarWorkflowState = {
      sessionId,
      type: 'meeting_brief',
      userId: input.userId,
      calendarEvent,
      stage: 'processing',
    };

    try {
      // Step 1: Gather meeting context using MeetingContextAgent
      this.logger.log('📊 Step 1: Gathering meeting context');
      const contextAgent = this.calendarAgentFactory.getMeetingContextAgent();
      const contextOptions: MeetingContextOptions = {
        lookbackDays: input.metadata?.contextOptions?.lookbackDays || 90,
        maxPreviousMeetings: input.metadata?.contextOptions?.maxPreviousMeetings || 10,
        includeParticipantHistory: true,
        includeTopicPredictions: true,
        useRAG: true
      };
      
      const meetingContext = await contextAgent.gatherMeetingContext(calendarEvent, contextOptions);
      
      // Step 2: Generate meeting brief using MeetingBriefAgent
      this.logger.log('📋 Step 2: Generating meeting brief');
      const briefAgent = this.calendarAgentFactory.getMeetingBriefAgent();
      const briefOptions: BriefGenerationOptions = {
        includeDetailedAgenda: true,
        includeParticipantPrep: true,
        includeTimeManagement: true,
        includeDeliveryFormats: true,
        complexity: 'standard',
        focusAreas: ['agenda', 'preparation', 'objectives'],
        deliveryFormat: input.metadata?.deliveryMethods || ['email', 'calendar'],
        useRAG: true,
        ...input.metadata?.briefOptions,
      };
      
      const meetingBrief = await briefAgent.generateMeetingBrief(calendarEvent, meetingContext, briefOptions);
      
      return {
        ...state,
        calendarEvent,
        meetingContext,
        meetingBrief,
        stage: 'brief_completed',
        context: {
          briefGenerated: true,
          briefId: meetingBrief.briefId,
          contextConfidence: meetingContext.retrievalMetadata.confidence,
          briefConfidence: meetingBrief.generationMetadata.confidence,
          processingMethod: 'direct',
        },
      };
      
    } catch (error) {
      this.logger.error(`❌ Error in direct brief processing: ${error.message}`);
      return {
        ...state,
        calendarEvent,
        stage: 'brief_failed',
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
      type: input.type || 'calendar_sync',
      userId: input.userId || 'unknown',
      stage: 'error',
      error: errorMessage,
      context: {
        errorOccurredAt: new Date().toISOString(),
        originalInput: input,
      },
    };
  }
} 