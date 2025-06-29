import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { TeamHandlerRegistry } from "src/langgraph/core/team-handler-registry.service";
import { TeamHandler } from "src/langgraph/core/interfaces/team-handler.interface";
import { StateGraph, START, END } from "@langchain/langgraph";
import { StateService } from "src/langgraph/state/state.service";
import { EmailAgentFactory } from "../agents/email-agent.factory";
import { EmailTriageState } from "../dtos/email-triage.dto";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EmailTriageSessionRepository } from "../../../database/repositories/email-triage-session.repository";
import { EmailTriageEventService } from "../services/email-triage-event.service";

/**
 * EmailTriageService - Team Handler for Email Domain
 * Implements TeamHandler interface to integrate with Master Supervisor
 * Registers as 'email_triage' team to handle email processing tasks
 * UPDATED: Now uses specialized EmailAgentFactory and proper LangGraph pattern
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
    private readonly emailAgentFactory: EmailAgentFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailTriageSessionRepository: EmailTriageSessionRepository,
    private readonly emailTriageEventService: EmailTriageEventService,
  ) {
    this.logger.log(
      "EmailTriageService constructor called - using specialized EmailAgentFactory and centralized event service",
    );
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
   * ✅ NEW: Direct processing method (like MeetingAnalysisService.process())
   * This allows controllers to call EmailTriageService directly without UnifiedWorkflowService
   */
  async processEmailDirectly(
    emailData: any,
    metadata?: any,
    userId?: string
  ): Promise<any> {
    const sessionId = `email-${emailData.id}-${Date.now()}`;
    
    this.logger.log(`🚀 Direct email processing for session: ${sessionId}`);

    // Create initial state
    const initialState: EmailTriageState = {
      sessionId,
      emailData: {
        id: emailData.id,
        body: emailData.body,
        metadata: {
          ...emailData.metadata,
          userId: userId || emailData.metadata?.userId,
        },
      },
      currentStep: "initializing",
      progress: 0,
    };

    try {
      // Create database session record
      await this.emailTriageSessionRepository.create({
        sessionId,
        userId: userId || emailData.metadata?.userId || sessionId,
        emailId: emailData.id,
        status: "processing",
        startTime: new Date(),
        emailData: {
          ...initialState.emailData,
          id: initialState.emailData.id || `email-${Date.now()}`,
        },
        source: metadata?.source || "direct_processing",
        metadata: metadata || {},
      });

      // Emit events using centralized service
      this.emailTriageEventService.emitTriageStarted({
        emailId: emailData.id,
        emailAddress: emailData.metadata?.to || emailData.metadata?.emailAddress,
        subject: emailData.metadata?.subject,
        from: emailData.metadata?.from,
        sessionId,
        timestamp: new Date().toISOString(),
        source: metadata?.source || 'manual',
      });

      // Execute LangGraph workflow
      const finalState = await this.executeEmailTriageGraph(initialState);
      
      // Save to database
      const completedSession = await this.emailTriageSessionRepository.complete(sessionId, {
        classification: finalState.classification,
        summary: finalState.summary,
        replyDraft: finalState.replyDraft,
        retrievedContext: finalState.retrievedContext,
        processingMetadata: finalState.processingMetadata,
        contextRetrievalResults: finalState.contextRetrievalResults,
        userToneProfile: finalState.userToneProfile,
      });
      
      // Emit completion events using centralized service
      this.emailTriageEventService.emitTriageCompleted({
        emailId: emailData.id,
        emailAddress: emailData.metadata?.to || emailData.metadata?.emailAddress,
        subject: emailData.metadata?.subject,
        from: emailData.metadata?.from,
        sessionId,
        timestamp: new Date().toISOString(),
        source: metadata?.source || 'manual',
        result: finalState.result,
        classification: finalState.classification,
        summary: finalState.summary,
        replyDraft: finalState.replyDraft,
        retrievedContext: finalState.retrievedContext,
        processingMetadata: finalState.processingMetadata,
        triageResults: {
          classification: finalState.classification,
          summary: finalState.summary,
          replyDraft: finalState.replyDraft,
          retrievedContext: finalState.retrievedContext,
          processingMetadata: finalState.processingMetadata,
          contextRetrievalResults: finalState.contextRetrievalResults,
          userToneProfile: finalState.userToneProfile,
        },
        databaseSession: completedSession,
      });

      return {
        sessionId,
        status: finalState.error ? 'failed' : 'completed',
        classification: finalState.classification,
        summary: finalState.summary,
        replyDraft: finalState.replyDraft,
        processedAt: new Date(),
      };

    } catch (error) {
      this.logger.error(`❌ Direct email processing failed: ${error.message}`, error.stack);
      
      // Save failed session to database
      try {
        await this.emailTriageSessionRepository.markFailed(sessionId, {
          step: "direct_email_processing",
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      } catch (dbError) {
        this.logger.error(`Failed to save error to database: ${dbError.message}`);
      }

      // Emit failure event
      this.emailTriageEventService.emitTriageFailed({
        emailId: emailData.id,
        emailAddress: emailData.metadata?.to || emailData.metadata?.emailAddress,
        subject: emailData.metadata?.subject,
        from: emailData.metadata?.from,
        sessionId,
        error: error.message,
        timestamp: new Date().toISOString(),
        source: metadata?.source || 'manual',
      });

      throw error;
    }
  }

  /**
   * Process email triage tasks - required by TeamHandler interface
   * This maintains compatibility with UnifiedWorkflowService
   * UPDATED: Now delegates to processEmailDirectly() for consistency
   */
  async process(input: any): Promise<any> {
    this.logger.log(
      `Processing email triage task for email: ${input.emailData?.id} via UnifiedWorkflowService compatibility`,
    );

    // Validate input structure
    if (!input.emailData) {
      throw new Error("Invalid input structure: missing emailData");
    }

    // Delegate to processEmailDirectly() for consistency
    return this.processEmailDirectly(
      input.emailData,
      input.metadata,
      input.emailData?.metadata?.userId || input.userId
    );
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
      this.logger.error(
        `❌ Failed to build email triage graph: ${error.message}`,
      );
      throw error;
    }
  }

  // Graph node implementations
  private async initializeNode(state: any): Promise<any> {
    this.logger.log(
      `Initializing email triage for email: ${state.emailData?.id}`,
    );

    return {
      ...state,
      currentStep: "initialization_completed",
      progress: 10,
    };
  }

  private async classifyEmailNode(state: any): Promise<any> {
    this.logger.log("Executing email classification");

    try {
      // ✅ Use specialized email classification agent
      const agent = this.emailAgentFactory.getEmailClassificationAgent();
      const updatedState = await agent.processState(state);
      
      this.logger.log(`Email classified: ${updatedState.classification?.category || 'unknown'}`);
      
      return {
        ...updatedState,
        currentStep: "classification_completed",
        progress: 40,
      };
    } catch (error) {
      this.logger.warn(`Email classification failed, using fallback: ${error.message}`);
      
      // ✅ Intelligent fallback with pattern-based classification
      return {
        ...state,
        classification: this.fallbackClassification(state),
        currentStep: "classification_completed",
        progress: 40,
      };
    }
  }

  /**
   * Fallback classification when AI agent fails
   */
  private fallbackClassification(state: any): any {
    const emailContent = state.emailData?.body || "";
    const subject = state.emailData?.metadata?.subject || "";
    const combinedText = `${subject} ${emailContent}`.toLowerCase();

    // Pattern-based classification
    let priority = "medium";
    let category = "general";

    // Priority detection
    if (/urgent|asap|emergency|critical|immediately/.test(combinedText)) {
      priority = "urgent";
    } else if (/important|high|priority/.test(combinedText)) {
      priority = "high";
    } else if (/low|minor|fyi/.test(combinedText)) {
      priority = "low";
    }

    // Category detection
    if (/bug|error|issue|problem|fix/.test(combinedText)) {
      category = "bug_report";
    } else if (/feature|request|enhancement/.test(combinedText)) {
      category = "feature_request";
    } else if (/question|how|what|why/.test(combinedText)) {
      category = "question";
    } else if (/complain|problem|issue/.test(combinedText)) {
      category = "complaint";
    } else if (/thank|great|excellent/.test(combinedText)) {
      category = "praise";
    }

    return {
      priority,
      category,
      confidence: 0.6,
      reasoning: "Pattern-based fallback classification",
    };
  }

  private async summarizeEmailNode(state: any): Promise<any> {
    this.logger.log("Executing email summarization");

    try {
      // ✅ Use specialized email summarization agent
      const agent = this.emailAgentFactory.getEmailSummarizationAgent();
      const updatedState = await agent.processState(state);
      
      this.logger.log(`Email summarized successfully`);
      
      return {
        ...updatedState,
        currentStep: "summarization_completed",
        progress: 70,
      };
    } catch (error) {
      this.logger.warn(`Email summarization failed, using fallback: ${error.message}`);
      
      // ✅ Intelligent fallback with basic summary
      return {
        ...state,
        summary: this.fallbackSummary(state),
        currentStep: "summarization_completed",
        progress: 70,
      };
    }
  }

  /**
   * Fallback summarization when AI agent fails
   */
  private fallbackSummary(state: any): any {
    const emailContent = state.emailData?.body || "";
    const subject = state.emailData?.metadata?.subject || "";
    const from = state.emailData?.metadata?.from || "";

    // Extract first few sentences as brief summary
    const sentences = emailContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const briefSummary = sentences.slice(0, 2).join('. ').trim() || "Email content unavailable";

    // Generate basic key points
    const keyPoints = [
      `From: ${from}`,
      `Subject: ${subject}`,
      briefSummary.length > 100 ? "Long email content" : "Short email content",
    ];

    return {
      briefSummary: briefSummary.substring(0, 200) + (briefSummary.length > 200 ? "..." : ""),
      keyPoints,
      sentiment: "neutral",
      confidence: 0.5,
      reasoning: "Pattern-based fallback summarization",
    };
  }

  private async generateReplyNode(state: any): Promise<any> {
    this.logger.log("Executing reply draft generation");

    try {
      // ✅ Use specialized email reply draft agent
      const agent = this.emailAgentFactory.getEmailReplyDraftAgent();
      const updatedState = await agent.processState(state);
      
      this.logger.log(`Reply draft generated successfully`);
      
      return {
        ...updatedState,
        currentStep: "reply_generation_completed",
        progress: 90,
      };
    } catch (error) {
      this.logger.warn(`Reply generation failed, using fallback: ${error.message}`);
      
      // ✅ Intelligent fallback with basic reply
      return {
        ...state,
        replyDraft: this.fallbackReplyDraft(state),
        currentStep: "reply_generation_completed",
        progress: 90,
      };
    }
  }

  /**
   * Fallback reply draft when AI agent fails
   */
  private fallbackReplyDraft(state: any): any {
    const subject = state.emailData?.metadata?.subject || "";
    const from = state.emailData?.metadata?.from || "";
    const classification = state.classification;

    // Generate basic reply based on classification
    let replyBody = "Thank you for your email. ";
    
    if (classification?.category === "question") {
      replyBody += "We have received your question and will provide a response shortly.";
    } else if (classification?.category === "bug_report") {
      replyBody += "We have received your bug report and our team will investigate this issue.";
    } else if (classification?.category === "feature_request") {
      replyBody += "We have received your feature request and will consider it for future development.";
    } else if (classification?.category === "complaint") {
      replyBody += "We sincerely apologize for any inconvenience and will address your concerns promptly.";
    } else {
      replyBody += "We have received your message and will respond accordingly.";
    }

    return {
      subject: `Re: ${subject}`,
      body: replyBody,
      tone: "professional",
      confidence: 0.6,
      reasoning: "Pattern-based fallback reply generation",
    };
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
        completedAt: new Date().toISOString(),
      },
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
