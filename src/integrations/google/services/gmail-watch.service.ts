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
  userId: Types.ObjectId;
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
      this.logger.log(`Creating Gmail watch for user: ${params.userId}, ${this.topicName}`);

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
      this.logger.log(`Stopping Gmail watch for user: ${userId}, ${this.topicName}`);

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
   * Update history ID for a watch
   */
  async updateHistoryId(watchId: string, historyId: string): Promise<void> {
    try {
      await this.gmailWatchRepository.updateByWatchId(watchId, {
        historyId,
        lastHistoryProcessed: historyId,
      });
      this.logger.log(`Updated history ID for watch ${watchId}: ${historyId}`);
    } catch (error) {
      this.logger.error(`Failed to update history ID for watch ${watchId}:`, error);
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
      userId: watch.userId,
    };
  }

  /**
   * Stop and delete a Gmail watch by email address
   * Used for cross-contamination cleanup when we only have the email
   */
  async stopWatchByEmail(googleEmail: string): Promise<boolean> {
    try {
      this.logger.log(`Stopping Gmail watch for email: ${googleEmail}`);

      // Get existing watch from database
      const existingWatch = await this.gmailWatchRepository.findByGoogleEmail(googleEmail);
      if (!existingWatch) {
        this.logger.log(`No active Gmail watch found for email: ${googleEmail}`);
        return false;
      }

      return await this.stopWatch(existingWatch.userId);
    } catch (error) {
      this.logger.error(`Failed to stop Gmail watch for email ${googleEmail}:`, error);
      throw error;
    }
  }

  /**
   * Clean up inactive watches for users without active sessions
   * Used to prevent cross-contamination
   */
  async cleanupInactiveWatches(activeUserEmails: Set<string>): Promise<{
    cleaned: number;
    failed: number;
  }> {
    try {
      this.logger.log('🧹 Starting cleanup of inactive Gmail watches');

      // Get all active watches
      const activeWatches = await this.gmailWatchRepository.findAllActive();
      
      let cleaned = 0;
      let failed = 0;

      for (const watch of activeWatches) {
        try {
          // If user email is not in active sessions, clean it up
          if (!activeUserEmails.has(watch.googleEmail)) {
            this.logger.log(`🗑️ Cleaning up inactive watch for: ${watch.googleEmail}`);
            
            const stopped = await this.stopWatch(watch.userId);
            if (stopped) {
              cleaned++;
              this.logger.log(`✅ Cleaned up watch for: ${watch.googleEmail}`);
            }
          }
        } catch (error) {
          failed++;
          this.logger.error(`❌ Failed to cleanup watch for ${watch.googleEmail}: ${error.message}`);
        }
      }

      this.logger.log(`🧹 Cleanup completed: ${cleaned} cleaned, ${failed} failed`);
      
      return { cleaned, failed };
    } catch (error) {
      this.logger.error('Failed to cleanup inactive watches:', error);
      throw error;
    }
  }

  /**
   * Stop all active Gmail watches (for graceful server shutdown)
   * This prevents orphaned watches from continuing to send notifications
   */
  async stopAllActiveWatches(): Promise<{
    totalWatches: number;
    successfullyStopped: number;
    failed: number;
    errors: string[];
  }> {
    try {
      this.logger.log('🛑 Starting graceful shutdown - stopping all active Gmail watches');

      // Get all active watches
      const activeWatches = await this.gmailWatchRepository.findAllActive();
      const totalWatches = activeWatches.length;
      
      if (totalWatches === 0) {
        this.logger.log('ℹ️ No active Gmail watches found to stop');
        return {
          totalWatches: 0,
          successfullyStopped: 0,
          failed: 0,
          errors: [],
        };
      }

      this.logger.log(`📊 Found ${totalWatches} active watches to stop during shutdown`);

      let successfullyStopped = 0;
      let failed = 0;
      const errors: string[] = [];

      // Stop all watches in parallel for faster shutdown
      const stopPromises = activeWatches.map(async (watch) => {
        try {
          this.logger.log(`🛑 Stopping watch for: ${watch.googleEmail} (${watch.watchId})`);
          
          // Get authenticated Gmail client
          const client = await this.googleOAuthService.getAuthenticatedClient(watch.userId.toString());
          const gmail = google.gmail({ version: 'v1', auth: client });

          // Stop the watch via Gmail API
          await gmail.users.stop({ userId: 'me' });
          
          // Deactivate in database
          await this.gmailWatchRepository.deactivateByUserId(watch.userId);
          
          this.logger.log(`✅ Successfully stopped watch for: ${watch.googleEmail}`);
          return { success: true, email: watch.googleEmail };
        } catch (error) {
          const errorMsg = `Failed to stop watch for ${watch.googleEmail}: ${error.message}`;
          this.logger.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          return { success: false, email: watch.googleEmail, error: errorMsg };
        }
      });

      // Wait for all stop operations to complete (with timeout)
      const results = await Promise.allSettled(stopPromises);
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successfullyStopped++;
          } else {
            failed++;
          }
        } else {
          failed++;
          errors.push(`Promise rejected: ${result.reason}`);
        }
      });

      const summary = {
        totalWatches,
        successfullyStopped,
        failed,
        errors,
      };

      this.logger.log(`🎯 Graceful shutdown watch cleanup completed:
        - Total watches: ${totalWatches}
        - Successfully stopped: ${successfullyStopped}
        - Failed: ${failed}
        - Errors: ${errors.length}`);

      if (errors.length > 0) {
        this.logger.warn(`⚠️ Some watches failed to stop:`, errors);
      }

      return summary;
    } catch (error) {
      this.logger.error('❌ Failed to stop all active watches during shutdown:', error);
      throw error;
    }
  }
} 