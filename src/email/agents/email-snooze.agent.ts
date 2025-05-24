import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface SnoozeRequest {
  emailId: string;
  userId: string;
  snoozeUntil: Date;
  reason?: string;
  notes?: string;
}

export interface SnoozeResult {
  id: string;
  emailId: string;
  userId: string;
  snoozeUntil: Date;
  reason?: string;
  notes?: string;
  status: 'snoozed' | 'awakened' | 'cancelled';
  createdAt: Date;
  awakenedAt?: Date;
}

/**
 * EmailSnoozeAgent - Handles email snoozing functionality
 * Part of Phase 5 implementation for user workflow management
 * Integrates with Master Supervisor for scheduled re-triggering
 */
@Injectable()
export class EmailSnoozeAgent {
  private readonly logger = new Logger(EmailSnoozeAgent.name);
  private snoozeTimers: Map<string, NodeJS.Timeout> = new Map();
  private snoozeRecords: Map<string, SnoozeResult> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Snooze an email until specified time
   */
  async snoozeEmail(request: SnoozeRequest): Promise<SnoozeResult> {
    this.logger.log(`Snoozing email ${request.emailId} until ${request.snoozeUntil.toISOString()}`);
    
    try {
      const snoozeId = `snooze-${Date.now()}-${request.emailId}`;
      const now = new Date();
      
      // Validate snooze time is in the future
      if (request.snoozeUntil <= now) {
        throw new Error('Snooze time must be in the future');
      }

      // Create snooze record
      const snoozeResult: SnoozeResult = {
        id: snoozeId,
        emailId: request.emailId,
        userId: request.userId,
        snoozeUntil: request.snoozeUntil,
        reason: request.reason,
        notes: request.notes,
        status: 'snoozed',
        createdAt: now,
      };

      // Calculate delay in milliseconds
      const delay = request.snoozeUntil.getTime() - now.getTime();
      
      // Set up timer for re-triggering
      const timer = setTimeout(() => {
        this.awakenSnooze(snoozeId);
      }, delay);

      // Store timer and record
      this.snoozeTimers.set(snoozeId, timer);
      this.snoozeRecords.set(snoozeId, snoozeResult);

      // Emit snooze event
      this.eventEmitter.emit('email.snoozed', {
        snoozeId,
        emailId: request.emailId,
        userId: request.userId,
        snoozeUntil: request.snoozeUntil,
        delayMs: delay,
        timestamp: now.toISOString(),
      });

      this.logger.log(`Email ${request.emailId} snoozed successfully until ${request.snoozeUntil.toISOString()}`);
      return snoozeResult;

    } catch (error) {
      this.logger.error(`Failed to snooze email ${request.emailId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel a snoozed email (unsnooze)
   */
  async cancelSnooze(snoozeId: string, userId: string): Promise<void> {
    this.logger.log(`Cancelling snooze ${snoozeId}`);
    
    try {
      const snoozeRecord = this.snoozeRecords.get(snoozeId);
      if (!snoozeRecord) {
        throw new Error('Snooze record not found');
      }

      // Verify user ownership
      if (snoozeRecord.userId !== userId) {
        throw new Error('Unauthorized: User does not own this snooze');
      }

      // Clear the timer
      const timer = this.snoozeTimers.get(snoozeId);
      if (timer) {
        clearTimeout(timer);
        this.snoozeTimers.delete(snoozeId);
      }

      // Update record status
      snoozeRecord.status = 'cancelled';
      snoozeRecord.awakenedAt = new Date();

      // Emit cancellation event
      this.eventEmitter.emit('email.snooze.cancelled', {
        snoozeId,
        emailId: snoozeRecord.emailId,
        userId: snoozeRecord.userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Snooze ${snoozeId} cancelled successfully`);

    } catch (error) {
      this.logger.error(`Failed to cancel snooze ${snoozeId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Awaken a snoozed email (internal method called by timer)
   */
  private async awakenSnooze(snoozeId: string): Promise<void> {
    this.logger.log(`Awakening snooze ${snoozeId}`);
    
    try {
      const snoozeRecord = this.snoozeRecords.get(snoozeId);
      if (!snoozeRecord) {
        this.logger.warn(`Snooze record ${snoozeId} not found for awakening`);
        return;
      }

      // Update record status
      snoozeRecord.status = 'awakened';
      snoozeRecord.awakenedAt = new Date();

      // Clean up timer
      this.snoozeTimers.delete(snoozeId);

      // Emit awakening event for Master Supervisor to re-trigger email processing
      this.eventEmitter.emit('email.snooze.awakened', {
        snoozeId,
        emailId: snoozeRecord.emailId,
        userId: snoozeRecord.userId,
        originalSnoozeTime: snoozeRecord.snoozeUntil,
        awakenedAt: snoozeRecord.awakenedAt,
        reason: snoozeRecord.reason,
        notes: snoozeRecord.notes,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Snooze ${snoozeId} awakened successfully - email ${snoozeRecord.emailId} returned to active state`);

    } catch (error) {
      this.logger.error(`Failed to awaken snooze ${snoozeId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Get all active snoozes for a user
   */
  async getActiveSnoozes(userId: string): Promise<SnoozeResult[]> {
    this.logger.log(`Getting active snoozes for user ${userId}`);
    
    const activeSnoozes = Array.from(this.snoozeRecords.values())
      .filter(snooze => snooze.userId === userId && snooze.status === 'snoozed');

    return activeSnoozes;
  }

  /**
   * Get snooze history for an email
   */
  async getSnoozeHistory(emailId: string): Promise<SnoozeResult[]> {
    this.logger.log(`Getting snooze history for email ${emailId}`);
    
    const history = Array.from(this.snoozeRecords.values())
      .filter(snooze => snooze.emailId === emailId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return history;
  }

  /**
   * Get snooze details by ID
   */
  async getSnoozeById(snoozeId: string): Promise<SnoozeResult | null> {
    return this.snoozeRecords.get(snoozeId) || null;
  }

  /**
   * Get summary of snooze statistics for a user
   */
  async getSnoozeStats(userId: string): Promise<any> {
    this.logger.log(`Getting snooze statistics for user ${userId}`);
    
    const userSnoozes = Array.from(this.snoozeRecords.values())
      .filter(snooze => snooze.userId === userId);

    const stats = {
      total: userSnoozes.length,
      active: userSnoozes.filter(s => s.status === 'snoozed').length,
      awakened: userSnoozes.filter(s => s.status === 'awakened').length,
      cancelled: userSnoozes.filter(s => s.status === 'cancelled').length,
      upcomingAwakenings: userSnoozes
        .filter(s => s.status === 'snoozed')
        .map(s => ({
          snoozeId: s.id,
          emailId: s.emailId,
          snoozeUntil: s.snoozeUntil,
          reason: s.reason,
        }))
        .sort((a, b) => a.snoozeUntil.getTime() - b.snoozeUntil.getTime()),
    };

    return stats;
  }

  /**
   * Clean up expired snooze records (cleanup utility method)
   */
  async cleanupExpiredSnoozes(olderThanDays: number = 30): Promise<number> {
    this.logger.log(`Cleaning up snooze records older than ${olderThanDays} days`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let cleanedCount = 0;
    
    for (const [snoozeId, snooze] of this.snoozeRecords.entries()) {
      if (snooze.createdAt < cutoffDate && snooze.status !== 'snoozed') {
        this.snoozeRecords.delete(snoozeId);
        cleanedCount++;
      }
    }

    this.logger.log(`Cleaned up ${cleanedCount} expired snooze records`);
    return cleanedCount;
  }
} 