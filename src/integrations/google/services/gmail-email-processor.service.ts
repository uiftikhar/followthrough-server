import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmailTriageService } from '../../../langgraph/email/workflow/email-triage.service';
import { EnhancedEmailFilterService, EmailData } from '../../../langgraph/email/filters/enhanced-email-filter.service';
import { EmailProcessingCacheService } from '../../../langgraph/email/cache/email-processing-cache.service';

export interface GmailEmailData {
  id: string;
  threadId: string;
  body: string;
  metadata: {
    subject: string;
    from: string;
    to: string;
    timestamp: string;
    headers?: any;
    gmailSource: boolean;
    messageId: string;
    labels?: string[];
    userId?: string;
  };
}

export interface ProcessingResult {
  status: 'processed' | 'filtered' | 'already_processed' | 'failed';
  emailId: string;
  sessionId?: string;
  reason?: string;
  error?: string;
}

export type EmailSource = 'push' | 'pull' | 'test';

export interface ProcessingOptions {
  watchId?: string;
  userId?: string;
  skipCache?: boolean;
}

/**
 * GmailEmailProcessorService - Unified Email Processing
 * 
 * This service consolidates ALL email processing logic and eliminates duplication.
 * It replaces all the duplicate triggerEmailTriage() methods in controllers.
 * 
 * Key Features:
 * - Single entry point for all email processing
 * - Consistent filtering and caching
 * - Direct integration with EmailTriageService (LangGraph)
 * - Standardized event emission
 * - Proper error handling
 */
@Injectable()
export class GmailEmailProcessorService {
  private readonly logger = new Logger(GmailEmailProcessorService.name);

  constructor(
    private readonly emailTriageService: EmailTriageService, // Direct call to LangGraph service
    private readonly enhancedEmailFilter: EnhancedEmailFilterService,
    private readonly emailProcessingCache: EmailProcessingCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Single method to process any email from any source
   * Replaces all triggerEmailTriage() methods in controllers
   */
  async processEmail(
    email: GmailEmailData,
    source: EmailSource,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const { watchId, userId, skipCache = false } = options;
    
    this.logger.log(
      `🎯 Processing email ${email.id} from source: ${source} (Subject: "${email.metadata.subject}")`
    );

    try {
      // Step 1: Check processing cache (prevent duplicates)
      if (!skipCache && await this.emailProcessingCache.has(email.id)) {
        this.logger.log(`⏭️ Email ${email.id} already processed, skipping`);
        return { 
          status: 'already_processed', 
          emailId: email.id,
          reason: 'Email already processed in cache'
        };
      }

      // Step 2: Apply smart filtering BEFORE expensive processing
      const emailData: EmailData = {
        id: email.id,
        subject: email.metadata.subject,
        from: email.metadata.from,
        to: email.metadata.to,
        body: email.body,
        metadata: email.metadata,
      };

      const filterResult = await this.enhancedEmailFilter.analyzeEmail(emailData);
      
      // Mark as processed regardless of whether we triage it
      if (!skipCache) {
        await this.emailProcessingCache.set(email.id, true, 3600); // 1 hour TTL
      }

      if (!filterResult.shouldProcess) {
        this.logger.log(
          `🚫 Email ${email.id} filtered out: ${filterResult.category} (${filterResult.reasoning})`
        );
        
        // Emit filtered event for monitoring
        this.emitFilteredEvent(email, filterResult, source);
        
        return { 
          status: 'filtered', 
          emailId: email.id,
          reason: `${filterResult.category}: ${filterResult.reasoning}`
        };
      }

      // Step 3: Process through clean EmailTriageService (not UnifiedWorkflowService)
      this.logger.log(
        `🎯 Processing email ${email.id} through EmailTriageService (${filterResult.category}, ${filterResult.priority} priority)`
      );

      // Emit immediate email received notification
      this.emitEmailReceivedEvent(email, source);

      // Emit triage started event
      this.emitTriageStartedEvent(email, source);

      // Prepare input for EmailTriageService
      const triageInput = {
        emailData: {
          id: email.id,
          body: email.body,
          metadata: {
            ...email.metadata,
            userId: userId || email.metadata.userId,
          },
        },
        sessionId: `email-${email.id}-${Date.now()}`,
        metadata: { 
          source, 
          watchId,
          filterResult: {
            category: filterResult.category,
            priority: filterResult.priority,
            confidence: filterResult.confidence,
          }
        },
      };

      // ✅ Direct call to EmailTriageService (like MeetingAnalysisService pattern)
      const result = await this.emailTriageService.process(triageInput);

      this.logger.log(
        `✅ Email ${email.id} processed successfully, session: ${result.sessionId || triageInput.sessionId}`
      );

      return { 
        status: 'processed', 
        emailId: email.id, 
        sessionId: result.sessionId || triageInput.sessionId
      };

    } catch (error) {
      this.logger.error(
        `❌ Failed to process email ${email.id}: ${error.message}`,
        error.stack
      );

      // Emit failure event
      this.emitTriageFailedEvent(email, source, error.message);

      return {
        status: 'failed',
        emailId: email.id,
        error: error.message,
      };
    }
  }

  /**
   * Emit email received event for real-time notifications
   */
  private emitEmailReceivedEvent(email: GmailEmailData, source: EmailSource): void {
    this.eventEmitter.emit('email.received', {
      emailId: email.id,
      emailAddress: email.metadata.to,
      subject: email.metadata.subject,
      from: email.metadata.from,
      to: email.metadata.to,
      body: email.body.substring(0, 500), // First 500 chars for preview
      timestamp: email.metadata.timestamp,
      fullEmail: {
        id: email.id,
        threadId: email.threadId,
        metadata: email.metadata,
        bodyLength: email.body.length,
      },
      source,
    });
  }

  /**
   * Emit triage started event
   */
  private emitTriageStartedEvent(email: GmailEmailData, source: EmailSource): void {
    this.eventEmitter.emit('email.triage.started', {
      emailId: email.id,
      emailAddress: email.metadata.to,
      subject: email.metadata.subject,
      from: email.metadata.from,
      timestamp: new Date().toISOString(),
      source,
    });
  }

  /**
   * Emit filtered event for monitoring
   */
  private emitFilteredEvent(
    email: GmailEmailData, 
    filterResult: any, 
    source: EmailSource
  ): void {
    this.eventEmitter.emit('email.filtered', {
      emailId: email.id,
      emailAddress: email.metadata.to,
      subject: email.metadata.subject,
      from: email.metadata.from,
      category: filterResult.category,
      priority: filterResult.priority,
      reasoning: filterResult.reasoning,
      confidence: filterResult.confidence,
      timestamp: new Date().toISOString(),
      source,
    });
  }

  /**
   * Emit triage failed event
   */
  private emitTriageFailedEvent(
    email: GmailEmailData, 
    source: EmailSource, 
    errorMessage: string
  ): void {
    this.eventEmitter.emit('email.triage.failed', {
      emailId: email.id,
      emailAddress: email.metadata.to,
      subject: email.metadata.subject,
      from: email.metadata.from,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      source,
    });
  }
} 