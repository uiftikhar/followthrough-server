import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GmailWatch, GmailWatchDocument } from '../schemas/gmail-watch.schema';

export interface CreateGmailWatchParams {
  userId: Types.ObjectId;
  watchId: string;
  historyId: string;
  topicName: string;
  labelIds?: string[];
  labelFilterBehavior?: 'INCLUDE' | 'EXCLUDE';
  expiresAt: Date;
  googleEmail: string;
}

export interface UpdateGmailWatchParams {
  watchId?: string;
  historyId?: string;
  expiresAt?: Date;
  lastRenewalAt?: Date;
  isActive?: boolean;
  errorCount?: number;
  lastError?: string;
  lastHistoryProcessed?: string;
  notificationsReceived?: number;
  emailsProcessed?: number;
}

@Injectable()
export class GmailWatchRepository {
  private readonly logger = new Logger(GmailWatchRepository.name);

  constructor(
    @InjectModel(GmailWatch.name)
    private readonly gmailWatchModel: Model<GmailWatchDocument>,
  ) {}

  /**
   * Create a new Gmail watch record
   */
  async create(params: CreateGmailWatchParams): Promise<GmailWatchDocument> {
    try {
      const watch = new this.gmailWatchModel({
        ...params,
        lastRenewalAt: new Date(),
      });

      const savedWatch = await watch.save();
      this.logger.log(`Created Gmail watch: ${savedWatch.watchId} for user: ${savedWatch.userId}`);
      
      return savedWatch;
    } catch (error) {
      this.logger.error('Failed to create Gmail watch:', error);
      throw error;
    }
  }

  /**
   * Find Gmail watch by watch ID
   */
  async findByWatchId(watchId: string): Promise<GmailWatchDocument | null> {
    try {
      return await this.gmailWatchModel.findOne({ watchId }).exec();
    } catch (error) {
      this.logger.error(`Failed to find Gmail watch by watchId ${watchId}:`, error);
      throw error;
    }
  }

