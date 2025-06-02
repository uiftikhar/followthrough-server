import { Injectable, Logger, OnModuleInit, OnApplicationBootstrap } from "@nestjs/common";
import { TeamHandlerRegistry } from "../../langgraph/core/team-handler-registry.service";
import { TeamHandler } from "../../langgraph/core/interfaces/team-handler.interface";
import { EmailTriageGraphBuilder } from "./email-triage-graph.builder";
import { EmailTriageState } from "../dtos/email-triage.dto";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * EmailTriageService - Team Handler for Email Domain
 * Implements TeamHandler interface to integrate with Master Supervisor
 * Registers as 'email_triage' team to handle email processing tasks
 * UPDATED: Now uses EmailTriageGraphBuilder for Phase 5/6 RAG enhancements
 */
@Injectable()
export class EmailTriageService implements TeamHandler, OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(EmailTriageService.name);
  private readonly teamName = "email_triage";

  constructor(
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
    private readonly emailTriageGraphBuilder: EmailTriageGraphBuilder,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Log constructor call
    this.logger.log('EmailTriageService constructor called - using EmailTriageGraphBuilder');
  }

  async onModuleInit() {
    this.logger.log('EmailTriageService onModuleInit called');
    await this.registerWithTeamHandlerRegistry();
  }

  async onApplicationBootstrap() {
    this.logger.log('EmailTriageService onApplicationBootstrap called');
    // Double-check registration
    await this.verifyRegistration();
  }

  private async registerWithTeamHandlerRegistry() {
    // Register with master supervisor as email triage team handler
    this.logger.log(`Starting registration of email triage team handler: ${this.teamName}`);
    
    // Check if registry is available
    if (!this.teamHandlerRegistry) {
      this.logger.error('TeamHandlerRegistry is not available during module initialization');
      return;
    }
    
    this.logger.log('TeamHandlerRegistry is available, proceeding with registration');
    
    try {
      this.teamHandlerRegistry.registerHandler(this.teamName, this);
      this.logger.log("Email triage team handler registered successfully");
      
      // Verify registration immediately
      const registeredHandler = this.teamHandlerRegistry.getHandler(this.teamName);
      if (registeredHandler) {
        this.logger.log('Registration verified: handler is accessible via registry');
      } else {
        this.logger.error('Registration failed: handler not found in registry after registration');
      }
      
      // Log all registered teams for debugging
      const allTeamNames = this.teamHandlerRegistry.getAllTeamNames();
      this.logger.log(`All registered teams: ${JSON.stringify(allTeamNames)}`);
      
    } catch (error) {
      this.logger.error(`Failed to register email triage team handler: ${error.message}`, error.stack);
    }
  }

  private async verifyRegistration() {
    try {
      this.logger.log('Verifying EmailTriageService registration...');
      const handler = this.teamHandlerRegistry.getHandler(this.teamName);
      if (handler) {
        this.logger.log('✅ EmailTriageService is properly registered');
      } else {
        this.logger.error('❌ EmailTriageService is NOT registered - attempting re-registration');
        await this.registerWithTeamHandlerRegistry();
      }
    } catch (error) {
      this.logger.error('Error during registration verification:', error);
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
   * UPDATED: Now uses EmailTriageGraphBuilder with RAG enhancements
   */
  async process(input: any): Promise<any> {
    this.logger.log(
      `Processing email triage task for email: ${input.emailData?.id} using RAG-enhanced graph`,
    );

    try {
      // Validate input structure
      if (!input.emailData) {
        throw new Error("Invalid input structure: missing emailData");
      }

      // Create EmailTriageState for the enhanced graph builder
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
            timestamp: input.emailData.metadata?.timestamp || new Date().toISOString(),
            headers: input.emailData.metadata?.headers || {},
            userId: input.emailData.metadata?.userId, // Add userId for tone learning
          },
        },
        currentStep: "initializing",
        progress: 0,
      };

      this.logger.log(`🚀 Starting RAG-enhanced email triage for session: ${sessionId}`);
      
      // Emit immediate triage started event
      this.eventEmitter.emit("email.triage.started", {
        sessionId,
        emailId: input.emailData.id,
        emailAddress: input.emailData.metadata?.to || input.emailData.metadata?.emailAddress,
        subject: input.emailData.metadata?.subject,
        from: input.emailData.metadata?.from,
        timestamp: new Date().toISOString(),
        source: 'enhanced_graph_service',
      });

      // Execute the RAG-enhanced email triage graph
      const finalState = await this.emailTriageGraphBuilder.executeGraph(initialState);

      this.logger.log(`✅ RAG-enhanced email triage completed for session: ${sessionId}`);

      // Emit enhanced completion event with detailed results
      this.eventEmitter.emit("email.triage.completed", {
        sessionId,
        emailId: input.emailData.id,
        emailAddress: input.emailData.metadata?.to || input.emailData.metadata?.emailAddress,
        subject: input.emailData.metadata?.subject,
        result: finalState.result,
        classification: finalState.classification,
        summary: finalState.summary,
        replyDraft: finalState.replyDraft,
        retrievedContext: finalState.retrievedContext,
        processingMetadata: finalState.processingMetadata,
        timestamp: new Date().toISOString(),
        source: 'enhanced_graph_service',
        ragEnhanced: true,
      });

      // Return the final result in the expected format
      return finalState.result || {
        sessionId,
        emailId: input.emailData.id,
        classification: finalState.classification,
        summary: finalState.summary,
        replyDraft: finalState.replyDraft,
        status: finalState.error ? "failed" : "completed",
        processedAt: new Date(),
      };

    } catch (error) {
      this.logger.error(
        `Error processing RAG-enhanced email triage task: ${error.message}`,
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
        source: 'enhanced_graph_service',
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
}
