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
import { PubSubService, PubSubMessage, GmailNotification } from '../services/pubsub.service';
import { GmailService } from '../services/gmail.service';
import { GoogleOAuthService } from '../services/google-oauth.service';
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

@Controller('api/gmail/webhooks')
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly gmailService: GmailService,
    private readonly googleOAuthService: GoogleOAuthService,
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
  }> {
    try {
      const pubsubHealthy = await this.pubSubService.testConnection();
      const subscriptionHealth = await this.pubSubService.getSubscriptionHealth();

      return {
        status: pubsubHealthy ? 'healthy' : 'unhealthy',
        pubsub: pubsubHealthy,
        subscriptions: subscriptionHealth,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        pubsub: false,
        subscriptions: null,
      };
    }
  }

  /**
   * Process a Gmail notification by fetching new emails and triggering triage
   */
  private async processGmailNotification(notification: GmailNotification): Promise<number> {
    try {
      // Find user by email address
      const user = await this.findUserByEmail(notification.emailAddress);
      if (!user) {
        this.logger.warn(`No user found for email: ${notification.emailAddress}`);
        return 0;
      }

      // Get Gmail history since last known history ID
      const newEmails = await this.getNewEmailsFromHistory(user.userId, notification.historyId);
      
      if (newEmails.length === 0) {
        this.logger.log(`No new emails found for: ${notification.emailAddress}`);
        return 0;
      }

      // Process each new email through the triage system
      let processedCount = 0;
      for (const email of newEmails) {
        try {
          await this.triggerEmailTriage(user.userId, email);
          processedCount++;
        } catch (error) {
          this.logger.error(`Failed to process email ${email.id}:`, error);
        }
      }

      this.logger.log(`Processed ${processedCount}/${newEmails.length} new emails for: ${notification.emailAddress}`);
      return processedCount;
    } catch (error) {
      this.logger.error(`Failed to process Gmail notification for ${notification.emailAddress}:`, error);
      throw error;
    }
  }

  /**
   * Find user by email address
   */
  private async findUserByEmail(emailAddress: string): Promise<{ userId: string } | null> {
    try {
      // This would typically query your user database
      // For now, we'll use the Google OAuth service to find the user
      const userInfo = await this.googleOAuthService.getGoogleUserInfo(emailAddress);
      
      if (userInfo) {
        return { userId: userInfo.googleUserId };
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to find user by email ${emailAddress}:`, error);
      return null;
    }
  }

  /**
   * Get new emails from Gmail history
   */
  private async getNewEmailsFromHistory(userId: string, historyId: string): Promise<any[]> {
    try {
      // This would use the Gmail History API to get changes since historyId
      // For now, we'll get recent messages from inbox
      const result = await this.gmailService.getMessages(userId, {
        query: 'in:inbox',
        maxResults: 10,
      });

      return result.messages;
    } catch (error) {
      this.logger.error(`Failed to get new emails for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Trigger email triage for a specific email
   */
  private async triggerEmailTriage(userId: string, email: any): Promise<void> {
    try {
      // This would integrate with your existing email triage system
      // For now, we'll just log the action
      this.logger.log(`Triggering email triage for user ${userId}, email ${email.id}`);
      
      // TODO: Integrate with UnifiedWorkflowService or EmailTriageManager
      // const triageResult = await this.emailTriageService.processEmail({
      //   userId,
      //   emailData: email,
      //   source: 'gmail_push',
      // });
      
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

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
} 