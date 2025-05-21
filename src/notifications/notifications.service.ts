import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly notificationChannels: Map<string, boolean> = new Map();
  
  constructor(
    private configService: ConfigService,
  ) {
    // Initialize notification channels from config
    this.notificationChannels.set('email', this.configService.get<boolean>('NOTIFICATIONS_EMAIL_ENABLED', true));
    this.notificationChannels.set('push', this.configService.get<boolean>('NOTIFICATIONS_PUSH_ENABLED', false));
    this.notificationChannels.set('slack', this.configService.get<boolean>('NOTIFICATIONS_SLACK_ENABLED', false));
  }

  /**
   * Send a notification to a user via all enabled channels
   */
  async sendNotification(
    userId: string,
    notification: NotificationPayload,
  ): Promise<boolean> {
    try {
      this.logger.log(`Sending notification to user ${userId}: ${notification.title}`);
      
      const results = await Promise.all([
        this.notificationChannels.get('email') ? this.sendEmailNotification(userId, notification) : Promise.resolve(false),
        this.notificationChannels.get('push') ? this.sendPushNotification(userId, notification) : Promise.resolve(false),
        this.notificationChannels.get('slack') ? this.sendSlackNotification(userId, notification) : Promise.resolve(false),
      ]);
      
      const successfulDeliveries = results.filter(Boolean).length;
      return successfulDeliveries > 0;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Send an email notification
   */
  private async sendEmailNotification(
    userId: string,
    notification: NotificationPayload,
  ): Promise<boolean> {
    try {
      // In a real implementation, this would send an actual email
      // For now, we'll just log it
      this.logger.debug(`[EMAIL] To: ${userId}, Subject: ${notification.title}, Body: ${notification.body}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email notification: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Send a push notification
   */
  private async sendPushNotification(
    userId: string,
    notification: NotificationPayload,
  ): Promise<boolean> {
    try {
      // In a real implementation, this would send a push notification
      // For now, we'll just log it
      this.logger.debug(`[PUSH] To: ${userId}, Title: ${notification.title}, Body: ${notification.body}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Send a Slack notification
   */
  private async sendSlackNotification(
    userId: string,
    notification: NotificationPayload,
  ): Promise<boolean> {
    try {
      // In a real implementation, this would send a Slack message
      // For now, we'll just log it
      this.logger.debug(`[SLACK] To: ${userId}, Text: ${notification.title} - ${notification.body}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send Slack notification: ${error.message}`);
      return false;
    }
  }
} 