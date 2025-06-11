import { Injectable, Logger } from "@nestjs/common";
import { StateGraph, START, END } from "@langchain/langgraph";
import { CalendarWorkflowNodes, CalendarWorkflowState } from "../nodes/calendar-workflow.nodes";
import { StateService } from "../state/state.service";

@Injectable()
export class CalendarWorkflow {
  private readonly logger = new Logger(CalendarWorkflow.name);

  constructor(
    private readonly nodes: CalendarWorkflowNodes,
    private readonly stateService: StateService,
  ) {}

  /**
   * Create the calendar workflow graph
   */
  createWorkflow(): any {
    // Create the workflow graph
    const workflow = new StateGraph(this.stateService.createCalendarWorkflowState())
      // Add all nodes
      .addNode("initialize", this.nodes.initializeCalendarWorkflow)
      .addNode("generateBrief", this.nodes.generateMeetingBrief)
      .addNode("analyzeContext", this.nodes.analyzeMeetingContext)
      .addNode("planFollowUp", this.nodes.generateFollowUpPlan)
      .addNode("finalize", this.nodes.finalizeCalendarWorkflow)

      // Define the flow
      .addEdge(START, "initialize")
      .addConditionalEdges("initialize", this.routeAfterInitialization, {
        error: END,
        continue: "generateBrief",
      })
      .addConditionalEdges("generateBrief", this.routeAfterBriefGeneration, {
        error: END,
        skip: "finalize",
        continue: "analyzeContext",
      })
      .addConditionalEdges("analyzeContext", this.routeAfterContextAnalysis, {
        error: END,
        continue: "planFollowUp",
      })
      .addConditionalEdges("planFollowUp", this.routeAfterFollowUpPlanning, {
        error: END,
        continue: "finalize",
      })
      .addEdge("finalize", END);

    // Compile the workflow
    return workflow.compile();
  }

  /**
   * Route after initialization
   */
  private routeAfterInitialization = (state: any): string => {
    if (state.error) {
      this.logger.error(`Initialization failed for event ${state.eventData?.id}: ${state.error}`);
      return "error";
    }
    return "continue";
  };

  /**
   * Route after brief generation
   */
  private routeAfterBriefGeneration = (state: any): string => {
    if (state.error) {
      this.logger.error(`Brief generation failed: ${state.error}`);
      return "error";
    }

    // Check if this is a simple workflow that doesn't need context analysis
    if (state.workflowType === "pre_meeting" && state.automationLevel === "manual") {
      return "skip";
    }

    return "continue";
  };

  /**
   * Route after context analysis
   */
  private routeAfterContextAnalysis = (state: any): string => {
    if (state.error) {
      this.logger.error(`Context analysis failed: ${state.error}`);
      return "error";
    }
    return "continue";
  };

  /**
   * Route after follow-up planning
   */
  private routeAfterFollowUpPlanning = (state: any): string => {
    if (state.error) {
      this.logger.error(`Follow-up planning failed: ${state.error}`);
      return "error";
    }
    return "continue";
  };

  /**
   * Execute the calendar workflow
   */
  async executeWorkflow(
    initialState: Partial<CalendarWorkflowState>,
  ): Promise<CalendarWorkflowState> {
    try {
      this.logger.log(`Starting calendar workflow for event ${initialState.eventId}`);

      const workflow = this.createWorkflow();
      const result = await workflow.invoke(initialState);

      this.logger.log(`Calendar workflow completed for event ${initialState.eventId}`);
      return result;
    } catch (error) {
      this.logger.error(`Calendar workflow execution failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Stream the calendar workflow execution
   */
  async *streamWorkflow(
    initialState: Partial<CalendarWorkflowState>,
  ): AsyncGenerator<CalendarWorkflowState, void, unknown> {
    try {
      this.logger.log(`Starting streaming calendar workflow for event ${initialState.eventId}`);

      const workflow = this.createWorkflow();
      const stream = await workflow.stream(initialState);

      for await (const step of stream) {
        this.logger.debug(`Calendar workflow step: ${step.currentStep}`);
        yield step;
      }

      this.logger.log(`Streaming calendar workflow completed for event ${initialState.eventId}`);
    } catch (error) {
      this.logger.error(`Streaming calendar workflow failed: ${(error as Error).message}`);
      throw error;
    }
  }
} 