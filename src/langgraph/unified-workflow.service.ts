import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { v4 as uuidv4 } from "uuid";
import { SessionRepository } from "../database/repositories/session.repository";
import { Session } from "../database/schemas/session.schema";
import { StateService } from "./state/state.service";
import { TeamHandlerRegistry } from "./core/team-handler-registry.service";
import { StateGraph, START, END } from "@langchain/langgraph";

/**
 * Event type for workflow progress updates
 */
export interface WorkflowProgressEvent {
  sessionId: string;
  phase: string;
  progress: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  message?: string;
  timestamp: string;
}

/**
 * Service for handling unified workflow processing with routing to specialized teams
 */
@Injectable()
export class UnifiedWorkflowService {
  private readonly logger = new Logger(UnifiedWorkflowService.name);
  private readonly progressMap: Map<string, number> = new Map();
  private masterSupervisorGraph: any;

  constructor(
    private readonly stateService: StateService,
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionRepository: SessionRepository,
  ) {
    this.initializeMasterSupervisorGraph();
    this.logger.log("UnifiedWorkflowService initialized");
  }

  private initializeMasterSupervisorGraph(): void {
    try {
      // Create the master supervisor graph using the proper supervisor state annotation
      const stateAnnotation = this.stateService.createSupervisorState();
      
      this.masterSupervisorGraph = new StateGraph(stateAnnotation)
        .addNode("supervisor", this.supervisorNode.bind(this))
        .addNode("meetingTeam", this.meetingTeamNode.bind(this))
        .addNode("emailTeam", this.emailTeamNode.bind(this))
        .addNode("calendarTeam", this.calendarTeamNode.bind(this))
        .addEdge(START, "supervisor")
        .addConditionalEdges(
          "supervisor",
          this.routeToTeam.bind(this),
          {
            "meeting_analysis": "meetingTeam",
            "email_triage": "emailTeam",
            "calendar_workflow": "calendarTeam",
            "__end__": END
          }
        )
        .addEdge("meetingTeam", END)
        .addEdge("emailTeam", END)
        .addEdge("calendarTeam", END)
        .compile();

      this.logger.log("Master supervisor graph initialized successfully with proper supervisor state");
    } catch (error) {
      this.logger.error(`Error initializing master supervisor graph: ${error.message}`);
    }
  }

  private async supervisorNode(state: any): Promise<any> {
    this.logger.log("Processing supervisor node");
    
    const input = state.input;
    let routing = { team: "__end__", confidence: 0, reasoning: "Unknown input type" };

    // Email routing logic
    if (input.type === "email" || input.emailData || input.subject || input.from) {
      routing = {
        team: "email_triage",
        confidence: 0.98,
        reasoning: "Input contains email data structure"
      };
    }
    // Meeting routing logic  
    else if (input.type === "meeting" || input.transcript || input.meetingId) {
      routing = {
        team: "meeting_analysis", 
        confidence: 0.98,
        reasoning: "Input contains meeting/transcript data"
      };
    }
    // Calendar routing logic
    else if (input.type === "calendar" || input.calendarEvent || input.eventId) {
      routing = {
        team: "calendar_workflow",
        confidence: 0.98,
        reasoning: "Input contains calendar/event data"
      };
    }

    return {
      ...state,
      routing,
      status: "routing"
    };
  }

  private routeToTeam(state: any): string {
    const routing = state.routing;
    if (routing && routing.team) {
      return routing.team;
    }
    return "__end__";
  }

  private async meetingTeamNode(state: any): Promise<any> {
    this.logger.log("Processing meeting team node");
    
    const meetingHandler = this.teamHandlerRegistry.getHandler("meeting_analysis");
    if (!meetingHandler) {
      throw new Error("Meeting analysis handler not found");
    }

    const result = await meetingHandler.process(state.input);
    
    return {
      ...state,
      result
    };
  }

  private async emailTeamNode(state: any): Promise<any> {
    this.logger.log("Processing email team node");
    
    const emailHandler = this.teamHandlerRegistry.getHandler("email_triage");
    if (!emailHandler) {
      throw new Error("Email triage handler not found");
    }

    const result = await emailHandler.process(state.input);
    
    return {
      ...state,
      result
    };
  }

  private async calendarTeamNode(state: any): Promise<any> {
    this.logger.log("Processing calendar team node");
    
    const calendarHandler = this.teamHandlerRegistry.getHandler("calendar_workflow");
    if (!calendarHandler) {
      throw new Error("Calendar workflow handler not found");
    }

    const result = await calendarHandler.process(state.input);
    
    return {
      ...state,
      result
    };
  }

