import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TeamHandlerRegistry } from "./team-handler-registry.service";
import { SupervisorGraphBuilder } from "../supervisor/supervisor-graph.builder";

/**
 * Enhanced Graph Service that incorporates functionality from the old GraphService
 * This service handles graph building and management
 */
@Injectable()
export class EnhancedGraphService implements OnModuleInit {
  private readonly logger = new Logger(EnhancedGraphService.name);
  private supervisorGraph: any;

  // Node names for graph execution
  private readonly nodeNames = {
    START: "__start__",
    INITIALIZATION: "initialization",
    CONTEXT_RETRIEVAL: "context_retrieval",
    TOPIC_EXTRACTION: "topic_extraction",
    ACTION_ITEM_EXTRACTION: "action_item_extraction",
    SENTIMENT_ANALYSIS: "sentiment_analysis",
    SUMMARY_GENERATION: "summary_generation",
    SUPERVISION: "supervision",
    POST_PROCESSING: "post_processing",
    END: "__end__",
  };

  constructor(
    private readonly supervisorGraphBuilder: SupervisorGraphBuilder,
  ) {
    this.logger.log("EnhancedGraphService initialized");
  }

  /**
   * Initialize the service and build the supervisor graph once during startup
   */
  async onModuleInit() {
    this.logger.log("Building supervisor graph during initialization");
    this.supervisorGraph = await this.supervisorGraphBuilder.buildGraph();
    this.logger.log("Supervisor graph built and ready for use");
  }

  /**
   * Create a graph for execution
   */
  createGraph(): any {
    this.logger.log("Creating a new agent graph");

    // Create a basic graph structure
    const graph = {
      nodes: {},
      edges: [],
      stateTransitionHandlers: [],

      // Add a node to the graph
      addNode(name: string, fn: Function) {
        this.nodes[name] = fn;
      },

      // Add an edge between nodes
      addEdge(source: string, target: string) {
        this.edges.push({ source, target, isConditional: false });
      },

      // Add a conditional edge
      addConditionalEdge(source: string, condition: Function) {
        this.edges.push({ source, condition, isConditional: true });
      },

      // Add a state transition handler
      addStateTransitionHandler(handler: Function) {
        this.stateTransitionHandlers.push(handler);
      },

      // Execute the graph
      async execute(initialState: any) {
        let currentState = { ...initialState };
        let currentNode = "__start__";

        // Keep track of visited nodes to prevent infinite loops
        const visitedPaths = new Set<string>();

        // Execute the graph until we reach the END node or hit an error
        while (currentNode !== "__end__") {
          // Create a path signature to detect loops
          const pathSignature = `${currentNode}`;

          // Check for infinite loops
          if (visitedPaths.has(pathSignature)) {
            throw new Error(`Infinite loop detected at node ${currentNode}`);
          }

          visitedPaths.add(pathSignature);

          // Find next node
          const nextNodeInfo = this.findNextNode(currentNode, currentState);

          if (!nextNodeInfo) {
            throw new Error(`No edge found from node ${currentNode}`);
          }

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
          const nodeFn = this.nodes[currentNode];
          if (!nodeFn) {
            throw new Error(`Node ${currentNode} not found in graph`);
          }

          try {
            const prevState = { ...currentState };
            currentState = await nodeFn(currentState);

            // Run state transition handlers
            for (const handler of this.stateTransitionHandlers) {
              currentState = await handler(
                prevState,
                currentState,
                currentNode,
              );
            }
          } catch (error) {
            throw new Error(
              `Error executing node ${currentNode}: ${error.message}`,
            );
          }
        }

        return currentState;
      },

      // Find the next node based on the current node and state
      findNextNode(currentNode: string, state: any) {
        const edges = this.edges.filter((edge) => edge.source === currentNode);

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
      },
    };

    return graph;
  }

  /**
   * Process input through the master supervisor graph
   */
  async processMasterSupervisorInput(input: any): Promise<any> {
    this.logger.log("Processing input through master supervisor");

    // Create a proper SupervisorState for the SupervisorGraphBuilder
    const supervisorState = {
      sessionId: input.sessionId || `session-${Date.now()}`,
      input: {
        type: input.type || "other",
        content: input.content || input.transcript || JSON.stringify(input),
        metadata: input.metadata || {},
      },
      status: "pending" as const,
    };

    // Use the pre-built supervisor graph from SupervisorGraphBuilder
    if (!this.supervisorGraph) {
      this.logger.warn("Supervisor graph not initialized, building it now");
      this.supervisorGraph = await this.supervisorGraphBuilder.buildGraph();
    }

    try {
      const finalState = await this.supervisorGraph.execute(supervisorState);

      // Return the result with proper typing based on the routing
      if (finalState.results) {
        return {
          ...finalState.results,
          resultType: finalState.routing?.team || "unknown",
          sessionId: finalState.sessionId,
        };
      }

      // Handle error case
      return {
        resultType: "error",
        sessionId: finalState.sessionId,
        error: finalState.error || {
          message: "No result produced by the supervisor",
          timestamp: new Date().toISOString(),
        },
        errors: [
          {
            step: "supervisor",
            error: "No result produced",
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      this.logger.error(
        `Error in supervisor processing: ${error.message}`,
        error.stack,
      );
      return {
        resultType: "error",
        sessionId: supervisorState.sessionId,
        error: {
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        errors: [
          {
            step: "supervisor",
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }
  }
} 