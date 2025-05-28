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
 * Service for executing agent graphs and tracking progress
 */
@Injectable()
export class GraphExecutionService {
  private readonly logger = new Logger(GraphExecutionService.name);
  private readonly progressMap: Map<string, number> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Execute a graph with the given initial state
   * @param graph The graph to execute
   * @param initialState The initial state for the graph
   * @returns The final state after graph execution
   */
  async executeGraph<T>(graph: any, initialState: T): Promise<T> {
    this.logger.log("Executing agent graph");

    // Check if the graph is a CustomGraph
    if (graph.execute && typeof graph.execute === "function") {
      this.logger.log("Using graph execute method");
      const finalState = await graph.execute(initialState);
      this.logger.log("Graph execution completed");
      return finalState;
    }

    // Fallback for other graph types
    this.logger.warn(
      "Graph has no execute method, using custom execution logic",
    );
    let currentState = { ...initialState } as any;
    let currentNode = "__start__";

    // Keep track of visited nodes to prevent infinite loops
    const visitedPaths = new Set<string>();

    // Execute the graph until we reach the END node or hit an error
    while (currentNode !== "__end__") {
      this.logger.debug(`Processing node: ${currentNode}`);

      // Create a path signature to detect loops
      const pathSignature = `${currentNode}`;

      // Check for infinite loops
      if (visitedPaths.has(pathSignature)) {
        throw new Error(`Infinite loop detected at node ${currentNode}`);
      }

      visitedPaths.add(pathSignature);

      // Get the next node
      const nextNodeInfo = this.findNextNode(graph, currentNode, currentState);

      if (!nextNodeInfo) {
        throw new Error(`No edge found from node ${currentNode}`);
      }

      this.logger.debug(`Next node: ${nextNodeInfo.target}`);

      // Update current node
      currentNode = nextNodeInfo.target;

      // Skip execution for START node
      if (currentNode === "__start__") {
        continue;
      }

      // Skip execution for END node
      if (currentNode === "__end__") {
        break;
      }

      // Execute the current node
      const nodeFn = graph.nodes?.[currentNode];
      if (!nodeFn) {
        throw new Error(`Node ${currentNode} not found in graph`);
      }

      try {
        this.logger.debug(`Executing node: ${currentNode}`);
        const prevState = { ...currentState };
        currentState = await nodeFn(currentState);

        // Run state transition handlers
        if (graph.stateTransitionHandlers) {
          for (const handler of graph.stateTransitionHandlers) {
            currentState = await handler(prevState, currentState, currentNode);
          }
        }
      } catch (error) {
        this.logger.error(
          `Error executing node ${currentNode}: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }

    this.logger.log("Graph execution completed");
    return currentState as T;
  }

  /**
   * Find the next node based on the current node and state
   */
  private findNextNode(
    graph: any,
    currentNode: string,
    state: any,
  ): { target: string } | null {
    // Check if the graph has a getNextNode method
    if (graph.findNextNode && typeof graph.findNextNode === "function") {
      return graph.findNextNode(currentNode, state);
    }

    // Fallback to checking edges manually
    const edges = graph.edges?.filter((edge) => edge.source === currentNode);

    if (!edges || edges.length === 0) {
      return null;
    }

    // Handle conditional edges
    for (const edge of edges) {
      if (edge.isConditional && edge.condition) {
        const target = edge.condition(state);
        if (target) {
          return { target };
        }
      } else if (!edge.isConditional && edge.target) {
        return { target: edge.target };
      }
    }

    return null;
  }

  /**
   * Attach a progress tracker to the graph
   * @param graph The graph to attach the tracker to
   * @param sessionId The session ID for progress updates
   */
  attachProgressTracker(graph: any, sessionId: string): void {
    this.logger.debug(
      `Attaching progress tracker to graph for session ${sessionId}`,
    );

    // Initialize progress for this session
    this.initProgress(sessionId);

    // Attach state transition handler to track progress
    graph.addStateTransitionHandler(
      async (prevState: any, newState: any, nodeName: string) => {
        try {
          // Calculate progress based on the current node
          const progress = this.calculateProgressForNode(nodeName);

          // Only update progress if this is a significant change
          if (
            progress > 0 &&
            progress > (this.progressMap.get(sessionId) || 0)
          ) {
            // Publish progress update
            this.publishProgressUpdate(
              sessionId,
              nodeName,
              progress,
              "in_progress",
              `Executing ${nodeName.replace("_", " ")}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error in progress tracking: ${error.message}`,
            error.stack,
          );
        }

        // Always return the newState to continue graph execution
        return newState;
      },
    );
  }

  /**
   * Initialize progress tracking for a new session
   */
  private initProgress(sessionId: string): void {
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
   * Calculate progress percentage based on current node
   * This is a basic implementation that can be extended by services
   */
  private calculateProgressForNode(nodeName: string): number {
    // Default progress values based on common node names
    const progressMap: Record<string, number> = {
      __start__: 0,
      initialization: 5,
      routing: 10,
      analysis: 50,
      processing: 75,
      finalization: 90,
      __end__: 100,
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
