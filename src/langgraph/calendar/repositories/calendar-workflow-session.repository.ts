import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { 
  CalendarWorkflowSession, 
  CalendarWorkflowSessionDocument 
} from '../schemas/calendar-workflow-session.schema';
import { 
  CalendarWorkflowState, 
  CalendarWorkflowStage, 
  CalendarWorkflowStep 
} from '../interfaces/calendar-workflow-state.interface';

export interface SessionStats {
  totalSessions: number;
  completedSessions: number;
  erroredSessions: number;
  averageProcessingTimeMs: number;
  averageCompletionRate: number;
  sessionsByStage: Record<string, number>;
  sessionsByStatus: Record<string, number>;
  mostActiveParticipants: Array<{ email: string; sessionCount: number }>;
  averageBriefGenerationTime: number;
  averageAnalysisTime: number;
  ragUsageRate: number;
}

export interface SessionQuery {
  userId?: string;
  eventId?: string;
  stage?: CalendarWorkflowStage;
  meetingStatus?: 'scheduled' | 'started' | 'ended';
  dateRange?: {
    start: Date;
    end: Date;
  };
  participantEmail?: string;
  organizer?: string;
  status?: 'active' | 'archived' | 'deleted';
  hasErrors?: boolean;
  isCompleted?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class CalendarWorkflowSessionRepository {
  private readonly logger = new Logger(CalendarWorkflowSessionRepository.name);

  constructor(
    @InjectModel(CalendarWorkflowSession.name)
    private readonly sessionModel: Model<CalendarWorkflowSessionDocument>,
  ) {}

  /**
   * Create a new calendar workflow session
   */
  async createSession(state: CalendarWorkflowState): Promise<CalendarWorkflowSessionDocument> {
    this.logger.log(`Creating new session: ${state.sessionId}`);
    
    try {
      const session = new this.sessionModel({
        ...state,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedSession = await session.save();
      this.logger.log(`Session created successfully: ${savedSession.sessionId}`);
      return savedSession;
    } catch (error) {
      this.logger.error(`Error creating session ${state.sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing session
   */
  async updateSession(
    sessionId: string, 
    updates: Partial<CalendarWorkflowState>
  ): Promise<CalendarWorkflowSessionDocument | null> {
    this.logger.log(`Updating session: ${sessionId}`);
    
    try {
      const updatedSession = await this.sessionModel.findOneAndUpdate(
        { sessionId, status: { $ne: 'deleted' } },
        { 
          ...updates, 
          updatedAt: new Date() 
        },
        { 
          new: true, 
          runValidators: true 
        }
      ).exec();

      if (!updatedSession) {
        this.logger.warn(`Session not found or deleted: ${sessionId}`);
        return null;
      }

      this.logger.log(`Session updated successfully: ${sessionId}`);
      return updatedSession;
    } catch (error) {
      this.logger.error(`Error updating session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<CalendarWorkflowSessionDocument | null> {
    this.logger.log(`Retrieving session: ${sessionId}`);
    
    try {
      const session = await this.sessionModel.findOne({ 
        sessionId, 
        status: { $ne: 'deleted' } 
      }).exec();

      if (!session) {
        this.logger.warn(`Session not found: ${sessionId}`);
        return null;
      }

      return session;
    } catch (error) {
      this.logger.error(`Error retrieving session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sessions by user ID
   */
  async getSessionsByUser(
    userId: string, 
    options: Partial<SessionQuery> = {}
  ): Promise<CalendarWorkflowSessionDocument[]> {
    this.logger.log(`Retrieving sessions for user: ${userId}`);
    
    try {
      const query: FilterQuery<CalendarWorkflowSessionDocument> = {
        userId,
        status: { $ne: 'deleted' }
      };

      // Apply additional filters
      if (options.stage) query.stage = options.stage;
      if (options.meetingStatus) query.meetingStatus = options.meetingStatus;
      if (options.hasErrors !== undefined) query.hadErrors = options.hasErrors;
      if (options.isCompleted !== undefined) {
        query.stage = options.isCompleted ? CalendarWorkflowStage.COMPLETED : { $ne: CalendarWorkflowStage.COMPLETED };
      }
      if (options.dateRange) {
        query.createdAt = {
          $gte: options.dateRange.start,
          $lte: options.dateRange.end
        };
      }

      let mongoQuery = this.sessionModel.find(query);

      // Apply sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      mongoQuery = mongoQuery.sort({ [sortBy]: sortOrder });

      // Apply pagination
      if (options.offset) mongoQuery = mongoQuery.skip(options.offset);
      if (options.limit) mongoQuery = mongoQuery.limit(options.limit);

      const sessions = await mongoQuery.exec();
      this.logger.log(`Found ${sessions.length} sessions for user ${userId}`);
      return sessions;
    } catch (error) {
      this.logger.error(`Error retrieving sessions for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sessions by event ID
   */
  async getSessionsByEvent(eventId: string): Promise<CalendarWorkflowSessionDocument[]> {
    this.logger.log(`Retrieving sessions for event: ${eventId}`);
    
    try {
      const sessions = await this.sessionModel.find({ 
        eventId, 
        status: { $ne: 'deleted' } 
      })
      .sort({ createdAt: -1 })
      .exec();

      this.logger.log(`Found ${sessions.length} sessions for event ${eventId}`);
      return sessions;
    } catch (error) {
      this.logger.error(`Error retrieving sessions for event ${eventId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sessions by participant email
   */
  async getSessionsByParticipant(
    participantEmail: string,
    options: Partial<SessionQuery> = {}
  ): Promise<CalendarWorkflowSessionDocument[]> {
    this.logger.log(`Retrieving sessions for participant: ${participantEmail}`);
    
    try {
      const query: FilterQuery<CalendarWorkflowSessionDocument> = {
        participantEmails: participantEmail,
        status: { $ne: 'deleted' }
      };

      // Apply additional filters
      if (options.userId) query.userId = options.userId;
      if (options.stage) query.stage = options.stage;
      if (options.dateRange) {
        query.createdAt = {
          $gte: options.dateRange.start,
          $lte: options.dateRange.end
        };
      }

      let mongoQuery = this.sessionModel.find(query);

      // Apply sorting and pagination
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      mongoQuery = mongoQuery.sort({ [sortBy]: sortOrder });

      if (options.offset) mongoQuery = mongoQuery.skip(options.offset);
      if (options.limit) mongoQuery = mongoQuery.limit(options.limit);

      const sessions = await mongoQuery.exec();
      this.logger.log(`Found ${sessions.length} sessions for participant ${participantEmail}`);
      return sessions;
    } catch (error) {
      this.logger.error(`Error retrieving sessions for participant ${participantEmail}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a session (soft delete)
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    this.logger.log(`Deleting session: ${sessionId}`);
    
    try {
      const result = await this.sessionModel.updateOne(
        { sessionId },
        { 
          status: 'deleted',
          updatedAt: new Date()
        }
      ).exec();

      const success = result.modifiedCount > 0;
      if (success) {
        this.logger.log(`Session deleted successfully: ${sessionId}`);
      } else {
        this.logger.warn(`Session not found for deletion: ${sessionId}`);
      }
      return success;
    } catch (error) {
      this.logger.error(`Error deleting session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Hard delete a session (permanent removal)
   */
  async hardDeleteSession(sessionId: string): Promise<boolean> {
    this.logger.log(`Hard deleting session: ${sessionId}`);
    
    try {
      const result = await this.sessionModel.deleteOne({ sessionId }).exec();
      const success = result.deletedCount > 0;
      
      if (success) {
        this.logger.log(`Session permanently deleted: ${sessionId}`);
      } else {
        this.logger.warn(`Session not found for hard deletion: ${sessionId}`);
      }
      return success;
    } catch (error) {
      this.logger.error(`Error hard deleting session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Archive completed sessions
   */
  async archiveCompletedSessions(olderThanDays: number = 30): Promise<number> {
    this.logger.log(`Archiving completed sessions older than ${olderThanDays} days`);
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.sessionModel.updateMany(
        {
          stage: CalendarWorkflowStage.COMPLETED,
          completedAt: { $lte: cutoffDate },
          status: 'active'
        },
        {
          status: 'archived',
          updatedAt: new Date()
        }
      ).exec();

      this.logger.log(`Archived ${result.modifiedCount} completed sessions`);
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`Error archiving sessions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get comprehensive session statistics
   */
  async getSessionStats(
    userId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<SessionStats> {
    this.logger.log(`Generating session statistics${userId ? ` for user ${userId}` : ''}`);
    
    try {
      const matchStage: any = { status: { $ne: 'deleted' } };
      if (userId) matchStage.userId = userId;
      if (dateRange) {
        matchStage.createdAt = {
          $gte: dateRange.start,
          $lte: dateRange.end
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            completedSessions: {
              $sum: {
                $cond: [{ $eq: ['$stage', CalendarWorkflowStage.COMPLETED] }, 1, 0]
              }
            },
            erroredSessions: { $sum: { $cond: ['$hadErrors', 1, 0] } },
            totalProcessingTime: {
              $avg: {
                $cond: [
                  { $ne: ['$processingTimeMs', null] },
                  '$processingTimeMs',
                  0
                ]
              }
            },
            totalBriefGenerationTime: {
              $avg: {
                $cond: [
                  { $ne: ['$briefGenerationTimeMs', null] },
                  '$briefGenerationTimeMs',
                  0
                ]
              }
            },
            totalAnalysisTime: {
              $avg: {
                $cond: [
                  { $ne: ['$analysisProcessingTimeMs', null] },
                  '$analysisProcessingTimeMs',
                  0
                ]
              }
            },
            ragUsageCount: {
              $sum: {
                $cond: ['$processingMetadata.ragEnhanced', 1, 0]
              }
            }
          }
        }
      ];

      const [stats] = await this.sessionModel.aggregate(pipeline).exec();

      // Get sessions by stage
      const sessionsByStage = await this.sessionModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$stage', count: { $sum: 1 } } }
      ]).exec();

      // Get sessions by status
      const sessionsByStatus = await this.sessionModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$meetingStatus', count: { $sum: 1 } } }
      ]).exec();

      // Get most active participants
      const mostActiveParticipants = await this.sessionModel.aggregate([
        { $match: matchStage },
        { $unwind: '$participantEmails' },
        { $group: { _id: '$participantEmails', sessionCount: { $sum: 1 } } },
        { $sort: { sessionCount: -1 } },
        { $limit: 10 },
        { $project: { email: '$_id', sessionCount: 1, _id: 0 } }
      ]).exec();

      const result: SessionStats = {
        totalSessions: stats?.totalSessions || 0,
        completedSessions: stats?.completedSessions || 0,
        erroredSessions: stats?.erroredSessions || 0,
        averageProcessingTimeMs: stats?.totalProcessingTime || 0,
        averageCompletionRate: stats?.totalSessions > 0 
          ? (stats.completedSessions / stats.totalSessions) * 100 
          : 0,
        sessionsByStage: Object.fromEntries(
          sessionsByStage.map(item => [item._id, item.count])
        ),
        sessionsByStatus: Object.fromEntries(
          sessionsByStatus.map(item => [item._id, item.count])
        ),
        mostActiveParticipants,
        averageBriefGenerationTime: stats?.totalBriefGenerationTime || 0,
        averageAnalysisTime: stats?.totalAnalysisTime || 0,
        ragUsageRate: stats?.totalSessions > 0 
          ? (stats.ragUsageCount / stats.totalSessions) * 100 
          : 0
      };

      this.logger.log(`Generated statistics: ${result.totalSessions} total sessions`);
      return result;
    } catch (error) {
      this.logger.error(`Error generating session statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active sessions that need attention
   */
  async getActiveSessionsNeedingAttention(): Promise<CalendarWorkflowSessionDocument[]> {
    this.logger.log('Retrieving active sessions needing attention');
    
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const sessions = await this.sessionModel.find({
        status: 'active',
        stage: { 
          $nin: [CalendarWorkflowStage.COMPLETED, CalendarWorkflowStage.ERROR] 
        },
        $or: [
          // Sessions stuck in processing
          { 
            updatedAt: { $lte: oneHourAgo },
            stage: { $ne: CalendarWorkflowStage.MEETING_MONITORING }
          },
          // Sessions with approval required
          { approvalRequired: true },
          // Sessions with errors that might be retryable
          { 
            hadErrors: true, 
            retryCount: { $lt: 3 },
            stage: { $ne: CalendarWorkflowStage.ERROR }
          }
        ]
      })
      .sort({ updatedAt: 1 })
      .exec();

      this.logger.log(`Found ${sessions.length} sessions needing attention`);
      return sessions;
    } catch (error) {
      this.logger.error(`Error retrieving sessions needing attention: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update session stage and step
   */
  async updateSessionStage(
    sessionId: string,
    stage: CalendarWorkflowStage,
    step?: CalendarWorkflowStep,
    progress?: number
  ): Promise<CalendarWorkflowSessionDocument | null> {
    this.logger.log(`Updating session ${sessionId} to stage: ${stage}`);
    
    const updates: any = { 
      stage,
      updatedAt: new Date()
    };
    
    if (step) updates.currentStep = step;
    if (progress !== undefined) updates.progress = progress;
    
    // Set completion time if reaching completed stage
    if (stage === CalendarWorkflowStage.COMPLETED) {
      updates.completedAt = new Date();
    }

    return this.updateSession(sessionId, updates);
  }

  /**
   * Add performance metrics
   */
  async addPerformanceMetric(
    sessionId: string,
    metric: string,
    value: number
  ): Promise<void> {
    this.logger.log(`Adding performance metric ${metric} for session ${sessionId}`);
    
    try {
      await this.sessionModel.updateOne(
        { sessionId },
        { 
          $set: { 
            [`processingMetadata.performanceMetrics.${metric}`]: value,
            updatedAt: new Date()
          }
        }
      ).exec();
    } catch (error) {
      this.logger.error(`Error adding performance metric: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sessions by query with advanced filtering
   */
  async findSessions(query: SessionQuery): Promise<{
    sessions: CalendarWorkflowSessionDocument[];
    total: number;
  }> {
    this.logger.log('Finding sessions with advanced query');
    
    try {
      const filter: FilterQuery<CalendarWorkflowSessionDocument> = {
        status: { $ne: 'deleted' }
      };

      // Apply all query filters
      if (query.userId) filter.userId = query.userId;
      if (query.eventId) filter.eventId = query.eventId;
      if (query.stage) filter.stage = query.stage;
      if (query.meetingStatus) filter.meetingStatus = query.meetingStatus;
      if (query.participantEmail) filter.participantEmails = query.participantEmail;
      if (query.organizer) filter.meetingOrganizer = query.organizer;
      if (query.status) filter.status = query.status;
      if (query.hasErrors !== undefined) filter.hadErrors = query.hasErrors;
      if (query.isCompleted !== undefined) {
        filter.stage = query.isCompleted 
          ? CalendarWorkflowStage.COMPLETED 
          : { $ne: CalendarWorkflowStage.COMPLETED };
      }
      if (query.dateRange) {
        filter.createdAt = {
          $gte: query.dateRange.start,
          $lte: query.dateRange.end
        };
      }

      // Get total count
      const total = await this.sessionModel.countDocuments(filter).exec();

      // Build query with sorting and pagination
      let mongoQuery = this.sessionModel.find(filter);

      // Apply sorting
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
      mongoQuery = mongoQuery.sort({ [sortBy]: sortOrder });

      // Apply pagination
      if (query.offset) mongoQuery = mongoQuery.skip(query.offset);
      if (query.limit) mongoQuery = mongoQuery.limit(query.limit);

      const sessions = await mongoQuery.exec();

      this.logger.log(`Found ${sessions.length} of ${total} sessions matching query`);
      return { sessions, total };
    } catch (error) {
      this.logger.error(`Error finding sessions: ${error.message}`);
      throw error;
    }
  }
} 