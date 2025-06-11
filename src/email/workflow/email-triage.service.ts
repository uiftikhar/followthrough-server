import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { TeamHandlerRegistry } from "../../langgraph/core/team-handler-registry.service";
import { TeamHandler } from "../../langgraph/core/interfaces/team-handler.interface";
import { StateGraph, START, END } from "@langchain/langgraph";
import { StateService } from "../../langgraph/state/state.service";
import { AgentFactory } from "../../langgraph/agents/agent.factory";
import { EmailTriageState } from "../dtos/email-triage.dto";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * EmailTriageService - Team Handler for Email Domain
 * Implements TeamHandler interface to integrate with Master Supervisor
 * Registers as 'email_triage' team to handle email processing tasks
 * UPDATED: Now uses pure LangGraph StateGraph implementation
 */
@Injectable()
export class EmailTriageService
  implements TeamHandler, OnModuleInit, OnApplicationBootstrap
{
  private readonly logger = new Logger(EmailTriageService.name);
  private readonly teamName = "email_triage";
  private emailTriageGraph: any;

  constructor(
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
    private readonly stateService: StateService,
    private readonly agentFactory: AgentFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log("EmailTriageService constructor called - using LangGraph StateGraph");
    this.initializeEmailTriageGraph();
  }

  async onModuleInit() {
    this.logger.log("EmailTriageService onModuleInit called");
    await this.registerWithTeamHandlerRegistry();
  }

  async onApplicationBootstrap() {
    this.logger.log("EmailTriageService onApplicationBootstrap called");
    // Double-check registration
    await this.verifyRegistration();
  }

  private async registerWithTeamHandlerRegistry() {
    // Register with master supervisor as email triage team handler
    this.logger.log(
      `Starting registration of email triage team handler: ${this.teamName}`,
    );

    // Check if registry is available
    if (!this.teamHandlerRegistry) {
      this.logger.error(
        "TeamHandlerRegistry is not available during module initialization",
      );
      return;
    }

    this.logger.log(
      "TeamHandlerRegistry is available, proceeding with registration",
    );

    try {
      this.teamHandlerRegistry.registerHandler(this.teamName, this);
      this.logger.log("Email triage team handler registered successfully");

      // Verify registration immediately
      const registeredHandler = this.teamHandlerRegistry.getHandler(
        this.teamName,
      );
      if (registeredHandler) {
        this.logger.log(
          "Registration verified: handler is accessible via registry",
        );
      } else {
        this.logger.error(
          "Registration failed: handler not found in registry after registration",
        );
      }

      // Log all registered teams for debugging
      const allTeamNames = this.teamHandlerRegistry.getAllTeamNames();
      this.logger.log(`All registered teams: ${JSON.stringify(allTeamNames)}`);
    } catch (error) {
      this.logger.error(
        `Failed to register email triage team handler: ${error.message}`,
        error.stack,
      );
    }
  }

  private async verifyRegistration() {
    try {
      this.logger.log("Verifying EmailTriageService registration...");
      const handler = this.teamHandlerRegistry.getHandler(this.teamName);
      if (handler) {
        this.logger.log("✅ EmailTriageService is properly registered");
      } else {
        this.logger.error(
          "❌ EmailTriageService is NOT registered - attempting re-registration",
        );
        await this.registerWithTeamHandlerRegistry();
      }
    } catch (error) {
      this.logger.error("Error during registration verification:", error);
    }
  }

  /**
   * Get the team name - required by TeamHandler interface
   */
  getTeamName(): string {
    return this.teamName;
  }

  /**
   * Process email triage tasks - required by TeamHandler interface
   * This is the main entry point for email processing
   * UPDATED: Now uses pure LangGraph StateGraph implementation
   */
  async process(input: any): Promise<any> {
    this.logger.log(
      `Processing email triage task for email: ${input.emailData?.id} using LangGraph StateGraph`,
    );

    try {
      // Validate input structure
      if (!input.emailData) {
        throw new Error("Invalid input structure: missing emailData");
      }

      // Create EmailTriageState for the LangGraph StateGraph
      const sessionId = input.sessionId || uuidv4();
      const initialState: EmailTriageState = {
        sessionId,
        emailData: {
          id: input.emailData.id || `email-${Date.now()}`,
          body: input.emailData.body || "",
          metadata: {
            subject: input.emailData.metadata?.subject,
            from: input.emailData.metadata?.from,
            to: input.emailData.metadata?.to,
            timestamp:
              input.emailData.metadata?.timestamp || new Date().toISOString(),
            headers: input.emailData.metadata?.headers || {},
            userId: input.emailData.metadata?.userId, // Add userId for tone learning
          },
        },
        currentStep: "initializing",
        progress: 0,
      };

      this.logger.log(
        `🚀 Starting email triage for session: ${sessionId}`,
      );

      // Emit immediate triage started event
      this.eventEmitter.emit("email.triage.started", {
        sessionId,
        emailId: input.emailData.id,
        emailAddress:
          input.emailData.metadata?.to ||
          input.emailData.metadata?.emailAddress,
        subject: input.emailData.metadata?.subject,
        from: input.emailData.metadata?.from,
        timestamp: new Date().toISOString(),
        source: "langgraph_stategraph_service",
      });

      // Execute the email triage graph
      const finalState = await this.executeEmailTriageGraph(initialState);

      this.logger.log(
        `✅ Email triage completed for session: ${sessionId}`,
      );

      // Emit completion event with detailed results
      this.eventEmitter.emit("email.triage.completed", {
        sessionId,
        emailId: input.emailData.id,
        emailAddress:
          input.emailData.metadata?.to ||
          input.emailData.metadata?.emailAddress,
        subject: input.emailData.metadata?.subject,
        result: finalState.result,
        classification: finalState.classification,
        summary: finalState.summary,
        replyDraft: finalState.replyDraft,
        retrievedContext: finalState.retrievedContext,
        processingMetadata: finalState.processingMetadata,
        timestamp: new Date().toISOString(),
        source: "langgraph_stategraph_service",
        langGraph: true,
      });

      // Return the final result in the expected format
      return (
        finalState.result || {
          sessionId,
          emailId: input.emailData.id,
          classification: finalState.classification,
          summary: finalState.summary,
          replyDraft: finalState.replyDraft,
          status: finalState.error ? "failed" : "completed",
          processedAt: new Date(),
        }
      );
    } catch (error) {
      this.logger.error(
        `Error processing email triage task: ${error.message}`,
        error.stack,
      );

      // Emit error event
      this.eventEmitter.emit("email.triage.failed", {
        sessionId: input.sessionId,
        emailId: input.emailData?.id,
        emailAddress: input.emailData?.metadata?.to,
        subject: input.emailData?.metadata?.subject,
        error: error.message,
        timestamp: new Date().toISOString(),
        source: "langgraph_stategraph_service",
      });

      throw error;
    }
  }

  /**
   * Check if this team can handle the given input - optional TeamHandler method
   */
  async canHandle(input: any): Promise<boolean> {
    // Check if input looks like email triage request
    return !!(
      input.emailData &&
      input.emailData.body &&
      input.emailData.metadata
    );
  }

  /**
   * Get team information for supervisor coordination
   */
  getTeamInfo() {
    return {
      name: this.teamName,
      description: "Email triage and processing team",
      capabilities: [
        "email_classification",
        "email_summarization",
        "reply_draft_generation",
      ],
      supportedTaskTypes: ["email_triage"],
    };
  }

  /**
   * Initialize the email triage graph using LangGraph StateGraph
   */
  private async initializeEmailTriageGraph(): Promise<void> {
    try {
      this.logger.log("🏗️ Building email triage LangGraph...");
      
      // Create state annotation for email triage
      const stateAnnotation = this.stateService.createEmailTriageState();
      
      this.emailTriageGraph = new StateGraph(stateAnnotation)
        .addNode("initialize", this.initializeNode.bind(this))
        .addNode("classify", this.classifyEmailNode.bind(this))
        .addNode("summarize", this.summarizeEmailNode.bind(this))
        .addNode("generateReply", this.generateReplyNode.bind(this))
        .addNode("finalize", this.finalizeNode.bind(this))
        .addEdge(START, "initialize")
        .addEdge("initialize", "classify")
        .addEdge("classify", "summarize")
        .addEdge("summarize", "generateReply")
        .addEdge("generateReply", "finalize")
        .addEdge("finalize", END)
        .compile();

      this.logger.log("✅ Email triage LangGraph built successfully");
    } catch (error) {
      this.logger.error(`❌ Failed to build email triage graph: ${error.message}`);
      throw error;
    }
  }

  // Graph node implementations
  private async initializeNode(state: any): Promise<any> {
    this.logger.log(`Initializing email triage for email: ${state.emailData?.id}`);
    
    return {
      ...state,
      currentStep: "initialization_completed",
      progress: 10
    };
  }

  private async classifyEmailNode(state: any): Promise<any> {
    this.logger.log("Executing email classification");
    
    try {
      // Create a basic classification agent as fallback
      const classificationAgent = this.agentFactory.createBaseAgent({
        name: "EmailClassificationAgent",
        systemPrompt: "You are an email classification agent. Classify emails by category and priority. Respond with JSON format: {classification: {category: string, priority: string}}",
        llmOptions: { temperature: 0.3, model: "gpt-4o" }
      });
      
      const classification = await classificationAgent.processState(state);
      
      return {
        ...state,
        classification: classification.classification || { category: "general", priority: "medium" },
        currentStep: "classification_completed",
        progress: 40
      };
    } catch (error) {
      this.logger.warn(`Email classification failed: ${error.message}`);
      return {
        ...state,
        classification: { category: "general", priority: "medium", error: error.message },
        currentStep: "classification_completed",
        progress: 40
      };
    }
  }

  private async summarizeEmailNode(state: any): Promise<any> {
    this.logger.log("Executing email summarization");
    
    try {
      // Create a basic summarization agent as fallback
      const summarizationAgent = this.agentFactory.createBaseAgent({
        name: "EmailSummarizationAgent",
        systemPrompt: "You are an email summarization agent. Create concise summaries of email content. Respond with JSON format: {summary: string}",
        llmOptions: { temperature: 0.3, model: "gpt-4o" }
      });
      
      const summary = await summarizationAgent.processState(state);
      
      return {
        ...state,
        summary: summary.summary || "Email summary not available",
        currentStep: "summarization_completed",
        progress: 70
      };
    } catch (error) {
      this.logger.warn(`Email summarization failed: ${error.message}`);
      return {
        ...state,
        summary: "Email summary not available",
        currentStep: "summarization_completed",
        progress: 70
      };
    }
  }

  private async generateReplyNode(state: any): Promise<any> {
    this.logger.log("Executing reply draft generation");
    
    try {
      // Create a basic reply agent as fallback
      const replyAgent = this.agentFactory.createBaseAgent({
        name: "EmailReplyDraftAgent",
        systemPrompt: "You are an email reply draft agent. Generate appropriate email replies. Respond with JSON format: {replyDraft: string}",
        llmOptions: { temperature: 0.4, model: "gpt-4o" }
      });
      
      const replyDraft = await replyAgent.processState(state);
      
      return {
        ...state,
        replyDraft: replyDraft.replyDraft || "Reply draft not available",
        currentStep: "reply_generation_completed",
        progress: 90
      };
    } catch (error) {
      this.logger.warn(`Reply generation failed: ${error.message}`);
      return {
        ...state,
        replyDraft: "Reply draft not available",
        currentStep: "reply_generation_completed",
        progress: 90
      };
    }
  }

  private async finalizeNode(state: any): Promise<any> {
    this.logger.log("Finalizing email triage");
    
    return {
      ...state,
      currentStep: "completed",
      progress: 100,
      result: {
        classification: state.classification,
        summary: state.summary,
        replyDraft: state.replyDraft,
        sessionId: state.sessionId,
        completedAt: new Date().toISOString()
      }
    };
  }

  private async executeEmailTriageGraph(state: any): Promise<any> {
    try {
      this.logger.log(
        `🚀 Starting email triage execution for session: ${state.sessionId}`,
      );

      // Execute the email triage graph using LangGraph's invoke method
      const finalState = await this.emailTriageGraph.invoke(state);

      this.logger.log(
        `✅ Email triage execution completed for session: ${state.sessionId}`,
      );

      return finalState;
    } catch (error) {
      this.logger.error(
        `Error executing email triage graph: ${error.message}`,
        error.stack,
      );

      throw error;
    }
  }
}
