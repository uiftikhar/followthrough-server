import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { Types } from 'mongoose';
import { GoogleOAuthService } from './google-oauth.service';
import { GmailWatchRepository, CreateGmailWatchParams } from '../../../database/repositories/gmail-watch.repository';
import { GmailWatchDocument } from '../../../database/schemas/gmail-watch.schema';

export interface CreateWatchParams {
  userId: Types.ObjectId;
  labelIds?: string[];
  labelFilterBehavior?: 'INCLUDE' | 'EXCLUDE';
}

export interface WatchInfo {
  watchId: string;
  historyId: string;
  expiresAt: Date;
  isActive: boolean;
  googleEmail: string;
  notificationsReceived: number;
  emailsProcessed: number;
  errorCount: number;
  lastError?: string;
}

@Injectable()
export class GmailWatchService {
  private readonly logger = new Logger(GmailWatchService.name);
  private readonly topicName: string;

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly gmailWatchRepository: GmailWatchRepository,
    private readonly configService: ConfigService,
  ) {
    this.topicName = this.configService.get<string>('GMAIL_PUBSUB_TOPIC') || 'gmail-notifications';
  }

  /**
   * Create a new Gmail watch for a user
   */
  async createWatch(params: CreateWatchParams): Promise<WatchInfo> {
    try {
      this.logger.log(`Creating Gmail watch for user: ${params.userId}`);

      // Get authenticated Gmail client
      const client = await this.googleOAuthService.getAuthenticatedClient(params.userId.toString());
      const gmail = google.gmail({ version: 'v1', auth: client });

      // Get user's Gmail profile to get email and current history ID
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const googleEmail = profile.data.emailAddress!;
      const currentHistoryId = profile.data.historyId!;

      // Create Gmail watch request
      const watchRequest = {
        userId: 'me',
        requestBody: {
          topicName: `projects/${this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID')}/topics/${this.topicName}`,
          labelIds: params.labelIds || ['INBOX'],
          labelFilterBehavior: params.labelFilterBehavior || 'INCLUDE',
        },
      };

      // Create the watch via Gmail API
      const watchResponse = await gmail.users.watch(watchRequest);
      const watchId = watchResponse.data.historyId!; // Gmail returns historyId as watchId
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      // Store watch in database
      const watchData: CreateGmailWatchParams = {
        userId: params.userId,
        watchId,
        historyId: currentHistoryId,
        topicName: this.topicName,
        labelIds: params.labelIds || ['INBOX'],
        labelFilterBehavior: params.labelFilterBehavior || 'INCLUDE',
        expiresAt,
        googleEmail,
      };

      const savedWatch = await this.gmailWatchRepository.create(watchData);

      this.logger.log(`Gmail watch created successfully: ${watchId} for ${googleEmail}`);

      return this.mapToWatchInfo(savedWatch);
    } catch (error) {
      this.logger.error(`Failed to create Gmail watch for user ${params.userId}:`, error);
      throw error;
    }
  }

  /**
   * Renew an existing Gmail watch
   */
  async renewWatch(watchId: string): Promise<WatchInfo> {
    try {
      this.logger.log(`Renewing Gmail watch: ${watchId}`);

      // Get existing watch from database
      const existingWatch = await this.gmailWatchRepository.findByWatchId(watchId);
      if (!existingWatch) {
        throw new Error(`Gmail watch not found: ${watchId}`);
      }

      // Get authenticated Gmail client
      const client = await this.googleOAuthService.getAuthenticatedClient(existingWatch.userId.toString());
      const gmail = google.gmail({ version: 'v1', auth: client });

      // Stop the existing watch first
      try {
        await gmail.users.stop({ userId: 'me' });
      } catch (error) {
        this.logger.warn(`Failed to stop existing watch ${watchId}:`, error);
        // Continue with renewal even if stop fails
      }

      // Create new watch with same parameters
      const watchRequest = {
        userId: 'me',
        requestBody: {
          topicName: `projects/${this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID')}/topics/${this.topicName}`,
          labelIds: existingWatch.labelIds,
          labelFilterBehavior: existingWatch.labelFilterBehavior,
        },
      };

      const watchResponse = await gmail.users.watch(watchRequest);
      const newWatchId = watchResponse.data.historyId!;
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Update watch in database
      const updatedWatch = await this.gmailWatchRepository.updateByWatchId(watchId, {
        watchId: newWatchId,
        historyId: watchResponse.data.historyId!,
        expiresAt: newExpiresAt,
        lastRenewalAt: new Date(),
        errorCount: 0, // Reset error count on successful renewal
        lastError: undefined,
      });

      if (!updatedWatch) {
        throw new Error(`Failed to update Gmail watch in database: ${watchId}`);
      }

      this.logger.log(`Gmail watch renewed successfully: ${watchId} -> ${newWatchId}`);

      return this.mapToWatchInfo(updatedWatch);
    } catch (error) {
      this.logger.error(`Failed to renew Gmail watch ${watchId}:`, error);
      
      // Update error count in database
      await this.recordWatchError(watchId, error.message);
      
      throw error;
    }
  }

  /**
   * Stop and delete a Gmail watch
   */
  async stopWatch(userId: Types.ObjectId): Promise<boolean> {
    try {
      this.logger.log(`Stopping Gmail watch for user: ${userId}`);

      // Get existing watch from database
      const existingWatch = await this.gmailWatchRepository.findByUserId(userId);
      if (!existingWatch) {
        this.logger.log(`No active Gmail watch found for user: ${userId}`);
        return false;
      }

      // Get authenticated Gmail client
      const client = await this.googleOAuthService.getAuthenticatedClient(userId.toString());
      const gmail = google.gmail({ version: 'v1', auth: client });

      // Stop the watch via Gmail API
      try {
        await gmail.users.stop({ userId: 'me' });
        this.logger.log(`Gmail watch stopped via API for user: ${userId}`);
      } catch (error) {
        this.logger.warn(`Failed to stop Gmail watch via API for user ${userId}:`, error);
        // Continue with database cleanup even if API call fails
      }

      // Deactivate watch in database
      const deactivated = await this.gmailWatchRepository.deactivateByUserId(userId);

      this.logger.log(`Gmail watch stopped and deactivated for user: ${userId}`);
      return deactivated;
    } catch (error) {
      this.logger.error(`Failed to stop Gmail watch for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get watch information for a user
   */
  async getWatchInfo(userId: Types.ObjectId): Promise<WatchInfo | null> {
    try {
      const watch = await this.gmailWatchRepository.findByUserId(userId);
      return watch ? this.mapToWatchInfo(watch) : null;
    } catch (error) {
      this.logger.error(`Failed to get watch info for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get watch information by Google email
   */
  async getWatchInfoByEmail(googleEmail: string): Promise<WatchInfo | null> {
    try {
      const watch = await this.gmailWatchRepository.findByGoogleEmail(googleEmail);
      return watch ? this.mapToWatchInfo(watch) : null;
    } catch (error) {
      this.logger.error(`Failed to get watch info for email ${googleEmail}:`, error);
      throw error;
    }
  }

  /**
   * Find watches that need renewal
   */
  async findWatchesNeedingRenewal(): Promise<WatchInfo[]> {
    try {
      const expiring = await this.gmailWatchRepository.findExpiringSoon(24); // 24 hours
      return expiring.map(watch => this.mapToWatchInfo(watch));
    } catch (error) {
      this.logger.error('Failed to find watches needing renewal:', error);
      throw error;
    }
  }

  /**
   * Renew all expiring watches
   */
  async renewExpiringWatches(): Promise<{ renewed: number; failed: number }> {
    let renewed = 0;
    let failed = 0;

    try {
      const expiringWatches = await this.findWatchesNeedingRenewal();
      
      this.logger.log(`Found ${expiringWatches.length} watches that need renewal`);

      for (const watchInfo of expiringWatches) {
        try {
          await this.renewWatch(watchInfo.watchId);
          renewed++;
        } catch (error) {
          this.logger.error(`Failed to renew watch ${watchInfo.watchId}:`, error);
          failed++;
        }
      }

      this.logger.log(`Watch renewal completed: ${renewed} renewed, ${failed} failed`);
    } catch (error) {
      this.logger.error('Failed to renew expiring watches:', error);
    }

    return { renewed, failed };
  }

  /**
   * Record error for a watch
   */
  async recordWatchError(watchId: string, errorMessage: string): Promise<void> {
    try {
      const watch = await this.gmailWatchRepository.findByWatchId(watchId);
      if (watch) {
        await this.gmailWatchRepository.updateByWatchId(watchId, {
          errorCount: (watch.errorCount || 0) + 1,
          lastError: errorMessage,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to record error for watch ${watchId}:`, error);
    }
  }

  /**
   * Update watch notification count
   */
  async recordNotification(watchId: string): Promise<void> {
    try {
      await this.gmailWatchRepository.incrementNotificationCount(watchId);
    } catch (error) {
      this.logger.error(`Failed to record notification for watch ${watchId}:`, error);
    }
  }

  /**
   * Update watch email processed count
   */
  async recordEmailsProcessed(watchId: string, count: number): Promise<void> {
    try {
      await this.gmailWatchRepository.incrementEmailProcessedCount(watchId, count);
    } catch (error) {
      this.logger.error(`Failed to record emails processed for watch ${watchId}:`, error);
    }
  }

  /**
   * Get watch statistics
   */
  async getStatistics(): Promise<{
    totalActive: number;
    expiringSoon: number;
    withErrors: number;
    totalNotifications: number;
    totalEmailsProcessed: number;
  }> {
    try {
      return await this.gmailWatchRepository.getStatistics();
    } catch (error) {
      this.logger.error('Failed to get watch statistics:', error);
      throw error;
    }
  }

  /**
   * Map database document to WatchInfo interface
   */
  private mapToWatchInfo(watch: GmailWatchDocument): WatchInfo {
    return {
      watchId: watch.watchId,
      historyId: watch.historyId,
      expiresAt: watch.expiresAt,
      isActive: watch.isActive,
      googleEmail: watch.googleEmail,
      notificationsReceived: watch.notificationsReceived || 0,
      emailsProcessed: watch.emailsProcessed || 0,
      errorCount: watch.errorCount || 0,
      lastError: watch.lastError,
    };
  }
} 