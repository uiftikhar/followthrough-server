import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TeamHandlerRegistry } from "./team-handler-registry.service";

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

  // Node names for master supervisor graph
  private readonly masterNodeNames = {
    START: "__start__",
    SUPERVISOR: "supervisor",
    MEETING_ANALYSIS_TEAM: "meeting_analysis_team",
    EMAIL_TRIAGE_TEAM: "email_triage_team",
    END: "__end__",
  };

  constructor(private readonly teamHandlerRegistry: TeamHandlerRegistry) {
    this.logger.log("EnhancedGraphService initialized");
  }

  /**
   * Initialize the service and build the supervisor graph once during startup
   */
  async onModuleInit() {
    this.logger.log("Building supervisor graph during initialization");
    this.supervisorGraph = await this.buildMasterSupervisorGraph();
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
   * Build a master supervisor graph for routing between different teams
   * This is called during initialization and stored for reuse
   */
  async buildMasterSupervisorGraph(): Promise<any> {
    this.logger.log("Building master supervisor graph");

    const graph = this.createGraph();

    // Create supervisor node
    const supervisorNode = async (state: any) => {
      this.logger.log("Executing supervisor node");

      // Determine the input type
      let inputType = "unknown";
      if (state.input?.type) {
        inputType = state.input.type;
      } else if (state.transcript) {
        inputType = "meeting_transcript";
      } else if (state.input?.emailData) {
        inputType = "email_triage";
      }

      // Route based on input type
      this.logger.log(`Input type: ${inputType}`);
      if (inputType === "meeting_transcript") {
        return {
          ...state,
          routing: {
            team: "meeting_analysis",
            reason: "Input contains a meeting transcript",
          },
          resultType: "meeting_analysis",
        };
      } else if (inputType === "email_triage" || inputType === "email") {
        return {
          ...state,
          routing: {
            team: "email_triage",
            reason: "Input contains email content for triage",
          },
          resultType: "email_triage",
        };
      }

      // Default fallback
      return {
        ...state,
        routing: {
          team: "meeting_analysis", // Default fallback
          reason: "No specific routing determined, using default",
        },
        resultType: "meeting_analysis",
      };
    };

    // Create team nodes (use team handlers from registry)
    const meetingAnalysisTeamNode = async (state: any) => {
      this.logger.log("Routing to meeting analysis team", JSON.stringify(state));

      // Get the meeting analysis team handler from registry
      const teamHandler =
        this.teamHandlerRegistry.getHandler("meeting_analysis");

      if (!teamHandler) {
        this.logger.error("No handler found for meeting_analysis team");
        return {
          ...state,
          error: {
            message: "No handler found for meeting_analysis team",
            timestamp: new Date().toISOString(),
          },
          result: {
            transcript: state.input?.content || state.transcript || "",
            topics: [],
            actionItems: [],
            summary: "",
            errors: [
              {
                step: "meeting_analysis_team",
                error: "No handler registered for team",
                timestamp: new Date().toISOString(),
              },
            ],
          },
        };
      }

      try {
        // Process with the actual team handler
        // FIXED: Properly extract transcript from input structure
        const result = await teamHandler.process({
          content: state.input?.content || state.input?.transcript || state.transcript || "",
          metadata: state.input?.metadata || {},
        });

        this.logger.log("Meeting analysis completed by team handler");

        return {
          ...state,
          result: result,
        };
      } catch (error) {
        this.logger.error(
          `Error in meeting analysis: ${error.message}`,
          error.stack,
        );
        return {
          ...state,
          error: {
            message: error.message,
            timestamp: new Date().toISOString(),
          },
          result: {
            transcript: state.input?.content || state.transcript || "",
            topics: [],
            actionItems: [],
            summary: "",
            errors: [
              {
                step: "meeting_analysis_team",
                error: error.message,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        };
      }
    };

    const emailTriageTeamNode = async (state: any) => {
      this.logger.log("Routing to email triage team");

      // Get the email triage team handler from registry
      const teamHandler = this.teamHandlerRegistry.getHandler("email_triage");

      if (!teamHandler) {
        this.logger.error("No handler found for email_triage team");
        return {
          ...state,
          error: {
            message: "No handler found for email_triage team",
            timestamp: new Date().toISOString(),
          },
          result: {
            email: state.input?.content || "",
            categories: [],
            priority: "medium",
            summary: "",
            errors: [
              {
                step: "email_triage_team",
                error: "No handler registered for team",
                timestamp: new Date().toISOString(),
              },
            ],
          },
        };
      }

      try {
        // Process with the actual team handler
        // EmailTriageService expects input with emailData and sessionId
        // FIXED: Properly extract email content from input structure
        const result = await teamHandler.process({
          emailData: state.input?.emailData || {
            id: state.input?.id || `email-${Date.now()}`,
            body: state.input?.content || state.input?.body || state.input?.transcript || "",
            metadata: state.input?.metadata || {},
          },
          sessionId: state.sessionId || `session-${Date.now()}`,
        });

        this.logger.log("Email triage completed by team handler");

        return {
          ...state,
          result: result,
        };
      } catch (error) {
        this.logger.error(
          `Error in email triage: ${error.message}`,
          error.stack,
        );
        return {
          ...state,
          error: {
            message: error.message,
            timestamp: new Date().toISOString(),
          },
          result: {
            email: state.input?.content || "",
            categories: [],
            priority: "medium",
            summary: "",
            errors: [
              {
                step: "email_triage_team",
                error: error.message,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        };
      }
    };

    // Add nodes to the graph
    graph.addNode(this.masterNodeNames.SUPERVISOR, supervisorNode);
    graph.addNode(
      this.masterNodeNames.MEETING_ANALYSIS_TEAM,
      meetingAnalysisTeamNode,
    );
    graph.addNode(this.masterNodeNames.EMAIL_TRIAGE_TEAM, emailTriageTeamNode);

    // Add standard edges
    graph.addEdge(this.masterNodeNames.START, this.masterNodeNames.SUPERVISOR);

    // Add conditional edge from supervisor to appropriate team
    graph.addConditionalEdge(this.masterNodeNames.SUPERVISOR, (state: any) => {
      if (state.routing?.team === "meeting_analysis") {
        return this.masterNodeNames.MEETING_ANALYSIS_TEAM;
      } else if (state.routing?.team === "email_triage") {
        return this.masterNodeNames.EMAIL_TRIAGE_TEAM;
      }
      // Default to meeting analysis as fallback
      return this.masterNodeNames.MEETING_ANALYSIS_TEAM;
    });

    // Add edges from teams to end
    graph.addEdge(
      this.masterNodeNames.MEETING_ANALYSIS_TEAM,
      this.masterNodeNames.END,
    );
    graph.addEdge(
      this.masterNodeNames.EMAIL_TRIAGE_TEAM,
      this.masterNodeNames.END,
    );

    return graph;
  }

  /**
   * Analyze a meeting transcript
   */
  // async analyzeMeeting(transcript: string): Promise<any> {
  //   this.logger.log('Analyzing meeting transcript');

  //   const initialState = {
  //     transcript,
  //     startTime: new Date().toISOString(),
  //     stage: 'initialization',
  //     topics: [],
  //     actionItems: [],
  //     sentiment: undefined,
  //     summary: undefined,
  //     errors: [],
  //   };

  //   // Use the pre-built supervisor graph instead of building it for each request
  //   if (!this.supervisorGraph) {
  //     this.logger.warn('Supervisor graph not initialized, building it now');
  //     this.supervisorGraph = await this.buildMasterSupervisorGraph();
  //   }

  //   const finalState = await this.supervisorGraph.execute(initialState);

  //   // Ensure we return a properly formatted MeetingAnalysisResult
  //   if (finalState.result) {
  //     // Make sure result has the correct structure and types
  //     return {
  //       transcript: finalState.result.transcript || transcript,
  //       topics: finalState.result.topics || [],
  //       actionItems: finalState.result.actionItems || [],
  //       sentiment: finalState.result.sentiment,
  //       summary: finalState.result.summary,
  //       stage: 'completed',
  //       errors: finalState.result.errors || [],
  //     };
  //   }

  //   return {
  //     transcript,
  //     topics: [],
  //     actionItems: [],
  //     sentiment: undefined,
  //     summary: undefined,
  //     stage: 'failed',
  //     errors: [{
  //       step: 'analysis',
  //       error: 'No result produced by the graph',
  //       timestamp: new Date().toISOString(),
  //     }],
  //   };
  // }

  /**
   * Process input through the master supervisor graph
   */
  async processMasterSupervisorInput(input: any): Promise<any> {
    this.logger.log("Processing input through master supervisor");

    // Prepare initial state for the master supervisor graph
    const initialState = {
      input: input,
      startTime: new Date().toISOString(),
      routing: undefined,
      result: undefined,
      error: undefined,
    };

    // Use the pre-built supervisor graph
    if (!this.supervisorGraph) {
      this.logger.warn("Supervisor graph not initialized, building it now");
      this.supervisorGraph = await this.buildMasterSupervisorGraph();
    }

    try {
      const finalState = await this.supervisorGraph.execute(initialState);

      // Return the result with proper typing based on the routing
      if (finalState.result) {
        return {
          ...finalState.result,
          resultType:
            finalState.routing?.team === "email_triage"
              ? "email_triage"
              : "meeting_analysis",
        };
      }

      // Handle error case
      return {
        resultType: "error",
        error: finalState.error || {
          message: "No result produced by the master supervisor",
          timestamp: new Date().toISOString(),
        },
        errors: [
          {
            step: "master_supervisor",
            error: "No result produced",
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } catch (error) {
      this.logger.error(
        `Error in master supervisor processing: ${error.message}`,
        error.stack,
      );
      return {
        resultType: "error",
        error: {
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        errors: [
          {
            step: "master_supervisor",
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }
  }
}
