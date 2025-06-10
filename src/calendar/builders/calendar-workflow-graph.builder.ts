import { Injectable, Logger } from "@nestjs/common";
import { BaseGraphBuilder } from "../../langgraph/core/base-graph-builder";
import { CalendarWorkflowState } from "../services/calendar-workflow.service";
import { CalendarAgentFactory } from "../agents/calendar-agent.factory";
import { CalendarSyncService } from "../services/calendar-sync.service";
import { BriefDeliveryService } from "../services/brief-delivery.service";
import { MeetingContextOptions } from "../interfaces/meeting-context.interface";
import { BriefGenerationOptions } from "../interfaces/meeting-brief.interface";

/**
 * CalendarWorkflowGraphBuilder
 *
 * Comprehensive graph builder for calendar workflow with intelligent routing
 * based on workflow type and meeting lifecycle stage.
 *
 * Workflow Types:
 * - calendar_sync: Sync and update calendar events
 * - meeting_brief: Generate pre-meeting intelligence briefs
 * - meeting_prep: Prepare for upcoming meetings
 * - post_meeting: Handle post-meeting orchestration
 */
@Injectable()
export class CalendarWorkflowGraphBuilder extends BaseGraphBuilder<CalendarWorkflowState> {
  protected readonly logger = new Logger(CalendarWorkflowGraphBuilder.name);

  // Calendar-specific node names
  private readonly calendarNodeNames = {
    ...this.baseNodeNames,
    INITIALIZATION: "initialization",
    CALENDAR_SYNC: "calendar_sync",
    CONTEXT_RETRIEVAL: "context_retrieval",
    MEETING_BRIEF_GENERATION: "meeting_brief_generation",
    BRIEF_DELIVERY: "brief_delivery",
    MEETING_PREPARATION: "meeting_preparation",
    POST_MEETING_ORCHESTRATION: "post_meeting_orchestration",
    ERROR_HANDLING: "error_handling",
    COMPLETION: "completion",
  };

  constructor(
    private readonly calendarAgentFactory: CalendarAgentFactory,
    private readonly calendarSyncService: CalendarSyncService,
    private readonly briefDeliveryService: BriefDeliveryService,
  ) {
    super();
  }

  /**
   * Build all nodes for the calendar workflow graph
   */
  protected buildNodes(): Record<
    string,
    (state: CalendarWorkflowState) => Promise<CalendarWorkflowState>
  > {
    return {
      [this.calendarNodeNames.START]: this.startNode.bind(this),
      [this.calendarNodeNames.INITIALIZATION]: this.initializationNode.bind(this),
      [this.calendarNodeNames.CALENDAR_SYNC]: this.calendarSyncNode.bind(this),
      [this.calendarNodeNames.CONTEXT_RETRIEVAL]: this.contextRetrievalNode.bind(this),
      [this.calendarNodeNames.MEETING_BRIEF_GENERATION]:
        this.meetingBriefGenerationNode.bind(this),
      [this.calendarNodeNames.BRIEF_DELIVERY]: this.briefDeliveryNode.bind(this),
      [this.calendarNodeNames.MEETING_PREPARATION]: this.meetingPreparationNode.bind(this),
      [this.calendarNodeNames.POST_MEETING_ORCHESTRATION]:
        this.postMeetingOrchestrationNode.bind(this),
      [this.calendarNodeNames.ERROR_HANDLING]: this.errorHandlingNode.bind(this),
      [this.calendarNodeNames.COMPLETION]: this.completionNode.bind(this),
      [this.calendarNodeNames.END]: this.endNode.bind(this),
    };
  }