  /**
   * Process an input and route it to the appropriate team
   */
  async processInput(
    input: any,
    metadata?: any,
    userId?: string,
  ): Promise<any> {
    // Create session
    const session = await this.createSession(input, metadata, userId);
    const sessionId = session.sessionId || `session-${Date.now()}`;

    this.publishProgressUpdate(
      sessionId,
      "initialization",
      5,
      "in_progress",
      "Starting workflow processing",
    );

    try {
      const initialState = {
        input: input,
        startTime: new Date().toISOString(),
        routing: undefined,
        result: undefined,
        error: undefined,
      };

      // Process through master supervisor graph
      const finalState = await this.masterSupervisorGraph.invoke(initialState);

      // Update session with results
      await this.updateSession(sessionId, {
        status: "completed",
        results: finalState.result,
        completedAt: new Date(),
      });

      this.publishProgressUpdate(
        sessionId,
        "completion",
        100,
        "completed",
        "Workflow processing completed",
      );

      return {
        sessionId,
        status: "completed",
        results: finalState.result,
      };
    } catch (error) {
      this.logger.error(`Error processing input: ${error.message}`);

      await this.updateSession(sessionId, {
        status: "failed",
        error: error.message,
        completedAt: new Date(),
      });

      this.publishProgressUpdate(
        sessionId,
        "error",
        0,
        "failed",
        `Error: ${error.message}`,
      );

      throw error;
    }
  }

  /**
   * Get results for a session
   */
  async getResults(sessionId: string, userId?: string): Promise<any> {
    this.logger.log(`Retrieving workflow results for session: ${sessionId}`);

    try {
      let session;

      if (userId) {
        // Get session with user verification
        session = await this.sessionRepository.getSessionByIdAndUserId(
          sessionId,
          userId,
        );
      } else {
        // Get session without user verification
        session = await this.sessionRepository.getSessionById(sessionId);
      }

      // Return only clean agent results without transcript or unnecessary data
      return {
        sessionId: session.sessionId,
        status: session.status,
        createdAt: session.startTime,
        completedAt: session.endTime,
        // Only include essential agent outputs
        topics: session.topics || [],
        actionItems: session.actionItems || [],
        summary: session.summary || null,
        sentiment: session.sentiment || null,
        errors: session.errors || [],
        // Include minimal metadata about processing
        metadata: {
          ragEnabled: session.metadata?.ragEnabled || false,
          ragUsed: session.metadata?.ragUsed || false,
          processingTime: session.metadata?.processingTime,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error retrieving workflow results: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Initialize progress tracking for a new session
   */
  private initProgress(sessionId: string): void {
    this.progressMap.set(sessionId, 0);
    this.logger.log(`Initialized progress tracking for session ${sessionId}`);
  }

  /**
   * Attach progress tracker to a graph
   */
  private attachProgressTracker(graph: any, sessionId: string): void {
    graph.addStateTransitionHandler(
      async (prevState: any, newState: any, nodeName: string) => {
        // Skip tracking for start node
        if (nodeName === "__start__") {
          return newState;
        }

        const progress = this.calculateProgressForNode(nodeName);

        this.logger.log(
          `Progress update for session ${sessionId}: ${progress}% at node ${nodeName}`,
        );

        // Publish progress update
        this.publishProgressUpdate(
          sessionId,
          nodeName,
          progress,
          "in_progress",
          `Executing ${nodeName}`,
        );

        return newState;
      },
    );
  }

  /**
   * Calculate progress percentage based on node name
   */
  private calculateProgressForNode(nodeName: string): number {
    // Define progress points for each node
    const progressMap: Record<string, number> = {
      supervisor: 25,
      meeting_analysis_team: 75,
      email_triage_team: 75,
      __end__: 95,
      initialization: 5,
      routing: 15,
      processing: 50,
      finalization: 90,
      topic_extraction: 35,
      action_item_extraction: 55,
      sentiment_analysis: 70,
      summary_generation: 85,
    };

    return progressMap[nodeName] || 50;
  }

  /**
   * Publish a progress update event
   */
  private publishProgressUpdate(
    sessionId: string,
    phase: string,
    progress: number,
    status: "pending" | "in_progress" | "completed" | "failed",
    message?: string,
  ): void {
    // Update internal progress tracking
    this.progressMap.set(sessionId, progress);

    // Create event object
    const event: WorkflowProgressEvent = {
      sessionId,
      phase,
      progress,
      status,
      message,
      timestamp: new Date().toISOString(),
    };

    // Update session in database with progress
    this.sessionRepository
      .updateSession(sessionId, {
        progress: progress,
        status: status,
      })
      .catch((error) => {
        this.logger.error(
          `Error updating session progress: ${error.message}`,
          error.stack,
        );
      });

    // Emit event
    this.eventEmitter.emit("workflow.progress", event);
    this.logger.log(
      `Emitted workflow.progress event for session ${sessionId}: ${progress}%`,
    );
  }

  /**
   * Create a new session for tracking workflow progress
   */
  private async createSession(input: any, metadata?: any, userId?: string): Promise<any> {
    this.logger.log(`Creating new session for input type: ${input.type || "unknown"}`);
    
    try {
      const sessionData = {
        sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: userId || "default",
        status: "pending",
        startTime: new Date(),
        transcript: input.transcript || input.content || "",
        metadata: {
          ...metadata,
          inputType: input.type,
          originalInput: input
        }
      };

      const session = await this.sessionRepository.createSession(sessionData);
      this.logger.log(`Created session: ${session.sessionId || sessionData.sessionId}`);
      
      return session;
    } catch (error) {
      this.logger.error(`Failed to create session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing session with new data
   */
  private async updateSession(sessionId: string, updateData: any): Promise<void> {
    this.logger.log(`Updating session: ${sessionId}`);
    
    try {
      await this.sessionRepository.updateSession(sessionId, updateData);
      this.logger.log(`Successfully updated session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to update session ${sessionId}: ${error.message}`);
      throw error;
    }
  }
}
