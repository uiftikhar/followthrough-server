import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';

@Injectable()
export class SessionRepository {
  private readonly logger = new Logger(SessionRepository.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {}

  /**
   * Create a new session
   */
  async createSession(sessionData: Partial<Session>): Promise<Session> {
    this.logger.log(`Creating new session for user ${sessionData.userId}`);
    const session = new this.sessionModel(sessionData);
    return session.save();
  }

  /**
   * Get a session by ID
   */
  async getSessionById(sessionId: string): Promise<Session> {
    this.logger.log(`Fetching session ${sessionId}`);
    const session = await this.sessionModel.findOne({ sessionId }).exec();
    
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    
    return session;
  }

  /**
   * Get a session by ID, with user ID verification
   */
  async getSessionByIdAndUserId(sessionId: string, userId: string): Promise<Session> {
    this.logger.log(`Fetching session ${sessionId} for user ${userId}`);
    const session = await this.sessionModel.findOne({ sessionId, userId }).exec();
    
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found for user ${userId}`);
    }
    
    return session;
  }

  /**
   * Update a session
   */
  async updateSession(sessionId: string, sessionData: Partial<Session>): Promise<Session> {
    this.logger.log(`Updating session ${sessionId}`);
    
    const session = await this.sessionModel
      .findOneAndUpdate({ sessionId }, sessionData, { new: true })
      .exec();
    
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    
    return session;
  }

  /**
   * Update a session, with user ID verification
   */
  async updateSessionWithUserId(
    sessionId: string, 
    userId: string,
    sessionData: Partial<Session>
  ): Promise<Session> {
    this.logger.log(`Updating session ${sessionId} for user ${userId}`);
    
    const session = await this.sessionModel
      .findOneAndUpdate({ sessionId, userId }, sessionData, { new: true })
      .exec();
    
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found for user ${userId}`);
    }
    
    return session;
  }

  /**
   * Get all sessions for a user
   */
  async getSessionsByUserId(userId: string): Promise<Session[]> {
    this.logger.log(`Fetching all sessions for user ${userId}`);
    return this.sessionModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.logger.log(`Deleting session ${sessionId}`);
    const result = await this.sessionModel.deleteOne({ sessionId }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
  }

  /**
   * Delete a session, with user ID verification
   */
  async deleteSessionWithUserId(sessionId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting session ${sessionId} for user ${userId}`);
    const result = await this.sessionModel.deleteOne({ sessionId, userId }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Session ${sessionId} not found for user ${userId}`);
    }
  }
} 