  /**
   * Define the edges between nodes in the calendar workflow graph
   * Using CustomGraph API which only supports addEdge
   */
  protected defineEdges(graph: any): void {
    // Start to initialization
    graph.addEdge(
      this.calendarNodeNames.START,
      this.calendarNodeNames.INITIALIZATION,
    );

    // Initialization to workflow-specific routing
    graph.addEdge(
      this.calendarNodeNames.INITIALIZATION,
      this.calendarNodeNames.CALENDAR_SYNC,
    );

    // Calendar sync to next step based on workflow type
    graph.addEdge(
      this.calendarNodeNames.CALENDAR_SYNC,
      this.calendarNodeNames.CONTEXT_RETRIEVAL,
    );

    // Meeting brief generation flow (sequential)
    graph.addEdge(
      this.calendarNodeNames.CONTEXT_RETRIEVAL,
      this.calendarNodeNames.MEETING_BRIEF_GENERATION,
    );
    graph.addEdge(
      this.calendarNodeNames.MEETING_BRIEF_GENERATION,
      this.calendarNodeNames.BRIEF_DELIVERY,
    );

    // Brief delivery to completion or meeting prep based on workflow
    graph.addEdge(
      this.calendarNodeNames.BRIEF_DELIVERY,
      this.calendarNodeNames.MEETING_PREPARATION,
    );

    // Meeting preparation to post-meeting or completion
    graph.addEdge(
      this.calendarNodeNames.MEETING_PREPARATION,
      this.calendarNodeNames.POST_MEETING_ORCHESTRATION,
    );

    // Post-meeting orchestration to completion
    graph.addEdge(
      this.calendarNodeNames.POST_MEETING_ORCHESTRATION,
      this.calendarNodeNames.COMPLETION,
    );

    // Error handling and completion flow
    graph.addEdge(
      this.calendarNodeNames.ERROR_HANDLING,
      this.calendarNodeNames.END,
    );
    graph.addEdge(
      this.calendarNodeNames.COMPLETION,
      this.calendarNodeNames.END,
    );
  }

  // ================================
  // NODE IMPLEMENTATIONS
  // ================================