  /**
   * Find Gmail watch by user ID
   */
  async findByUserId(userId: Types.ObjectId): Promise<GmailWatchDocument | null> {
    try {
      return await this.gmailWatchModel
        .findOne({ userId, isActive: true })
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error(`Failed to find Gmail watch by userId ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Find Gmail watch by Google email
   */
  async findByGoogleEmail(googleEmail: string): Promise<GmailWatchDocument | null> {
    try {
      return await this.gmailWatchModel
        .findOne({ googleEmail, isActive: true })
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error(`Failed to find Gmail watch by email ${googleEmail}:`, error);
      throw error;
    }
  }

  /**
   * Update Gmail watch by watch ID
   */
  async updateByWatchId(
    watchId: string,
    updates: UpdateGmailWatchParams,
  ): Promise<GmailWatchDocument | null> {
    try {
      const updatedWatch = await this.gmailWatchModel
        .findOneAndUpdate(
          { watchId },
          { ...updates, updatedAt: new Date() },
          { new: true },
        )
        .exec();

      if (updatedWatch) {
        this.logger.log(`Updated Gmail watch: ${watchId}`);
      }

      return updatedWatch;
    } catch (error) {
      this.logger.error(`Failed to update Gmail watch ${watchId}:`, error);
      throw error;
    }
  }

  /**
   * Update Gmail watch by user ID
   */
  async updateByUserId(
    userId: Types.ObjectId,
    updates: UpdateGmailWatchParams,
  ): Promise<GmailWatchDocument | null> {
    try {
      const updatedWatch = await this.gmailWatchModel
        .findOneAndUpdate(
          { userId, isActive: true },
          { ...updates, updatedAt: new Date() },
          { new: true, sort: { createdAt: -1 } },
        )
        .exec();

      if (updatedWatch) {
        this.logger.log(`Updated Gmail watch for user: ${userId}`);
      }

      return updatedWatch;
    } catch (error) {
      this.logger.error(`Failed to update Gmail watch for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Delete Gmail watch by watch ID
   */
  async deleteByWatchId(watchId: string): Promise<boolean> {
    try {
      const result = await this.gmailWatchModel.deleteOne({ watchId }).exec();
      
      if (result.deletedCount > 0) {
        this.logger.log(`Deleted Gmail watch: ${watchId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to delete Gmail watch ${watchId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate Gmail watch by user ID
   */
  async deactivateByUserId(userId: Types.ObjectId): Promise<boolean> {
    try {
      const result = await this.gmailWatchModel
        .updateMany(
          { userId },
          { isActive: false, updatedAt: new Date() },
        )
        .exec();

      this.logger.log(`Deactivated ${result.modifiedCount} Gmail watches for user: ${userId}`);
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to deactivate Gmail watches for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Find watches that are expiring soon (for renewal)
   */
  async findExpiringSoon(hoursFromNow: number = 24): Promise<GmailWatchDocument[]> {
    try {
      const expiryThreshold = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
      
      return await this.gmailWatchModel
        .find({
          isActive: true,
          expiresAt: { $lte: expiryThreshold },
        })
        .exec();
    } catch (error) {
      this.logger.error('Failed to find expiring Gmail watches:', error);
      throw error;
    }
  }

  /**
   * Find watches with errors (for cleanup/retry)
   */
  async findWithErrors(maxErrorCount: number = 5): Promise<GmailWatchDocument[]> {
    try {
      return await this.gmailWatchModel
        .find({
          isActive: true,
          errorCount: { $gte: maxErrorCount },
        })
        .exec();
    } catch (error) {
      this.logger.error('Failed to find Gmail watches with errors:', error);
      throw error;
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
      const [
        totalActive,
        expiringSoon,
        withErrors,
        aggregateStats,
      ] = await Promise.all([
        this.gmailWatchModel.countDocuments({ isActive: true }),
        this.gmailWatchModel.countDocuments({
          isActive: true,
          expiresAt: { $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        }),
        this.gmailWatchModel.countDocuments({
          isActive: true,
          errorCount: { $gte: 3 },
        }),
        this.gmailWatchModel.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: null,
              totalNotifications: { $sum: '$notificationsReceived' },
              totalEmailsProcessed: { $sum: '$emailsProcessed' },
            },
          },
        ]),
      ]);

      const stats = aggregateStats[0] || { totalNotifications: 0, totalEmailsProcessed: 0 };

      return {
        totalActive,
        expiringSoon,
        withErrors,
        totalNotifications: stats.totalNotifications,
        totalEmailsProcessed: stats.totalEmailsProcessed,
      };
    } catch (error) {
      this.logger.error('Failed to get Gmail watch statistics:', error);
      throw error;
    }
  }

  /**
   * Increment notification count for a watch
   */
  async incrementNotificationCount(watchId: string): Promise<void> {
    try {
      await this.gmailWatchModel
        .updateOne(
          { watchId },
          { 
            $inc: { notificationsReceived: 1 },
            $set: { updatedAt: new Date() }
          },
        )
        .exec();
    } catch (error) {
      this.logger.error(`Failed to increment notification count for watch ${watchId}:`, error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Increment email processed count for a watch
   */
  async incrementEmailProcessedCount(watchId: string, count: number = 1): Promise<void> {
    try {
      await this.gmailWatchModel
        .updateOne(
          { watchId },
          { 
            $inc: { emailsProcessed: count },
            $set: { updatedAt: new Date() }
          },
        )
        .exec();
    } catch (error) {
      this.logger.error(`Failed to increment email processed count for watch ${watchId}:`, error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Find all active Gmail watches
   */
  async findAllActive(): Promise<GmailWatchDocument[]> {
    try {
      return await this.gmailWatchModel
        .find({ isActive: true })
        .exec();
    } catch (error) {
      this.logger.error('Failed to find all active Gmail watches:', error);
      throw error;
    }
  }
} 