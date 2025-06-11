import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import {
  MeetingAnalysisNodes,
  MeetingAnalysisState,
} from "../nodes/meeting-analysis.nodes";
import { LlmService } from "../llm/llm.service";
import { MeetingAnalysisAgentFactory } from "../meeting-analysis/meeting-analysis-agent.factory";
import { StateService } from "../state/state.service";

export class MeetingAnalysisWorkflow {
  private nodes: MeetingAnalysisNodes;

  constructor(
    private readonly stateService: StateService,
    llmService: LlmService,
    meetingAnalysisAgentFactory: MeetingAnalysisAgentFactory,
  ) {
    this.nodes = new MeetingAnalysisNodes(llmService, meetingAnalysisAgentFactory);
  }

  createWorkflow(): StateGraph<any> {
    // Use our custom state definition that matches the node interface
    const workflow: any = new StateGraph(
      this.stateService.createMeetingAnalysisState(),
    )
      // Add all nodes
      .addNode("initialize", this.nodes.initializeMeetingAnalysis)
      .addNode("extract_topics", this.nodes.extractTopics)
      .addNode("extract_action_items", this.nodes.extractActionItems)
      .addNode("generate_summary", this.nodes.generateSummary)
      .addNode("analyze_sentiment", this.nodes.analyzeSentiment)
      .addNode("finalize", this.nodes.finalizeMeetingAnalysis)

      // Define the flow
      .addEdge(START, "initialize")
      .addEdge("initialize", "extract_topics")
      .addEdge("extract_topics", "extract_action_items")
      .addEdge("extract_action_items", "generate_summary")
      .addEdge("generate_summary", "analyze_sentiment")
      .addEdge("analyze_sentiment", "finalize")
      .addEdge("finalize", END);

    return workflow;
  }

  // Conditional routing example for more complex workflows
  createAdvancedWorkflow(): StateGraph<any> {
    // Use our custom state definition that matches the node interface
    const workflow: any = new StateGraph(
      this.stateService.createMeetingAnalysisState(),
    )
      .addNode("initialize", this.nodes.initializeMeetingAnalysis)
      .addNode("extract_topics", this.nodes.extractTopics)
      .addNode("extract_action_items", this.nodes.extractActionItems)
      .addNode("generate_summary", this.nodes.generateSummary)
      .addNode("analyze_sentiment", this.nodes.analyzeSentiment)
      .addNode("finalize", this.nodes.finalizeMeetingAnalysis)

      // Start with initialization
      .addEdge(START, "initialize")

      // Conditional routing after initialization
      .addConditionalEdges("initialize", this.routeAfterInitialization, {
        parallel: "extract_topics", // For now, route to topics (parallel processing would need different implementation)
        sequential: "extract_topics",
        error: END,
      })

      // Continue based on success
      .addConditionalEdges("extract_topics", this.checkExtractionSuccess, {
        continue: "extract_action_items",
        retry: "extract_topics",
        skip: "finalize",
      })

      .addEdge("extract_action_items", "generate_summary")
      .addEdge("generate_summary", "analyze_sentiment")
      .addEdge("analyze_sentiment", "finalize")
      .addEdge("finalize", END);

    return workflow;
  }

  // Route after initialization based on transcript length
  private routeAfterInitialization = (state: any): string => {
    if (state.error) return "error";

    // For long transcripts, use parallel processing (simplified to sequential for now)
    if (state.transcript && state.transcript.length > 10000) {
      return "parallel";
    }

    return "sequential";
  };

  // Check if extraction was successful
  private checkExtractionSuccess = (state: any): string => {
    if (state.error) return "skip";
    if (!state.topics || state.topics.length === 0) return "retry";
    return "continue";
  };

  // Execute the workflow with input data
  async executeWorkflow(input: {
    meetingId: string;
    transcript: string;
    sessionId?: string;
    userId?: string;
  }): Promise<MeetingAnalysisState> {
    const workflow = this.createWorkflow();
    const compiled = workflow.compile();

    // Create initial state compatible with our nodes
    const initialState: MeetingAnalysisState = {
      meetingId: input.meetingId,
      transcript: input.transcript,
      stage: "initialization",
      sessionId: input.sessionId || `meeting-${input.meetingId}-${Date.now()}`,
      userId: input.userId || "unknown",
      metadata: {
        startTime: new Date().toISOString(),
        workflowType: "meeting-analysis",
      },
      results: {},
    };

    const result = await compiled.invoke(initialState);

    // Save final state using StateService
    if (result.sessionId) {
      await this.stateService.saveStateCheckpoint(
        result.sessionId,
        "final",
        result,
      );
    }

    return result as MeetingAnalysisState;
  }

  // Execute with streaming for real-time updates
  async *executeWorkflowStream(input: {
    meetingId: string;
    transcript: string;
    sessionId?: string;
    userId?: string;
  }): AsyncGenerator<
    Partial<MeetingAnalysisState>,
    MeetingAnalysisState,
    unknown
  > {
    const workflow = this.createWorkflow();
    const compiled = workflow.compile();

    // Create initial state compatible with our nodes
    const initialState: MeetingAnalysisState = {
      meetingId: input.meetingId,
      transcript: input.transcript,
      stage: "initialization",
      sessionId: input.sessionId || `meeting-${input.meetingId}-${Date.now()}`,
      userId: input.userId || "unknown",
      metadata: {
        startTime: new Date().toISOString(),
        workflowType: "meeting-analysis",
      },
      results: {},
    };

    try {
      const stream = await compiled.stream(initialState);

      let lastState: any = null;
      for await (const chunk of stream) {
        lastState = chunk;

        // Save intermediate checkpoints using StateService
        if (chunk.sessionId && chunk.stage) {
          await this.stateService.saveStateCheckpoint(
            chunk.sessionId,
            chunk.stage,
            chunk,
          );
        }

        yield chunk as Partial<MeetingAnalysisState>;
      }

      // Save final state
      if (lastState?.sessionId) {
        await this.stateService.saveStateCheckpoint(
          lastState.sessionId,
          "final",
          lastState,
        );
      }

      return lastState as MeetingAnalysisState;
    } catch (error) {
      console.error("Streaming error:", error);
      throw error;
    }
  }
}
