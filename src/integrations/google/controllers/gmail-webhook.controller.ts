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
      this.logger.log(`Received push notification: ${payload.message.messageId}`);

      // Verify webhook authenticity if secret is configured
      if (this.webhookSecret) {
        this.verifyWebhookSignature(JSON.stringify(payload), headers);
      }

      // Decode the Pub/Sub message
      const pubsubMessage: PubSubMessage = {
        data: payload.message.data,
        messageId: payload.message.messageId,
        publishTime: payload.message.publishTime,
        attributes: payload.message.attributes,
      };

      const gmailNotification = this.pubSubService.decodePubSubMessage(pubsubMessage);
      
      if (!gmailNotification) {
        this.logger.warn(`Failed to decode Gmail notification: ${payload.message.messageId}`);
        return { success: false, processed: 0 };
      }

      // Process the Gmail notification
      const processed = await this.processGmailNotification(gmailNotification);

      // Record notification in watch statistics
      const watchInfo = await this.gmailWatchService.getWatchInfoByEmail(gmailNotification.emailAddress);
      if (watchInfo) {
        await this.gmailWatchService.recordNotification(watchInfo.watchId);
      }

      this.logger.log(`Successfully processed Gmail notification for: ${gmailNotification.emailAddress}`);
      
      return { success: true, processed };
    } catch (error) {
      this.logger.error('Failed to handle push notification:', error);
      
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
      this.logger.log(`Processing Gmail notification for: ${notification.emailAddress}`);

      // Find watch info by email address
      const watchInfo = await this.gmailWatchService.getWatchInfoByEmail(notification.emailAddress);
      if (!watchInfo || !watchInfo.isActive) {
        this.logger.warn(`No active watch found for email: ${notification.emailAddress}`);
        return 0;
      }

      // Get new emails from Gmail history since last known history ID
      const newEmails = await this.getNewEmailsFromHistory(
        watchInfo.watchId, 
        notification.emailAddress,
        notification.historyId
      );
      
      if (newEmails.length === 0) {
        this.logger.log(`No new emails found for: ${notification.emailAddress}`);
        return 0;
      }

      // Process each new email through the triage system
      let processedCount = 0;
      for (const email of newEmails) {
        try {
          await this.triggerEmailTriage(watchInfo.watchId, email);
          processedCount++;
        } catch (error) {
          this.logger.error(`Failed to process email ${email.id}:`, error);
        }
      }

      // Record processed emails in watch statistics
      if (processedCount > 0) {
        await this.gmailWatchService.recordEmailsProcessed(watchInfo.watchId, processedCount);
      }

      this.logger.log(`Processed ${processedCount}/${newEmails.length} new emails for: ${notification.emailAddress}`);
      return processedCount;
    } catch (error) {
      this.logger.error(`Failed to process Gmail notification for ${notification.emailAddress}:`, error);
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
      // Get watch info to find last processed history ID - need to find user by email
      const watchInfo = await this.gmailWatchService.getWatchInfoByEmail(emailAddress);
      if (!watchInfo || !watchInfo.isActive) {
        throw new Error(`Active watch not found for email: ${emailAddress}`);
      }

      const lastHistoryId = watchInfo.historyId;
      
      this.logger.log(`Fetching Gmail history from ${lastHistoryId} to ${currentHistoryId} for ${emailAddress}`);

      // Get authenticated Gmail client - we need to find the user associated with this email
      // For now, we'll use a different approach to get the user ID
      const userTokens = await this.googleOAuthService.getGoogleUserInfo(emailAddress);
      if (!userTokens) {
        throw new Error(`No user tokens found for email: ${emailAddress}`);
      }
      
      const client = await this.googleOAuthService.getAuthenticatedClient(userTokens.googleUserId);
      const gmail = google.gmail({ version: 'v1', auth: client });

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

      // Process each history entry
      for (const history of histories) {
        if (history.messagesAdded) {
          for (const messageAdded of history.messagesAdded) {
            try {
              const emailData = await this.transformGmailMessage(
                gmail, 
                messageAdded.message!,
                emailAddress
              );
              if (emailData) {
                newEmails.push(emailData);
              }
            } catch (error) {
              this.logger.error(`Failed to transform Gmail message ${messageAdded.message?.id}:`, error);
            }
          }
        }
      }

      // Update watch with new history ID
      await this.gmailWatchService.recordNotification(watchId);
      // Note: In production, you'd want to update the history ID in the watch record

      this.logger.log(`Found ${newEmails.length} new emails in history for ${emailAddress}`);
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
    emailAddress: string
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
        this.logger.warn(`Skipping message ${message.id} - missing essential data`);
        return null;
      }

      return {
        id: message.id!,
        threadId: message.threadId!,
        body,
        metadata: {
          subject,
          from,
          to: to || emailAddress,
          timestamp: date || new Date().toISOString(),
          headers: Object.fromEntries(headers.map(h => [h.name!, h.value!])),
          gmailSource: true,
          messageId,
          labels: messageData.labelIds || undefined,
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
   * Trigger email triage for a specific email using UnifiedWorkflowService
   */
  private async triggerEmailTriage(watchId: string, email: GmailEmailData): Promise<void> {
    try {
      this.logger.log(`Triggering email triage for email ${email.id} from watch ${watchId}`);

      // Transform Gmail email data to unified workflow input format
      const triageInput = {
        type: "email_triage",
        emailData: {
          id: email.id,
          body: email.body,
          metadata: email.metadata,
        },
        sessionId: `gmail-${email.id}-${Date.now()}`,
      };

      // Process through existing unified workflow service
      const result = await this.unifiedWorkflowService.processInput(
        triageInput,
        { 
          source: 'gmail_push',
          watchId,
          ...email.metadata 
        },
        watchId // Use watchId as userId context for now
      );

      this.logger.log(`Email triage completed for ${email.id}, session: ${result.sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to trigger email triage for email ${email.id}:`, error);
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
}

// Import google here to avoid circular dependency issues
import { google } from 'googleapis'; 