import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub, Message, Subscription } from '@google-cloud/pubsub';

export interface PubSubMessage {
  data: string;
  messageId: string;
  publishTime: string;
  attributes?: Record<string, string>;
}

export interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

@Injectable()
export class PubSubService {
  private readonly logger = new Logger(PubSubService.name);
  private readonly pubSubClient: PubSub;
  private readonly projectId: string;
  private readonly topicName: string;
  private readonly pushSubscriptionName: string;
  private readonly pullSubscriptionName: string;

  constructor(private readonly configService: ConfigService) {
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID is required');
    }
    this.projectId = projectId;
    
    this.topicName = this.configService.get<string>('GMAIL_PUBSUB_TOPIC') || 'gmail-notifications';
    this.pushSubscriptionName = this.configService.get<string>('GMAIL_PUSH_SUBSCRIPTION') || 'gmail-push-notification-subscription';
    this.pullSubscriptionName = this.configService.get<string>('GMAIL_PULL_SUBSCRIPTION') || 'gmail-pull-notification-subscription';

    // Initialize Pub/Sub client
    this.pubSubClient = new PubSub({
      projectId: this.projectId,
      keyFilename: this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS'),
    });

    this.validateConfiguration();
  }

  /**
   * Decode a Pub/Sub message from Gmail push notification
   */
  decodePubSubMessage(message: PubSubMessage): GmailNotification | null {
    try {
      // Decode base64 data
      const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
      const notification = JSON.parse(decodedData) as GmailNotification;

      this.logger.log(`Decoded Gmail notification for: ${notification.emailAddress}, historyId: ${notification.historyId}`);
      
      return notification;
    } catch (error) {
      this.logger.error('Failed to decode Pub/Sub message:', error);
      return null;
    }
  }

  /**
   * Acknowledge a Pub/Sub message
   */
  async acknowledgeMessage(subscription: Subscription, message: Message): Promise<void> {
    try {
      message.ack();
      this.logger.log(`Message acknowledged: ${message.id}`);
    } catch (error) {
      this.logger.error(`Failed to acknowledge message ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Pull messages from the pull subscription (backup method)
   */
  async pullMessages(maxMessages: number = 10): Promise<Message[]> {
    try {
      const subscription = this.pubSubClient.subscription(this.pullSubscriptionName);
      
      // Set up a promise to collect messages
      const messages: Message[] = [];
      let messageCount = 0;
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          subscription.removeAllListeners();
          resolve(messages);
        }, 5000); // 5 second timeout
        
        subscription.on('message', (message: Message) => {
          messages.push(message);
          messageCount++;
          
          if (messageCount >= maxMessages) {
            clearTimeout(timeout);
            subscription.removeAllListeners();
            resolve(messages);
          }
        });
        
        subscription.on('error', (error) => {
          clearTimeout(timeout);
          subscription.removeAllListeners();
          reject(error);
        });
        
        // Start receiving messages
        subscription.open();
      });
    } catch (error) {
      this.logger.error('Failed to pull messages from subscription:', error);
      throw error;
    }
  }

  /**
   * Process pulled messages and return Gmail notifications
   */
  async processPulledMessages(): Promise<GmailNotification[]> {
    try {
      const messages = await this.pullMessages();
      const notifications: GmailNotification[] = [];

      for (const message of messages) {
        try {
          const pubsubMessage: PubSubMessage = {
            data: message.data.toString('base64'),
            messageId: message.id,
            publishTime: message.publishTime.toISOString(),
            attributes: message.attributes,
          };

          const notification = this.decodePubSubMessage(pubsubMessage);
          if (notification) {
            notifications.push(notification);
          }

          // Acknowledge the message
          message.ack();
        } catch (error) {
          this.logger.error(`Failed to process message ${message.id}:`, error);
          // Don't acknowledge failed messages - they'll be retried
          message.nack();
        }
      }

      this.logger.log(`Processed ${notifications.length} Gmail notifications from pulled messages`);
      return notifications;
    } catch (error) {
      this.logger.error('Failed to process pulled messages:', error);
      throw error;
    }
  }

  /**
   * Get subscription health status
   */
  async getSubscriptionHealth(): Promise<{
    pushSubscription: {
      exists: boolean;
      messageCount?: number;
      oldestMessage?: Date;
    };
    pullSubscription: {
      exists: boolean;
      messageCount?: number;
      oldestMessage?: Date;
    };
  }> {
    try {
      const pushSubscription = this.pubSubClient.subscription(this.pushSubscriptionName);
      const pullSubscription = this.pubSubClient.subscription(this.pullSubscriptionName);

      // Check if subscriptions exist and get metadata
      const [pushExists] = await pushSubscription.exists();
      const [pullExists] = await pullSubscription.exists();

      const result = {
        pushSubscription: { exists: pushExists },
        pullSubscription: { exists: pullExists },
      };

      // Get additional metadata if subscriptions exist
      if (pushExists) {
        try {
          const [pushMetadata] = await pushSubscription.getMetadata();
          if (pushMetadata && typeof pushMetadata === 'object' && 'numUndeliveredMessages' in pushMetadata) {
            (result.pushSubscription as any).messageCount = pushMetadata.numUndeliveredMessages;
          }
        } catch (error) {
          this.logger.warn('Failed to get push subscription metadata:', error);
        }
      } else {
        this.logger.error('Push subscription does not exist');
      }

      if (pullExists) {
        try {
          const [pullMetadata] = await pullSubscription.getMetadata();
          if (pullMetadata && typeof pullMetadata === 'object' && 'numUndeliveredMessages' in pullMetadata) {
            (result.pullSubscription as any).messageCount = pullMetadata.numUndeliveredMessages;
          }
        } catch (error) {
          this.logger.warn('Failed to get pull subscription metadata:', error);
        }
      } else {
        this.logger.error('Pull subscription does not exist');
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get subscription health:', error);
      throw error;
    }
  }

  /**
   * Test the Pub/Sub connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const topic = this.pubSubClient.topic(this.topicName);
      const [exists] = await topic.exists();
      
      if (!exists) {
        this.logger.error(`Topic ${this.topicName} does not exist`);
        return false;
      }

      this.logger.log('Pub/Sub connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Pub/Sub connection test failed:', error);
      return false;
    }
  }

  /**
   * Lightweight connection check - just validates client without network calls
   */
  isConfiguredProperly(): boolean {
    try {
      return !!(this.pubSubClient && this.projectId && this.topicName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Test connection with user context for debugging
   */
  async testConnectionWithContext(userId?: string): Promise<boolean> {
    const logContext = userId ? ` for user: ${userId}` : '';
    try {
      const topic = this.pubSubClient.topic(this.topicName);
      const [exists] = await topic.exists();
      
      if (!exists) {
        this.logger.error(`Topic ${this.topicName} does not exist${logContext}`);
        return false;
      }

      this.logger.log(`Pub/Sub connection test successful${logContext}`);
      return true;
    } catch (error) {
      this.logger.error(`Pub/Sub connection test failed${logContext}:`, error);
      return false;
    }
  }

  /**
   * Publish a test message (for testing purposes)
   */
  async publishTestMessage(testData: any = { test: true }): Promise<string> {
    try {
      const topic = this.pubSubClient.topic(this.topicName);
      const dataBuffer = Buffer.from(JSON.stringify(testData));
      
      const messageId = await topic.publishMessage({
        data: dataBuffer,
        attributes: {
          source: 'test',
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log(`Test message published with ID: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error('Failed to publish test message:', error);
      throw error;
    }
  }

  /**
   * Private: Validate required configuration
   */
  private validateConfiguration(): void {
    const requiredConfig = [
      'GOOGLE_CLOUD_PROJECT_ID',
      'GMAIL_PUBSUB_TOPIC',
      'GMAIL_PUSH_SUBSCRIPTION',
      'GMAIL_PULL_SUBSCRIPTION',
      'GOOGLE_APPLICATION_CREDENTIALS',
    ];

    for (const config of requiredConfig) {
      if (!this.configService.get<string>(config)) {
        throw new Error(`Missing required configuration: ${config}`);
      }
    }

    this.logger.log('Pub/Sub service configuration validated');
  }
} 