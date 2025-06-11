import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import {
  EmailTriageNodes,
  EmailTriageState,
} from "../nodes/email-triage.nodes";
import { EmailAgentFactory } from "../../email/agents/email-agent.factory";
import { StateService } from "../state/state.service";

export class EmailTriageWorkflow {
  private nodes: EmailTriageNodes;

  constructor(
    private readonly stateService: StateService,
    emailAgentFactory: EmailAgentFactory,
  ) {
    this.nodes = new EmailTriageNodes(emailAgentFactory);
  }

  createWorkflow(): any {
    // Use our custom state definition that matches the node interface
    const workflow = new StateGraph(this.stateService.createEmailTriageState())
      // Add all nodes
      .addNode("initialize", this.nodes.initializeEmailTriage)
      .addNode("classify", this.nodes.classifyEmail)
      .addNode("summarize", this.nodes.summarizeEmail)
      .addNode("generateReply", this.nodes.generateReplyDraft)
      .addNode("analyzePatterns", this.nodes.analyzeSenderPatterns)
      .addNode("suggestDelegation", this.nodes.generateDelegationSuggestion)
      .addNode("finalize", this.nodes.finalizeEmailTriage)

      // Define the flow
      .addEdge(START, "initialize")
      .addEdge("initialize", "classify")
      .addEdge("classify", "summarize")
      .addEdge("summarize", "generateReply")
      .addEdge("generateReply", "analyzePatterns")
      .addEdge("analyzePatterns", "suggestDelegation")
      .addEdge("suggestDelegation", "finalize")
      .addEdge("finalize", END);

    // Compile the workflow without checkpointer for now
    return workflow.compile();
  }

  // Route after initialization based on email validity
  private routeAfterInitialization = (state: any): string => {
    if (state.error) return "error";
    if (!state.emailData?.body || !state.emailData?.from) return "error";
    return "continue";
  };

  // Route after classification based on success
  private routeAfterClassification = (state: any): string => {
    if (state.error) return "error";
    if (!state.classification) return "skip";
    return "continue";
  };

  // Route after summarization based on success
  private routeAfterSummarization = (state: any): string => {
    if (state.error) return "error";
    if (!state.summary) return "skip";
    return "continue";
  };

  // Route after reply generation based on classification
  private routeAfterReplyGeneration = (state: any): string => {
    if (state.error) return "error";

    // Skip optional steps if classification suggests no reply needed
    if (state.classification && !state.classification.requiresReply) {
      return "skip";
    }

    return "continue";
  };

  // Route after pattern analysis (optional step)
  private routeAfterPatternAnalysis = (state: any): string => {
    if (state.error) return "error";

    // Pattern analysis is optional, continue to delegation
    return "continue";
  };

  // Route after delegation suggestion (final optional step)
  private routeAfterDelegation = (state: any): string => {
    // Always continue to finalize regardless of delegation success
    return "continue";
  };

  /**
   * Execute the email triage workflow
   */
  async executeWorkflow(
    emailData: EmailTriageState["emailData"],
    sessionId: string,
    userId?: string,
    useRAG: boolean = false,
    context?: Record<string, any>,
  ): Promise<EmailTriageState> {
    const workflow = this.createWorkflow();

    const initialState: Partial<EmailTriageState> = {
      sessionId,
      userId,
      emailData,
      useRAG,
      context: context || {},
      metadata: {
        workflowType: "email_triage",
        startTime: new Date().toISOString(),
      },
    };

    try {
      // Save initial state checkpoint
      await this.stateService.saveStateCheckpoint(
        sessionId,
        "email_triage_start",
        initialState,
      );

      // Execute the workflow
      const result = await workflow.invoke(initialState, {
        configurable: { thread_id: sessionId },
      });

      // Save final state checkpoint
      await this.stateService.saveStateCheckpoint(
        sessionId,
        "email_triage_complete",
        result,
      );

      return result as EmailTriageState;
    } catch (error) {
      const errorResult: EmailTriageState = {
        ...(initialState as EmailTriageState),
        error: error.message,
        stage: "workflow_failed",
        currentStep: "workflow_execution_failed",
        progress: 0,
      };

      // Save error state checkpoint
      await this.stateService.saveStateCheckpoint(
        sessionId,
        "email_triage_error",
        errorResult,
      );

      return errorResult;
    }
  }

  /**
   * Stream the email triage workflow execution
   */
  async *streamWorkflow(
    emailData: EmailTriageState["emailData"],
    sessionId: string,
    userId?: string,
    useRAG: boolean = false,
    context?: Record<string, any>,
  ): AsyncGenerator<EmailTriageState, EmailTriageState, unknown> {
    const workflow = this.createWorkflow();

    const initialState: Partial<EmailTriageState> = {
      sessionId,
      userId,
      emailData,
      useRAG,
      context: context || {},
      metadata: {
        workflowType: "email_triage",
        startTime: new Date().toISOString(),
      },
    };

    try {
      // Save initial state checkpoint
      await this.stateService.saveStateCheckpoint(
        sessionId,
        "email_triage_start",
        initialState,
      );

      // Stream the workflow execution
      const stream = await workflow.stream(initialState, {
        configurable: { thread_id: sessionId },
      });

      for await (const chunk of stream) {
        // Save intermediate state checkpoints
        await this.stateService.saveStateCheckpoint(
          sessionId,
          `email_triage_${chunk.currentStep || "step"}`,
          chunk,
        );

        yield chunk as EmailTriageState;
      }

      // The final state should be returned as the result
      const finalChunk = await stream.next();
      if (!finalChunk.done) {
        const finalState = finalChunk.value as EmailTriageState;

        // Save final state checkpoint
        await this.stateService.saveStateCheckpoint(
          sessionId,
          "email_triage_complete",
          finalState,
        );

        return finalState;
      }

      throw new Error("Workflow stream ended unexpectedly");
    } catch (error) {
      const errorResult: EmailTriageState = {
        ...(initialState as EmailTriageState),
        error: error.message,
        stage: "workflow_failed",
        currentStep: "workflow_streaming_failed",
        progress: 0,
      };

      // Save error state checkpoint
      await this.stateService.saveStateCheckpoint(
        sessionId,
        "email_triage_error",
        errorResult,
      );

      yield errorResult;
      return errorResult;
    }
  }
}
