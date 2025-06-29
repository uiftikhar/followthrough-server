import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface EmailTriageEventData {
  emailId: string;
  emailAddress: string;
  subject: string;
  from: string;
  sessionId?: string;
  timestamp: string;
  source: 'push' | 'pull' | 'test' | 'manual';
  result?: any;
  classification?: any;
  summary?: any;
  replyDraft?: any;
  retrievedContext?: any;
  processingMetadata?: any;
  triageResults?: any;
  databaseSession?: any;
}

export interface EmailFilterEventData {
  emailId: string;
  emailAddress: string;
  subject: string;
  from: string;
  category: string;
  priority: string;
  reasoning: string;
  confidence: number;
  timestamp: string;
  source: 'push' | 'pull' | 'test' | 'manual';
}

export interface EmailErrorEventData {
  emailId: string;
  emailAddress: string;
  subject: string;
  from: string;
  error: string;
  timestamp: string;
  source: 'push' | 'pull' | 'test' | 'manual';
  sessionId?: string;
}

/**
 * EmailTriageEventService - Centralized Event Emission
 * 
 * This service standardizes all email triage event emission to ensure
 * consistent event structure across all entry points and processing flows.
 * 
 * Benefits:
 * - Consistent event structure
 * - Centralized event management
 * - Easy to modify event schemas
 * - Better monitoring and debugging
 */
@Injectable()
export class EmailTriageEventService {
  private readonly logger = new Logger(EmailTriageEventService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit when email triage processing starts
   */
  emitTriageStarted(data: EmailTriageEventData): void {
    this.logger.log(`📡 Emitting triage.started for email: ${data.emailId}`);
    
    this.eventEmitter.emit('email.triage.started', {
      emailId: data.emailId,
      emailAddress: data.emailAddress,
      subject: data.subject,
      from: data.from,
      sessionId: data.sessionId,
      timestamp: data.timestamp,
      source: data.source,
    });
  }

  /**
   * Emit when email triage processing completes successfully
   */
  emitTriageCompleted(data: EmailTriageEventData): void {
    this.logger.log(`📡 Emitting triage.completed for email: ${data.emailId}`);
    
    // Emit basic completion event (backward compatibility)
    this.eventEmitter.emit('email.triage.completed', {
      emailId: data.emailId,
      emailAddress: data.emailAddress,
      subject: data.subject,
      from: data.from,
      sessionId: data.sessionId,
      result: data.result,
      classification: data.classification,
      summary: data.summary,
      replyDraft: data.replyDraft,
      retrievedContext: data.retrievedContext,
      processingMetadata: data.processingMetadata,
      timestamp: data.timestamp,
      source: data.source,
      langGraph: true,
    });

    // Emit enhanced results event with complete data
    this.eventEmitter.emit('email.triage.results', {
      emailId: data.emailId,
      emailAddress: data.emailAddress,
      subject: data.subject,
      from: data.from,
      sessionId: data.sessionId,
      triageResults: data.triageResults,
      databaseSession: data.databaseSession,
      timestamp: data.timestamp,
      source: data.source,
      langGraph: true,
    });
  }

  /**
   * Emit when email triage processing fails
   */
  emitTriageFailed(data: EmailErrorEventData): void {
    this.logger.error(`📡 Emitting triage.failed for email: ${data.emailId}`);
    
    this.eventEmitter.emit('email.triage.failed', {
      emailId: data.emailId,
      emailAddress: data.emailAddress,
      subject: data.subject,
      from: data.from,
      sessionId: data.sessionId,
      error: data.error,
      timestamp: data.timestamp,
      source: data.source,
    });
  }

  /**
   * Emit when email is filtered out (not processed)
   */
  emitEmailFiltered(data: EmailFilterEventData): void {
    this.logger.log(`📡 Emitting email.filtered for email: ${data.emailId} (${data.category})`);
    
    this.eventEmitter.emit('email.filtered', {
      emailId: data.emailId,
      emailAddress: data.emailAddress,
      subject: data.subject,
      from: data.from,
      category: data.category,
      priority: data.priority,
      reasoning: data.reasoning,
      confidence: data.confidence,
      timestamp: data.timestamp,
      source: data.source,
    });
  }

  /**
   * Emit when email is received (before processing)
   */
  emitEmailReceived(data: {
    emailId: string;
    emailAddress: string;
    subject: string;
    from: string;
    to: string;
    body: string;
    timestamp: string;
    fullEmail: any;
    source: 'push' | 'pull' | 'test' | 'manual';
  }): void {
    this.logger.log(`📡 Emitting email.received for email: ${data.emailId}`);
    
    this.eventEmitter.emit('email.received', {
      emailId: data.emailId,
      emailAddress: data.emailAddress,
      subject: data.subject,
      from: data.from,
      to: data.to,
      body: data.body.substring(0, 500), // First 500 chars for preview
      timestamp: data.timestamp,
      fullEmail: data.fullEmail,
      source: data.source,
    });
  }

  /**
   * Emit when email processing is in progress
   */
  emitTriageProcessing(data: {
    emailId: string;
    emailAddress: string;
    subject: string;
    sessionId?: string;
    timestamp: string;
    source: 'push' | 'pull' | 'test' | 'manual';
    status: 'processing';
  }): void {
    this.logger.log(`📡 Emitting triage.processing for email: ${data.emailId}`);
    
    this.eventEmitter.emit('email.triage.processing', {
      emailId: data.emailId,
      emailAddress: data.emailAddress,
      subject: data.subject,
      sessionId: data.sessionId,
      timestamp: data.timestamp,
      source: data.source,
      status: data.status,
    });
  }

  /**
   * Emit user disconnection event
   */
  emitUserDisconnected(data: {
    userId: string;
    userEmail: string;
    googleEmail?: string;
    timestamp: string;
    source: 'user_request' | 'admin_action';
    pubsubUnsubscribed: boolean;
    watchStopped: boolean;
    sessionsCleared: boolean;
    success?: boolean;
    error?: string;
  }): void {
    this.logger.log(`📡 Emitting email.triage.disconnected for user: ${data.userId}`);
    
    this.eventEmitter.emit('email.triage.disconnected', data);
  }
} 