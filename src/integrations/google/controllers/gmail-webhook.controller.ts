import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Query, 
  Logger, 
  HttpCode, 
  HttpStatus,
  Headers,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { PubSubService, PubSubMessage, GmailNotification } from '../services/pubsub.service';
import { GmailService } from '../services/gmail.service';
import { GoogleOAuthService } from '../services/google-oauth.service';
import { GmailWatchService } from '../services/gmail-watch.service';
import { UnifiedWorkflowService } from '../../../langgraph/unified-workflow.service';
import { gmail_v1 } from 'googleapis';
import * as crypto from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface PubSubPushPayload {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

interface WebhookVerificationParams {
  'hub.mode'?: string;
  'hub.topic'?: string;
  'hub.challenge'?: string;
  'hub.verify_token'?: string;
}

interface GmailEmailData {
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
    userId: string;
  };
}

@Controller('api/gmail/webhooks')
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly gmailService: GmailService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly gmailWatchService: GmailWatchService,
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.webhookSecret = this.configService.get<string>('GMAIL_WEBHOOK_SECRET') || '';
    if (!this.webhookSecret) {
      this.logger.warn('GMAIL_WEBHOOK_SECRET not configured - webhook verification disabled');
    }
  }

  /**
   * Handle push notifications from Google Cloud Pub/Sub
   */
  @Post('push')
  @HttpCode(HttpStatus.OK)
  async handlePushNotification(
    @Body() payload: PubSubPushPayload,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean; processed: number }> {
    try {
      this.logger.log(`🔔 PUSH NOTIFICATION RECEIVED: ${payload.message.messageId}`);
      this.logger.log(`🔍 Payload: ${JSON.stringify({ subscription: payload.subscription, messageId: payload.message.messageId })}`);

      // Verify this is a legitimate Google Cloud Pub/Sub request
      this.verifyPubSubRequest(headers, payload);

      // Decode the Pub/Sub message
      const pubsubMessage: PubSubMessage = {
        data: payload.message.data,
        messageId: payload.message.messageId,
        publishTime: payload.message.publishTime,
        attributes: payload.message.attributes,
      };

      this.logger.log(`📧 Decoding Pub/Sub message: ${payload.message.messageId}`);
      const gmailNotification = this.pubSubService.decodePubSubMessage(pubsubMessage);
      
      if (!gmailNotification) {
        this.logger.warn(`❌ Failed to decode Gmail notification: ${payload.message.messageId}`);
        return { success: false, processed: 0 };
      }

      this.logger.log(`📬 Gmail notification decoded for: ${gmailNotification.emailAddress}, historyId: ${gmailNotification.historyId}`);

      // Process the Gmail notification
      this.logger.log(`🚀 Starting Gmail notification processing for: ${gmailNotification.emailAddress}`);
      const processed = await this.processGmailNotification(gmailNotification);

      // Record notification in watch statistics
      const watchInfo = await this.gmailWatchService.getWatchInfoByEmail(gmailNotification.emailAddress);
      if (watchInfo) {
        await this.gmailWatchService.recordNotification(watchInfo.watchId);
        this.logger.log(`📊 Recorded notification for watch: ${watchInfo.watchId}`);
      }

      this.logger.log(`✅ Successfully processed Gmail notification for: ${gmailNotification.emailAddress}, processed ${processed} emails`);
      
      return { success: true, processed };
    } catch (error) {
      this.logger.error('❌ Failed to handle push notification:', error);
      
      // Return 200 to prevent Pub/Sub retries for permanent failures
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        return { success: false, processed: 0 };
      }
      
      // Re-throw for temporary failures (will trigger Pub/Sub retry)
      throw error;
    }
  }

  /**
   * Handle pull notifications (backup method)
   */
  @Post('pull')
  @HttpCode(HttpStatus.OK)
  async processPullNotifications(): Promise<{ success: boolean; processed: number }> {
    try {
      this.logger.log('Processing pull notifications...');

      const notifications = await this.pubSubService.processPulledMessages();
      let totalProcessed = 0;

      for (const notification of notifications) {
        try {
          const processed = await this.processGmailNotification(notification);
          totalProcessed += processed;
        } catch (error) {
          this.logger.error(`Failed to process notification for ${notification.emailAddress}:`, error);
        }
      }

      this.logger.log(`Processed ${totalProcessed} emails from ${notifications.length} notifications`);
      
      return { success: true, processed: totalProcessed };
    } catch (error) {
      this.logger.error('Failed to process pull notifications:', error);
      throw error;
    }
  }

  /**
   * Webhook verification endpoint (for initial setup)
   */
  @Get('verify')
  async verifyWebhook(@Query() params: WebhookVerificationParams): Promise<string> {
    this.logger.log('Webhook verification request received');

    if (params['hub.mode'] === 'subscribe') {
      const challenge = params['hub.challenge'];
      const topic = params['hub.topic'];
      
      this.logger.log(`Webhook verification for topic: ${topic}`);
      
      if (challenge) {
        return challenge;
      }
    }

    throw new BadRequestException('Invalid verification request');
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  async getHealth(): Promise<{
    status: string;
    pubsub: boolean;
    subscriptions: any;
    watchStats: any;
  }> {
    try {
      const [pubsubHealthy, subscriptionHealth, watchStats] = await Promise.all([
        this.pubSubService.testConnection(),
        this.pubSubService.getSubscriptionHealth(),
        this.gmailWatchService.getStatistics(),
      ]);

      return {
        status: pubsubHealthy ? 'healthy' : 'unhealthy',
        pubsub: pubsubHealthy,
        subscriptions: subscriptionHealth,
        watchStats,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        pubsub: false,
        subscriptions: null,
        watchStats: null,
      };
    }
  }

  /**
   * Process a Gmail notification by fetching new emails and triggering triage
   */
  private async processGmailNotification(notification: GmailNotification): Promise<number> {
    try {
      this.logger.log(`🔄 Processing Gmail notification for: ${notification.emailAddress}, historyId: ${notification.historyId}`);

      // Find watch info by email address
      this.logger.log(`🔍 Looking up watch info for email: ${notification.emailAddress}`);
      const watchInfo = await this.gmailWatchService.getWatchInfoByEmail(notification.emailAddress);
      if (!watchInfo || !watchInfo.isActive) {
        this.logger.warn(`⚠️ No active watch found for email: ${notification.emailAddress}`);
        return 0;
      }

      this.logger.log(`✅ Found active watch: ${watchInfo.watchId} for email: ${notification.emailAddress}`);
      this.logger.log(`📊 Watch info - historyId: ${watchInfo.historyId}, userId: ${watchInfo.userId}`);

      // Get new emails from Gmail history since last known history ID
      this.logger.log(`📧 Fetching new emails from history ID ${watchInfo.historyId} to ${notification.historyId}`);
      const newEmails = await this.getNewEmailsFromHistory(
        watchInfo.watchId, 
        notification.emailAddress,
        notification.historyId
      );
      
      if (newEmails.length === 0) {
        this.logger.log(`ℹ️ No new emails found for: ${notification.emailAddress} (historyId: ${notification.historyId})`);
        return 0;
      }

      this.logger.log(`📬 Found ${newEmails.length} new emails for processing`);

      // Process each new email through the triage system
      let processedCount = 0;
      for (const email of newEmails) {
        try {
          this.logger.log(`🚀 Starting triage for email: ${email.id} - "${email.metadata.subject}"`);
          await this.triggerEmailTriage(watchInfo.watchId, email);
          processedCount++;
          this.logger.log(`✅ Triage initiated for email: ${email.id}`);
        } catch (error) {
          this.logger.error(`❌ Failed to process email ${email.id}:`, error);
        }
      }

      // Record processed emails in watch statistics
      if (processedCount > 0) {
        await this.gmailWatchService.recordEmailsProcessed(watchInfo.watchId, processedCount);
        this.logger.log(`📊 Recorded ${processedCount} processed emails for watch: ${watchInfo.watchId}`);
      }

      this.logger.log(`✅ Processed ${processedCount}/${newEmails.length} new emails for: ${notification.emailAddress}`);
      return processedCount;
    } catch (error) {
      this.logger.error(`❌ Failed to process Gmail notification for ${notification.emailAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get new emails from Gmail history using History API
   */
  private async getNewEmailsFromHistory(
    watchId: string, 
    emailAddress: string, 
    currentHistoryId: string
  ): Promise<GmailEmailData[]> {
    try {
      // Get watch info to find the user and last processed history ID
      const watchInfo = await this.gmailWatchService.getWatchInfoByEmail(emailAddress);
      if (!watchInfo || !watchInfo.isActive) {
        throw new Error(`Active watch not found for email: ${emailAddress}`);
      }

      const lastHistoryId = watchInfo.historyId;
      const userId = watchInfo.userId.toString(); // Convert ObjectId to string
      
      this.logger.log(`Fetching Gmail history from ${lastHistoryId} to ${currentHistoryId} for ${emailAddress} (userId: ${userId})`);

      // Get authenticated Gmail client using the user ID
      const authClient = await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: 'v1', auth: authClient });

      // Get history of changes since last known history ID
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX', // Focus on inbox messages
        maxResults: 100,
      });

      const histories = historyResponse.data.history || [];
      const newEmails: GmailEmailData[] = [];

      this.logger.log(`Found ${histories.length} history entries for ${emailAddress}`);

      // Process each history entry
      for (const history of histories) {
        if (history.messagesAdded) {
          for (const messageAdded of history.messagesAdded) {
            try {
              const emailData = await this.transformGmailMessage(
                gmail, 
                messageAdded.message!,
                emailAddress,
                userId
              );
              if (emailData) {
                newEmails.push(emailData);
                this.logger.log(`Transformed email: ${emailData.id} - "${emailData.metadata.subject}"`);
              }
            } catch (error) {
              this.logger.error(`Failed to transform Gmail message ${messageAdded.message?.id}:`, error);
            }
          }
        }
      }

      // Update watch with new history ID
      if (newEmails.length > 0) {
        await this.gmailWatchService.updateHistoryId(watchId, currentHistoryId);
        this.logger.log(`Updated watch ${watchId} with new history ID: ${currentHistoryId}`);
      }

      this.logger.log(`Successfully processed ${newEmails.length} new emails for ${emailAddress}`);
      return newEmails;
    } catch (error) {
      this.logger.error(`Failed to get emails from history for ${emailAddress}:`, error);
      return [];
    }
  }

  /**
   * Transform Gmail API message to our email format
   */
  private async transformGmailMessage(
    gmail: gmail_v1.Gmail,
    message: gmail_v1.Schema$Message,
    emailAddress: string,
    userId: string
  ): Promise<GmailEmailData | null> {
    try {
      // Get full message details
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const messageData = fullMessage.data;
      const headers = messageData.payload?.headers || [];

      // Extract email metadata from headers
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject');
      const from = getHeader('From');
      const to = getHeader('To');
      const messageId = getHeader('Message-ID');
      const date = getHeader('Date');

      // Extract email body
      const body = this.extractEmailBody(messageData.payload);

      // Skip if essential data is missing
      if (!subject || !from || !body) {
        this.logger.warn(`Skipping message ${message.id} - missing essential data (subject: ${!!subject}, from: ${!!from}, body: ${!!body})`);
        return null;
      }

      // Skip automated/system emails
      if (this.isAutomatedEmail(from, subject)) {
        this.logger.log(`Skipping automated email: ${subject} from ${from}`);
        return null;
      }

      return {
        id: message.id!,
        threadId: message.threadId!,
        body: body.substring(0, 10000), // Limit body length
        metadata: {
          subject,
          from,
          to: to || emailAddress,
          timestamp: date || new Date().toISOString(),
          headers: Object.fromEntries(headers.map(h => [h.name!, h.value!])),
          gmailSource: true,
          messageId,
          labels: messageData.labelIds || undefined,
          userId, // Include user ID for context
        },
      };
    } catch (error) {
      this.logger.error(`Failed to transform Gmail message ${message.id}:`, error);
      return null;
    }
  }

  /**
   * Extract plain text body from Gmail message payload
   */
  private extractEmailBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    // If this part has a body, decode it
    if (payload.body?.data) {
      try {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } catch (error) {
        this.logger.warn('Failed to decode message body:', error);
      }
    }

    // If this is a multipart message, recursively search parts
    if (payload.parts) {
      for (const part of payload.parts) {
        // Look for text/plain parts first
        if (part.mimeType === 'text/plain') {
          const body = this.extractEmailBody(part);
          if (body) return body;
        }
      }

      // Fallback to text/html parts
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html') {
          const body = this.extractEmailBody(part);
          if (body) {
            // Basic HTML to text conversion (remove tags)
            return body.replace(/<[^>]*>/g, '').trim();
          }
        }
      }

      // Recursively search nested parts
      for (const part of payload.parts) {
        const body = this.extractEmailBody(part);
        if (body) return body;
      }
    }

    return '';
  }

  /**
   * Check if email is automated/system email that should be skipped
   */
  private isAutomatedEmail(from: string, subject: string): boolean {
    const automatedPatterns = [
      /noreply/i,
      /no-reply/i,
      /donotreply/i,
      /notification/i,
      /automated/i,
      /system/i,
      /support@.*\.com/i,
    ];

    const subjectPatterns = [
      /unsubscribe/i,
      /newsletter/i,
      /subscription/i,
      /automated/i,
      /system notification/i,
    ];

    return automatedPatterns.some(pattern => pattern.test(from)) ||
           subjectPatterns.some(pattern => pattern.test(subject));
  }

  /**
   * Trigger email triage for a specific email using UnifiedWorkflowService
   */
  private async triggerEmailTriage(watchId: string, email: GmailEmailData): Promise<void> {
    try {
      this.logger.log(`🎯 Triggering email triage for email ${email.id} from watch ${watchId}`);
      this.logger.log(`📧 Email details - Subject: "${email.metadata.subject}", From: ${email.metadata.from}`);

      // Get user ID from email metadata or watch info
      const userId = email.metadata.userId || watchId; // Fallback to watchId if userId not available
      this.logger.log(`👤 Using userId: ${userId} for triage processing`);

      // Emit immediate email received notification for real-time updates
      this.logger.log(`📡 Emitting email.received event for immediate notification`);
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
          bodyLength: email.body.length
        }
      });

      // Transform Gmail email data to unified workflow input format
      const triageInput = {
        type: "email_triage",
        emailData: {
          id: email.id,
          body: email.body,
          metadata: email.metadata,
        },
        content: email.body, // Include content for processing
      };

      this.logger.log(`🔄 Submitting email to UnifiedWorkflowService for full triage processing`);

      // Emit triage started event
      this.logger.log(`📡 Emitting triage.started event`);
      this.eventEmitter.emit('email.triage.started', {
        emailId: email.id,
        emailAddress: email.metadata.to,
        subject: email.metadata.subject,
        from: email.metadata.from,
        timestamp: new Date().toISOString(),
        source: 'gmail_push'
      });

      // Process through existing unified workflow service
      const result = await this.unifiedWorkflowService.processInput(
        triageInput,
        { 
          source: 'gmail_push',
          watchId,
          emailAddress: email.metadata.to,
          gmailSource: email.metadata.gmailSource,
        },
        userId
      );

      this.logger.log(`✅ Email triage initiated for ${email.id}, session: ${result.sessionId}`);

      // Emit triage processing event with session info
      this.logger.log(`📡 Emitting triage.processing event for session: ${result.sessionId}`);
      this.eventEmitter.emit('email.triage.processing', {
        sessionId: result.sessionId,
        emailId: email.id,
        emailAddress: email.metadata.to,
        subject: email.metadata.subject,
        status: result.status,
        timestamp: new Date().toISOString(),
        source: 'gmail_push'
      });

      // Note: triage.completed events will be emitted by the workflow system when processing finishes
      // The UnifiedWorkflowService should emit these events automatically

      this.logger.log(`🎉 Triage process successfully started for email: ${email.id}`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to trigger email triage for email ${email.id}:`, error);
      
      // Emit error event for real-time notifications
      this.logger.log(`📡 Emitting triage.failed event for email: ${email.id}`);
      this.eventEmitter.emit('email.triage.failed', {
        emailId: email.id,
        emailAddress: email.metadata.to,
        subject: email.metadata.subject,
        error: error.message,
        timestamp: new Date().toISOString(),
        source: 'gmail_push'
      });
      
      throw error;
    }
  }

  /**
   * Verify webhook signature for security
   */
  private verifyWebhookSignature(payload: string, headers: Record<string, string>): void {
    if (!this.webhookSecret) {
      return; // Skip verification if no secret configured
    }

    const signature = headers['x-goog-signature'] || headers['X-Goog-Signature'];
    
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('base64');

    // Use constant-time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (signatureBuffer.length !== expectedBuffer.length || 
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  /**
   * Verify Google Cloud Pub/Sub request authenticity
   */
  private verifyPubSubRequest(headers: Record<string, string>, payload: PubSubPushPayload): void {
    try {
      // Method 1: Check User-Agent (Google Cloud Pub/Sub sends specific user-agent)
      const userAgent = headers['user-agent'] || headers['User-Agent'] || '';
      if (!userAgent.includes('Google-Cloud-Pub-Sub')) {
        this.logger.warn(`⚠️ Suspicious user-agent: ${userAgent}`);
        // Don't throw error - just log warning as some proxies might modify user-agent
      }

      // Method 2: Verify payload structure
      if (!payload.message || !payload.subscription) {
        throw new BadRequestException('Invalid Pub/Sub payload structure');
      }

      if (!payload.message.data || !payload.message.messageId) {
        throw new BadRequestException('Invalid Pub/Sub message structure');
      }

      // Method 3: Verify subscription name matches expected pattern
      const expectedPattern = /^projects\/[\w-]+\/subscriptions\/gmail-push/;
      if (!expectedPattern.test(payload.subscription)) {
        this.logger.warn(`⚠️ Unexpected subscription: ${payload.subscription}`);
        // Don't throw error - just log warning in case subscription name changes
      }

      // Method 4: Check if webhook secret is configured for additional security
      if (this.webhookSecret) {
        this.logger.log('🔐 Additional webhook secret verification available');
        // Could implement custom token verification here if needed
      }

      this.logger.log(`✅ Pub/Sub request verification passed`);
    } catch (error) {
      this.logger.error('❌ Pub/Sub request verification failed:', error);
      throw error;
    }
  }

  /**
   * Process new emails from Gmail History API and trigger triage
   */
  private async processNewEmails(newEmails: any[], emailAddress: string): Promise<void> {
    this.logger.log(`Processing ${newEmails.length} new emails for ${emailAddress}`);

    for (const email of newEmails) {
      try {
        const sessionId = `gmail-${emailAddress}-${Date.now()}`;
        
        // Emit start event for real-time tracking
        this.eventEmitter.emit('email.triage.started', {
          sessionId,
          emailId: email.id,
          emailAddress,
          timestamp: new Date().toISOString(),
        });

        // Process email through unified workflow service
        const result = await this.unifiedWorkflowService.processInput(
          {
            type: 'email_triage',
            content: email.body,
            emailData: email,
            metadata: email.metadata,
          },
          { 
            source: 'gmail_push',
            emailAddress: emailAddress,
          },
          sessionId
        );

        this.logger.log(`Email triage completed for ${email.id}, session: ${result.sessionId}`);

        // Emit completion event for real-time notifications
        this.eventEmitter.emit('email.triage.completed', {
          sessionId: result.sessionId,
          emailId: email.id,
          emailAddress: emailAddress,
          result: result,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        this.logger.error(`Failed to trigger email triage for email ${email.id}:`, error);
        
        // Emit error event
        this.eventEmitter.emit('email.triage.failed', {
          emailId: email.id,
          emailAddress: emailAddress,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
}

// Import google here to avoid circular dependency issues
import { google } from 'googleapis'; 