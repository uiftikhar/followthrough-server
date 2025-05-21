import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ZapierService {
  private readonly logger = new Logger(ZapierService.name);
  private apiKeys: Map<string, { userId: string; createdAt: Date }> = new Map();

  constructor(private configService: ConfigService) {}

  /**
   * Validates an API key
   */
  validateApiKey(apiKey: string): boolean {
    return this.apiKeys.has(apiKey);
  }

  /**
   * Gets user ID associated with an API key
   */
  getUserIdFromApiKey(apiKey: string): string {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      throw new UnauthorizedException('Invalid API key');
    }
    return keyData.userId;
  }

  /**
   * Generates a new API key for a user
   */
  generateApiKey(userId: string): string {
    const apiKey = crypto.randomBytes(32).toString('hex');
    this.apiKeys.set(apiKey, {
      userId,
      createdAt: new Date(),
    });
    this.logger.log(`Generated new API key for user ${userId}`);
    return apiKey;
  }

  /**
   * Revokes an API key
   */
  revokeApiKey(apiKey: string): boolean {
    const result = this.apiKeys.delete(apiKey);
    return result;
  }

  /**
   * Lists all API keys for a user
   */
  listApiKeysForUser(userId: string): { apiKey: string; createdAt: Date }[] {
    const userKeys: { apiKey: string; createdAt: Date }[] = [];
    this.apiKeys.forEach((data, key) => {
      if (data.userId === userId) {
        userKeys.push({ apiKey: key, createdAt: data.createdAt });
      }
    });
    return userKeys;
  }

  /**
   * Handles incoming webhook from Zapier
   */
  async handleWebhook(payload: any, event: string): Promise<any> {
    this.logger.log(`Received webhook for event: ${event}`);
    this.logger.debug('Webhook payload:', payload);
    
    // Process webhook based on event type
    switch (event) {
      case 'task.created':
        return this.handleTaskCreated(payload);
      case 'meeting.scheduled':
        return this.handleMeetingScheduled(payload);
      default:
        this.logger.warn(`Unknown webhook event: ${event}`);
        return { status: 'error', message: `Unknown event type: ${event}` };
    }
  }

  private async handleTaskCreated(payload: any): Promise<any> {
    // Implement task creation logic
    this.logger.log('Processing task creation', payload);
    return { status: 'success', message: 'Task received' };
  }

  private async handleMeetingScheduled(payload: any): Promise<any> {
    // Implement meeting scheduling logic
    this.logger.log('Processing meeting scheduling', payload);
    return { status: 'success', message: 'Meeting received' };
  }
} 