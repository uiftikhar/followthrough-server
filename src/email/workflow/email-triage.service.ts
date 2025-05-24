import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TeamHandlerRegistry } from '../../langgraph/core/team-handler-registry.service';
import { TeamHandler } from '../../langgraph/core/interfaces/team-handler.interface';
import { EmailTriageManager } from './email-triage.manager';

/**
 * EmailTriageService - Team Handler for Email Domain
 * Implements TeamHandler interface to integrate with Master Supervisor
 * Registers as 'email_triage' team to handle email processing tasks
 */
@Injectable()
export class EmailTriageService implements TeamHandler, OnModuleInit {
  private readonly logger = new Logger(EmailTriageService.name);
  private readonly teamName = 'email_triage';
  
  constructor(
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
    private readonly emailTriageManager: EmailTriageManager,
  ) {}

  async onModuleInit() {
    // Register with master supervisor as email triage team handler
    this.logger.log(`Registering email triage team handler: ${this.teamName}`);
    this.teamHandlerRegistry.registerHandler(this.teamName, this);
    this.logger.log('Email triage team handler registered successfully');
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
   */
  async process(input: any): Promise<any> {
    this.logger.log(`Processing email triage task for email: ${input.emailData?.id}`);
    
    try {
      // Validate input structure
      if (!input.emailData) {
        throw new Error('Invalid input structure: missing emailData');
      }

      // Route to EmailTriageManager which coordinates the 3 workers
      const result = await this.emailTriageManager.processEmail(input.emailData, { sessionId: input.sessionId });
      
      this.logger.log(`Email triage task completed successfully: ${result.sessionId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error processing email triage task: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if this team can handle the given input - optional TeamHandler method
   */
  async canHandle(input: any): Promise<boolean> {
    // Check if input looks like email triage request
    return !!(input.emailData && input.emailData.body && input.emailData.metadata);
  }

  /**
   * Get team information for supervisor coordination
   */
  getTeamInfo() {
    return {
      name: this.teamName,
      description: 'Email triage and processing team',
      capabilities: [
        'email_classification',
        'email_summarization', 
        'reply_draft_generation'
      ],
      supportedTaskTypes: ['email_triage']
    };
  }
} 