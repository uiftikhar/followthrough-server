import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  EmailTriageSession,
  EmailTriageSessionDocument,
} from "../schemas/email-triage-session.schema";

@Injectable()
export class EmailTriageSessionRepository {
  private readonly logger = new Logger(EmailTriageSessionRepository.name);

  constructor(
    @InjectModel(EmailTriageSession.name)
    private emailTriageSessionModel: Model<EmailTriageSessionDocument>,
  ) {}

  /**
   * Create a new email triage session
   */
  async create(sessionData: Partial<EmailTriageSession>): Promise<EmailTriageSession> {
    try {
      this.logger.log(`Creating email triage session: ${sessionData.sessionId}`);
      
      const session = new this.emailTriageSessionModel({
        ...sessionData,
        startTime: sessionData.startTime || new Date(),
        status: sessionData.status || "processing",
        progress: sessionData.progress || 0,
      });

      const savedSession = await session.save();
      
      this.logger.log(`Email triage session created: ${savedSession.sessionId}`);
      return savedSession.toObject();
    } catch (error) {
      this.logger.error(
        `Failed to create email triage session ${sessionData.sessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update an existing email triage session
   */
  async update(
    sessionId: string,
    updateData: Partial<EmailTriageSession>,
  ): Promise<EmailTriageSession | null> {
    try {
      this.logger.log(`Updating email triage session: ${sessionId}`);

      const updatedSession = await this.emailTriageSessionModel
        .findOneAndUpdate(
          { sessionId },
          {
            ...updateData,
            updatedAt: new Date(),
          },
          { new: true, runValidators: true },
        )
        .exec();

      if (!updatedSession) {
        this.logger.warn(`Email triage session not found: ${sessionId}`);
        return null;
      }

      this.logger.log(`Email triage session updated: ${sessionId}`);
      return updatedSession.toObject();
    } catch (error) {
      this.logger.error(
        `Failed to update email triage session ${sessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Complete an email triage session with final results
   */
  async complete(
    sessionId: string,
    results: {
      classification?: any;
      summary?: any;
      replyDraft?: any;
      retrievedContext?: any[];
      processingMetadata?: any;
      contextRetrievalResults?: any;
      userToneProfile?: any;
    },
  ): Promise<EmailTriageSession | null> {
    try {
      this.logger.log(`Completing email triage session: ${sessionId}`);

      const completedSession = await this.emailTriageSessionModel
        .findOneAndUpdate(
          { sessionId },
          {
            ...results,
            status: "completed",
            progress: 100,
            endTime: new Date(),
            updatedAt: new Date(),
          },
          { new: true, runValidators: true },
        )
        .exec();

      if (!completedSession) {
        this.logger.warn(`Email triage session not found for completion: ${sessionId}`);
        return null;
      }

      this.logger.log(`Email triage session completed: ${sessionId}`);
      return completedSession.toObject();
    } catch (error) {
      this.logger.error(
        `Failed to complete email triage session ${sessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark an email triage session as failed
   */
  async markFailed(
    sessionId: string,
    error: { step: string; error: string; timestamp: string },
  ): Promise<EmailTriageSession | null> {
    try {
      this.logger.log(`Marking email triage session as failed: ${sessionId}`);

      const failedSession = await this.emailTriageSessionModel
        .findOneAndUpdate(
          { sessionId },
          {
            status: "failed",
            endTime: new Date(),
            $push: { triageErrors: error },
            updatedAt: new Date(),
          },
          { new: true, runValidators: true },
        )
        .exec();

      if (!failedSession) {
        this.logger.warn(`Email triage session not found for failure: ${sessionId}`);
        return null;
      }

      this.logger.log(`Email triage session marked as failed: ${sessionId}`);
      return failedSession.toObject();
    } catch (error) {
      this.logger.error(
        `Failed to mark email triage session as failed ${sessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find email triage session by session ID
   */
  async findBySessionId(sessionId: string): Promise<EmailTriageSession | null> {
    try {
      const session = await this.emailTriageSessionModel
        .findOne({ sessionId })
        .exec();

      return session ? session.toObject() : null;
    } catch (error) {
      this.logger.error(
        `Failed to find email triage session ${sessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find email triage session by email ID
   */
  async findByEmailId(emailId: string): Promise<EmailTriageSession | null> {
    try {
      const session = await this.emailTriageSessionModel
        .findOne({ emailId })
        .sort({ createdAt: -1 }) // Get the most recent session for this email
        .exec();

      return session ? session.toObject() : null;
    } catch (error) {
      this.logger.error(
        `Failed to find email triage session for email ${emailId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find all email triage sessions for a user
   */
  async findByUserId(
    userId: string,
    options: {
      status?: string;
      limit?: number;
      skip?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<EmailTriageSession[]> {
    try {
      const {
        status,
        limit = 50,
        skip = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const query = this.emailTriageSessionModel.find({ userId });

      if (status) {
        query.where({ status });
      }

      const sessions = await query
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .limit(limit)
        .skip(skip)
        .exec();

      return sessions.map(session => session.toObject());
    } catch (error) {
      this.logger.error(
        `Failed to find email triage sessions for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get email triage session statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    processing: number;
    avgProcessingTime?: number;
  }> {
    try {
      const stats = await this.emailTriageSessionModel
        .aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              avgProcessingTime: {
                $avg: {
                  $cond: [
                    { $eq: ["$status", "completed"] },
                    { $subtract: ["$endTime", "$startTime"] },
                    null,
                  ],
                },
              },
            },
          },
        ])
        .exec();

      const result = {
        total: 0,
        completed: 0,
        failed: 0,
        processing: 0,
        avgProcessingTime: undefined as number | undefined,
      };

      stats.forEach((stat) => {
        result.total += stat.count;
        if (stat._id === "completed") {
          result.completed = stat.count;
          result.avgProcessingTime = stat.avgProcessingTime;
        } else if (stat._id === "failed") {
          result.failed = stat.count;
        } else if (stat._id === "processing") {
          result.processing = stat.count;
        }
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get user stats for ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete old email triage sessions (cleanup)
   */
  async deleteOldSessions(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.emailTriageSessionModel
        .deleteMany({
          createdAt: { $lt: cutoffDate },
          status: { $in: ["completed", "failed"] },
        })
        .exec();

      this.logger.log(
        `Deleted ${result.deletedCount} old email triage sessions older than ${olderThanDays} days`,
      );

      return result.deletedCount;
    } catch (error) {
      this.logger.error(
        `Failed to delete old email triage sessions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update session progress
   */
  async updateProgress(
    sessionId: string,
    progress: number,
    currentStep?: string,
  ): Promise<EmailTriageSession | null> {
    try {
      const updateData: any = {
        progress,
        updatedAt: new Date(),
      };

      if (currentStep) {
        updateData.metadata = { currentStep };
      }

      const updatedSession = await this.emailTriageSessionModel
        .findOneAndUpdate(
          { sessionId },
          updateData,
          { new: true, runValidators: true },
        )
        .exec();

      return updatedSession ? updatedSession.toObject() : null;
    } catch (error) {
      this.logger.error(
        `Failed to update progress for session ${sessionId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
} 