  /**
   * Start node - Entry point for calendar workflow
   */
  private async startNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `🚀 Starting calendar workflow for session ${state.sessionId}`,
    );

    return {
      ...state,
      stage: "started",
      context: {
        ...(state.context || {}),
        startedAt: new Date().toISOString(),
        workflow: "calendar",
      },
    };
  }

  /**
   * Initialization node - Analyze input and prepare workflow context
   */
  private async initializationNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `🔧 Initializing calendar workflow type: ${state.type} for user ${state.userId}`,
    );

    try {
      // Validate required inputs based on workflow type
      const validationResult = this.validateWorkflowInputs(state);
      if (!validationResult.valid) {
        return {
          ...state,
          stage: "initialization_failed",
          error: validationResult.error,
        };
      }

      // Enrich state with workflow-specific context
      const enrichedState = await this.enrichStateContext(state);

      return {
        ...enrichedState,
        stage: "initialized",
        context: {
          ...enrichedState.context,
          initializedAt: new Date().toISOString(),
          workflowValidated: true,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Initialization failed: ${errorMessage}`);
      return {
        ...state,
        stage: "initialization_failed",
        error: `Initialization failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Calendar sync node - Synchronize user's calendar events
   */
  private async calendarSyncNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(`📅 Syncing calendar for user ${state.userId}`);

    // Skip calendar sync for certain workflow types
    if (state.type === "meeting_brief" || state.type === "post_meeting") {
      this.logger.log(`⏭️ Skipping calendar sync for workflow type: ${state.type}`);
      return {
        ...state,
        stage: "calendar_sync_skipped",
        context: {
          ...(state.context || {}),
          skippedCalendarSync: true,
          skippedReason: `Not required for ${state.type} workflow`,
        },
      };
    }

    try {
      // Ensure calendar is synced and get latest events
      const syncedEvents = await this.calendarSyncService.ensureCalendarSynced(
        state.userId,
      );
      const syncStatus = this.calendarSyncService.getSyncStatus(state.userId);

      return {
        ...state,
        upcomingEvents: syncedEvents,
        stage: "calendar_synced",
        context: {
          ...(state.context || {}),
          syncedAt: new Date().toISOString(),
          eventCount: syncedEvents.length,
          syncStatus: syncStatus || "unknown",
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Calendar sync failed: ${errorMessage}`);
      return {
        ...state,
        stage: "calendar_sync_failed",
        error: `Calendar sync failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Context retrieval node - Gather comprehensive meeting context using RAG
   */
  private async contextRetrievalNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `🔍 Retrieving context for meeting: ${state.calendarEvent?.title}`,
    );

    // Skip context retrieval for calendar sync only workflows
    if (state.type === "calendar_sync") {
      this.logger.log(`⏭️ Skipping context retrieval for workflow type: ${state.type}`);
      return {
        ...state,
        stage: "context_retrieval_skipped",
        context: {
          ...(state.context || {}),
          skippedContextRetrieval: true,
          skippedReason: `Not required for ${state.type} workflow`,
        },
      };
    }

    if (!state.calendarEvent) {
      return {
        ...state,
        stage: "context_retrieval_failed",
        error: "No calendar event provided for context retrieval",
      };
    }

    try {
      // Get meeting context agent and configure options
      const contextAgent = this.calendarAgentFactory.getMeetingContextAgent();
      const contextOptions: MeetingContextOptions = {
        lookbackDays: 90,
        maxPreviousMeetings: 10,
        minRelevanceScore: 0.3,
        includeParticipantHistory: true,
        includeTopicPredictions: true,
        includeRecommendations: true,
        useRAG: true,
      };

      // Gather comprehensive meeting context
      const contextResult = await contextAgent.gatherMeetingContext(
        state.calendarEvent,
        contextOptions,
      );

      return {
        ...state,
        meetingContext: contextResult,
        stage: "context_retrieved",
        context: {
          ...(state.context || {}),
          contextRetrievedAt: new Date().toISOString(),
          contextSources: contextResult.retrievalMetadata.sources?.length || 0,
          ragEnabled: true,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Context retrieval failed: ${errorMessage}`);
      return {
        ...state,
        stage: "context_retrieval_failed",
        error: `Context retrieval failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Meeting brief generation node - Generate intelligent meeting brief
   */
  private async meetingBriefGenerationNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `📝 Generating meeting brief for: ${state.calendarEvent?.title}`,
    );

    // Skip brief generation for certain workflow types
    if (state.type === "calendar_sync" || state.type === "post_meeting") {
      this.logger.log(`⏭️ Skipping brief generation for workflow type: ${state.type}`);
      return {
        ...state,
        stage: "brief_generation_skipped",
        context: {
          ...(state.context || {}),
          skippedBriefGeneration: true,
          skippedReason: `Not required for ${state.type} workflow`,
        },
      };
    }

    if (!state.calendarEvent || !state.meetingContext) {
      return {
        ...state,
        stage: "brief_generation_failed",
        error: "Missing calendar event or meeting context for brief generation",
      };
    }

    try {
      // Get meeting brief agent and configure options
      const briefAgent = this.calendarAgentFactory.getMeetingBriefAgent();
      const briefOptions: BriefGenerationOptions = {
        includeDetailedAgenda: true,
        includeParticipantPrep: true,
        complexity: "comprehensive",
        focusAreas: ["agenda", "context", "preparation"],
        deliveryFormat: ["email", "slack", "calendar"],
      };

      // Generate comprehensive meeting brief
      const meetingBrief = await briefAgent.generateMeetingBrief(
        state.calendarEvent,
        state.meetingContext,
        briefOptions,
      );

      return {
        ...state,
        meetingBrief,
        stage: "brief_generated",
        context: {
          ...(state.context || {}),
          briefGeneratedAt: new Date().toISOString(),
          briefComplexity: briefOptions.complexity,
          briefFocusAreas: briefOptions.focusAreas?.length || 0,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Brief generation failed: ${errorMessage}`);
      return {
        ...state,
        stage: "brief_generation_failed",
        error: `Brief generation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Brief delivery node - Deliver meeting brief through multiple channels
   */
  private async briefDeliveryNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `📧 Delivering meeting brief: ${state.meetingBrief?.briefId}`,
    );

    // Skip brief delivery for certain workflow types
    if (state.type === "calendar_sync" || state.type === "post_meeting") {
      this.logger.log(`⏭️ Skipping brief delivery for workflow type: ${state.type}`);
      return {
        ...state,
        stage: "brief_delivery_skipped",
        context: {
          ...(state.context || {}),
          skippedBriefDelivery: true,
          skippedReason: `Not required for ${state.type} workflow`,
        },
      };
    }

    if (!state.meetingBrief) {
      return {
        ...state,
        stage: "brief_delivery_failed",
        error: "No meeting brief available for delivery",
      };
    }

    try {
      // Default delivery methods - can be configured based on user preferences
      const deliveryMethods: Array<
        "email" | "slack" | "calendar" | "dashboard"
      > = ["email", "calendar"];

      // Deliver brief through configured channels
      const deliveryResults = await this.briefDeliveryService.deliverBrief(
        state.meetingBrief,
        deliveryMethods,
        {
          scheduleDelivery: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        },
      );

      return {
        ...state,
        stage: "brief_delivered",
        context: {
          ...(state.context || {}),
          briefDeliveredAt: new Date().toISOString(),
          deliveryMethods: deliveryMethods,
          deliveryResults: deliveryResults,
          deliveryStatus: "success",
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Brief delivery failed: ${errorMessage}`);
      return {
        ...state,
        stage: "brief_delivery_failed",
        error: `Brief delivery failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Meeting preparation node - Handle meeting preparation tasks
   */
  private async meetingPreparationNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `🎯 Preparing for upcoming meetings for user ${state.userId}`,
    );

    // Skip meeting preparation for certain workflow types
    if (state.type === "calendar_sync" || state.type === "meeting_brief" || state.type === "post_meeting") {
      this.logger.log(`⏭️ Skipping meeting preparation for workflow type: ${state.type}`);
      return {
        ...state,
        stage: "meeting_prep_skipped",
        context: {
          ...(state.context || {}),
          skippedMeetingPrep: true,
          skippedReason: `Not required for ${state.type} workflow`,
        },
      };
    }

    try {
      // Get events happening soon that need preparation
      const eventsHappeningSoon =
        await this.calendarSyncService.getEventsHappeningSoon(state.userId);

      // Filter events that need briefs
      const eventsNeedingBriefs = eventsHappeningSoon.filter((event) => {
        const startTime = new Date(event.startTime);
        const now = new Date();
        const minutesUntilStart =
          (startTime.getTime() - now.getTime()) / (1000 * 60);
        return minutesUntilStart > 30 && minutesUntilStart <= 60; // Between 30-60 minutes
      });

      return {
        ...state,
        upcomingEvents: eventsHappeningSoon,
        stage: "meeting_prep_ready",
        context: {
          ...(state.context || {}),
          preparedAt: new Date().toISOString(),
          eventsHappeningSoon: eventsHappeningSoon.length,
          eventsNeedingBriefs: eventsNeedingBriefs.length,
          prepStatus: "ready",
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Meeting preparation failed: ${errorMessage}`);
      return {
        ...state,
        stage: "meeting_prep_failed",
        error: `Meeting preparation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Post-meeting orchestration node - Handle post-meeting workflows
   */
  private async postMeetingOrchestrationNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `🎬 Orchestrating post-meeting workflow for: ${state.calendarEvent?.title}`,
    );

    // Skip post-meeting orchestration for certain workflow types
    if (state.type === "calendar_sync" || state.type === "meeting_brief" || state.type === "meeting_prep") {
      this.logger.log(`⏭️ Skipping post-meeting orchestration for workflow type: ${state.type}`);
      return {
        ...state,
        stage: "post_meeting_skipped",
        context: {
          ...(state.context || {}),
          skippedPostMeeting: true,
          skippedReason: `Not required for ${state.type} workflow`,
        },
      };
    }

    if (!state.calendarEvent) {
      return {
        ...state,
        stage: "post_meeting_failed",
        error: "No calendar event provided for post-meeting orchestration",
      };
    }

    try {
      // Get follow-up orchestration agent
      const orchestrationAgent =
        this.calendarAgentFactory.getFollowUpOrchestrationAgent();

      // Mock meeting analysis result for orchestration
      // In production, this would come from the meeting analysis workflow
      const mockMeetingAnalysis = {
        meetingId: state.calendarEvent.id,
        meetingTitle: state.calendarEvent.title,
        transcript: (state.context?.transcript as string) || "",
        summary: {
          meetingTitle: state.calendarEvent.title,
          summary: "Meeting completed - orchestrating follow-up workflows",
          keyDecisions: [],
          participants: state.calendarEvent.attendees.map((a) => a.email),
          duration: "60 minutes",
          nextSteps: [],
        },
        actionItems: [],
        decisions: [],
        topics: [],
        nextSteps: [],
        participants: state.calendarEvent.attendees.map((a) => a.email),
        followUpRequired: true,
      };

      // Orchestrate follow-up workflows
      const orchestrationResult =
        await orchestrationAgent.orchestrateFollowUp(mockMeetingAnalysis);

      return {
        ...state,
        stage: "post_meeting_orchestrated",
        context: {
          ...(state.context || {}),
          orchestratedAt: new Date().toISOString(),
          orchestrationResult,
          followUpWorkflows: orchestrationResult.routingDecisions?.length || 0,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `❌ Post-meeting orchestration failed: ${errorMessage}`,
      );
      return {
        ...state,
        stage: "post_meeting_failed",
        error: `Post-meeting orchestration failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Error handling node - Handle workflow errors gracefully
   */
  private errorHandlingNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.error(`❌ Handling calendar workflow error: ${state.error}`);

    return Promise.resolve({
      ...state,
      stage: "error_handled",
      context: {
        ...(state.context || {}),
        errorHandledAt: new Date().toISOString(),
        errorResolution: "logged_and_reported",
      },
    });
  }

  /**
   * Completion node - Finalize successful workflow execution
   */
  private completionNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `✅ Completing calendar workflow for session ${state.sessionId}`,
    );

    const startedAt = (state.context as any)?.startedAt as string;
    const workflowDuration = startedAt
      ? Date.now() - new Date(startedAt).getTime()
      : 0;

    return Promise.resolve({
      ...state,
      stage: "completed",
      context: {
        ...(state.context || {}),
        completedAt: new Date().toISOString(),
        workflowDuration,
        status: "success",
      },
    });
  }

  /**
   * End node - Final workflow state
   */
  private endNode(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    this.logger.log(
      `🏁 Calendar workflow ended for session ${state.sessionId}`,
    );

    return Promise.resolve({
      ...state,
      stage: "ended",
      context: {
        ...(state.context || {}),
        endedAt: new Date().toISOString(),
      },
    });
  }

  // ================================
  // ROUTING METHODS
  // ================================

  /**
   * Validate workflow inputs based on type
   */
  private validateWorkflowInputs(state: CalendarWorkflowState): {
    valid: boolean;
    error?: string;
  } {
    if (!state.userId) {
      return { valid: false, error: "userId is required" };
    }

    if (!state.type) {
      return { valid: false, error: "workflow type is required" };
    }

    // Validate type-specific requirements
    if (state.type === "meeting_brief" && !state.calendarEvent) {
      return {
        valid: false,
        error: "calendarEvent is required for meeting_brief workflow",
      };
    }

    if (state.type === "post_meeting" && !state.calendarEvent) {
      return {
        valid: false,
        error: "calendarEvent is required for post_meeting workflow",
      };
    }

    return { valid: true };
  }

  /**
   * Enrich state with workflow-specific context
   */
  private async enrichStateContext(
    state: CalendarWorkflowState,
  ): Promise<CalendarWorkflowState> {
    return {
      ...state,
      context: {
        ...(state.context || {}),
        workflowCapabilities: this.getWorkflowCapabilities(state.type),
        supportedMethods: ["brief_generation", "delivery", "orchestration"],
        ragEnabled: true,
      },
    };
  }

  /**
   * Get capabilities for workflow type
   */
  private getWorkflowCapabilities(
    type: CalendarWorkflowState["type"],
  ): string[] {
    const capabilities = {
      calendar_sync: ["sync", "event_retrieval", "status_tracking"],
      meeting_brief: [
        "context_analysis",
        "brief_generation",
        "multi_channel_delivery",
      ],
      meeting_prep: ["event_detection", "preparation_tasks", "scheduling"],
      post_meeting: [
        "workflow_orchestration",
        "follow_up_generation",
        "action_tracking",
      ],
    };

    return capabilities[type] || [];
  }
}
