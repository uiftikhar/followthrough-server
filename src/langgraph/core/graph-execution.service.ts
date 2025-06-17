import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * Event type for graph execution progress updates
 */
export interface GraphProgressEvent {
  sessionId: string;
  phase: string;
  progress: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  message?: string;
  timestamp: string;
}

/**
 * Service for executing LangGraph StateGraphs and tracking progress
 * This service is now focused exclusively on LangGraph execution
 */
@Injectable()
export class GraphExecutionService {
  private readonly logger = new Logger(GraphExecutionService.name);
  private readonly progressMap: Map<string, number> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Execute a LangGraph StateGraph with the given initial state
   * @param graph The compiled LangGraph StateGraph to execute
   * @param initialState The initial state for the graph
   * @returns The final state after graph execution
   */
  async executeGraph<T>(graph: any, initialState: T): Promise<T> {
    this.logger.log("Executing LangGraph StateGraph");

    // Ensure this is a compiled LangGraph with invoke method
    if (!graph.invoke || typeof graph.invoke !== "function") {
      throw new Error(
        "Invalid graph provided. Only compiled LangGraph StateGraphs are supported. " +
          "Please ensure your graph is created using StateGraph and compiled with .compile()",
      );
    }

    try {
      this.logger.log("Using LangGraph invoke method");
      const finalState = await graph.invoke(initialState);
      this.logger.log("LangGraph execution completed successfully");
      return finalState;
    } catch (error) {
      this.logger.error(
        `LangGraph execution failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`Graph execution failed: ${error.message}`);
    }
  }

  /**
   * Initialize progress tracking for a new session
   */
  initProgress(sessionId: string): void {
    this.progressMap.set(sessionId, 0);
    this.publishProgressUpdate(
      sessionId,
      "initialization",
      0,
      "pending",
      "Starting graph execution",
    );
    this.logger.debug(`Initialized progress tracking for session ${sessionId}`);
  }

  /**
   * Update progress for a specific session
   */
  updateProgress(
    sessionId: string,
    phase: string,
    progress: number,
    status: "pending" | "in_progress" | "completed" | "failed" = "in_progress",
    message?: string,
  ): void {
    // Only update progress if this is a significant change
    const currentProgress = this.progressMap.get(sessionId) || 0;
    if (progress > currentProgress) {
      this.publishProgressUpdate(sessionId, phase, progress, status, message);
    }
  }

  /**
   * Complete progress tracking for a session
   */
  completeProgress(
    sessionId: string,
    message: string = "Graph execution completed",
  ): void {
    this.publishProgressUpdate(
      sessionId,
      "completed",
      100,
      "completed",
      message,
    );
    // Clean up progress tracking for this session
    this.progressMap.delete(sessionId);
  }

  /**
   * Fail progress tracking for a session
   */
  failProgress(
    sessionId: string,
    message: string = "Graph execution failed",
  ): void {
    this.publishProgressUpdate(sessionId, "failed", 0, "failed", message);
    // Clean up progress tracking for this session
    this.progressMap.delete(sessionId);
  }

  /**
   * Calculate progress percentage based on current node
   */
  calculateProgressForNode(nodeName: string): number {
    // Default progress values based on common node names
    const progressMap: Record<string, number> = {
      __start__: 0,
      initialization: 10,
      contextRetrieval: 20,
      topicExtraction: 40,
      actionItemExtraction: 60,
      sentimentAnalysis: 70,
      summaryGeneration: 80,
      documentStorage: 90,
      finalization: 95,
      __end__: 100,
      // Email triage specific
      classify: 25,
      summarize: 50,
      generateReply: 75,
      finalize: 90,
      // Calendar workflow specific
      syncCalendar: 30,
      generateBrief: 60,
      prepareMeeting: 80,
    };

    return progressMap[nodeName] || 0;
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
    const event: GraphProgressEvent = {
      sessionId,
      phase,
      progress,
      status,
      message,
      timestamp: new Date().toISOString(),
    };

    // Save current progress
    this.progressMap.set(sessionId, progress);

    // Emit event for WebSocket gateway
    this.eventEmitter.emit("graph.progress", event);

    this.logger.debug(
      `Published progress update for session ${sessionId}: ${progress}% (${phase}) - ${message}`,
    );
  }
}
