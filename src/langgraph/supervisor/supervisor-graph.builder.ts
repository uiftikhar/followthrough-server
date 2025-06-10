import { Injectable } from "@nestjs/common";
import { OpenAIService } from "../../embedding/openai.service";
import { BaseGraphBuilder } from "../core/base-graph-builder";
import { TeamHandlerRegistry } from "../core/team-handler-registry.service";
import { SupervisorState } from "./interfaces/supervisor-state.interface";
import { ChatCompletionMessageParam } from "openai/resources/chat";

/**
 * Graph builder for the supervisor agent
 */
@Injectable()
export class SupervisorGraphBuilder extends BaseGraphBuilder<SupervisorState> {
  /**
   * Node names for the supervisor graph
   */
  private readonly nodeNames = {
    ...this.baseNodeNames,
    ROUTING: "routing",
    PROCESSING: "processing",
    FINALIZATION: "finalization",
  };

  constructor(
    private readonly openAiService: OpenAIService,
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
  ) {
    super();
  }

  /**
   * Build nodes for the supervisor graph
   */
  protected buildNodes(): Record<string, Function> {
    this.logger.log("Building nodes for supervisor graph");

    return {
      [this.nodeNames.START]: this.startNode.bind(this),
      [this.nodeNames.ROUTING]: this.routingNode.bind(this),
      [this.nodeNames.PROCESSING]: this.processingNode.bind(this),
      [this.nodeNames.FINALIZATION]: this.finalizationNode.bind(this),
      [this.nodeNames.END]: this.endNode.bind(this),
    };
  }

  /**
   * Define edges between nodes
   */
  protected defineEdges(graph: any): void {
    this.logger.log("Defining edges for supervisor graph");

    // Sequential flow from START to END
    graph.addEdge(this.nodeNames.START, this.nodeNames.ROUTING);
    graph.addEdge(this.nodeNames.ROUTING, this.nodeNames.PROCESSING);
    graph.addEdge(this.nodeNames.PROCESSING, this.nodeNames.FINALIZATION);
    graph.addEdge(this.nodeNames.FINALIZATION, this.nodeNames.END);
  }

  /**
   * Start node - initialize state
   */
  private async startNode(state: SupervisorState): Promise<SupervisorState> {
    this.logger.log(`Starting supervisor for session ${state.sessionId}`);
    return {
      ...state,
      status: "pending",
    };
  }

  /**
   * Routing node - determine which team should handle the input
   */
  private async routingNode(state: SupervisorState): Promise<SupervisorState> {
    try {
      this.logger.log(`Routing input for session ${state.sessionId}`);

      // If input type is already known, use it
      if (state.input.type && state.input.type !== "other") {
        let team = "";
        let confidence = 1.0;

        // Map input type to team
        switch (state.input.type) {
          case "meeting_transcript":
            team = "meeting_analysis";
            break;
          case "email":
            team = "email_triage";
            break;
          case "calendar":
          case "calendar_workflow":
            team = "calendar_workflow";
            break;
          default:
            // This should not happen given the check above
            team = "unknown";
            confidence = 0.5;
        }

        return {
          ...state,
          routing: {
            team,
            confidence,
            explanation: `Input type is explicitly ${state.input.type}`,
          },
          status: "routing",
        };
      }

      // Otherwise, use LLM to determine the type
      const prompt = `
        Please analyze the following content and determine what type of input it is.
        Choose from one of the following types:
        - meeting_transcript: A transcript of a meeting with multiple participants
        - email: An email or similar written communication
        - calendar: Calendar-related data, events, or scheduling information
        - calendar_workflow: Calendar workflow processing requests
        - other: None of the above
        
        For your selection, provide a confidence score between 0.0 and 1.0, where 1.0 is completely certain.
        
        Also provide a brief explanation for your decision (1-2 sentences).
        
        Content:
        ${state.input.content.substring(0, 1000)}${state.input.content.length > 1000 ? "..." : ""}
        
        Return your answer as a JSON object with the following properties:
        - type: The selected type (one of the options above)
        - confidence: A number between 0.0 and 1.0
        - explanation: A brief explanation for your decision
      `;

      const messages: ChatCompletionMessageParam[] = [
        { role: "user", content: prompt },
      ];

      const completion = await this.openAiService.generateText({
        messages,
        response_format: { type: "json_object" },
      });

      let routing = {
        team: "unknown",
        confidence: 0.5,
        explanation: "Failed to determine input type",
      };

      try {
        const parsed = JSON.parse(completion);

        // Map the detected type to a team
        let team = "unknown";
        switch (parsed.type) {
          case "meeting_transcript":
            team = "meeting_analysis";
            break;
          case "email":
            team = "email_triage";
            break;
          case "calendar":
          case "calendar_workflow":
            team = "calendar_workflow";
            break;
          default:
            team = "unknown";
        }

        routing = {
          team,
          confidence: parsed.confidence || 0.5,
          explanation: parsed.explanation || "No explanation provided",
        };
      } catch (err) {
        this.logger.error(`Failed to parse routing decision: ${err.message}`);
      }

      return {
        ...state,
        routing,
        status: "routing",
      };
    } catch (error) {
      this.logger.error(`Error in routing: ${error.message}`, error.stack);
      return {
        ...state,
        error: {
          message: error.message,
          stage: "routing",
          timestamp: new Date().toISOString(),
        },
        status: "failed",
      };
    }
  }

  /**
   * Processing node - delegate work to the appropriate team
   */
  private async processingNode(
    state: SupervisorState,
  ): Promise<SupervisorState> {
    try {
      const team = state.routing?.team || "unknown";
      this.logger.log(
        `Processing input for session ${state.sessionId} with team ${team}`,
      );

      // Get the handler for the team
      const handler = this.teamHandlerRegistry.getHandler(team);

      if (!handler) {
        throw new Error(`No handler registered for team "${team}"`);
      }

      // Delegate processing to the team handler
      const results = await handler.process(state.input);

      return {
        ...state,
        results,
        status: "processing",
      };
    } catch (error) {
      this.logger.error(`Error in processing: ${error.message}`, error.stack);
      return {
        ...state,
        error: {
          message: error.message,
          stage: "processing",
          timestamp: new Date().toISOString(),
        },
        status: "failed",
      };
    }
  }

  /**
   * Finalization node - finalize the results
   */
  private async finalizationNode(
    state: SupervisorState,
  ): Promise<SupervisorState> {
    try {
      this.logger.log(`Finalizing results for session ${state.sessionId}`);

      // For now, just pass through the results
      // This could be extended to combine results from multiple teams
      // or to add additional information to the results

      return {
        ...state,
        status: "completed",
      };
    } catch (error) {
      this.logger.error(`Error in finalization: ${error.message}`, error.stack);
      return {
        ...state,
        error: {
          message: error.message,
          stage: "finalization",
          timestamp: new Date().toISOString(),
        },
        status: "failed",
      };
    }
  }

  /**
   * End node - finalize state
   */
  private async endNode(state: SupervisorState): Promise<SupervisorState> {
    this.logger.log(`Completed processing for session ${state.sessionId}`);
    return {
      ...state,
      status: "completed",
    };
  }
}
