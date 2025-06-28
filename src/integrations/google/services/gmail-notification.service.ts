import { Injectable, Logger } from "@nestjs/common";
import { GmailNotificationGateway } from "./gmail-notification.gateway";
import { GmailWatchService } from "./gmail-watch.service";
import { GmailWatchRepository } from "../../../database/repositories/gmail-watch.repository";
import { Types } from "mongoose";

@Injectable()
export class GmailNotificationService {
  private readonly logger = new Logger(GmailNotificationService.name);

  constructor(
    private readonly gmailNotificationGateway: GmailNotificationGateway,
    private readonly gmailWatchService: GmailWatchService,
    private readonly gmailWatchRepository: GmailWatchRepository,
  ) {}

  /**
   * Enhanced Gmail notification processing with proactive watch cleanup
   * Fixes cross-user contamination by validating active sessions
   */
  async processGmailNotification(notificationData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Decode the notification
      const decodedData = JSON.parse(
        Buffer.from(notificationData.message.data, "base64").toString(),
      );

      const userEmail = decodedData.emailAddress;
      const historyId = decodedData.historyId;

      this.logger.log(
        `📬 Gmail notification decoded for: ${userEmail}, historyId: ${historyId}`,
      );

      // SECURITY FIX: Enhanced validation with context
      const validationResult = await this.validateNotificationSafety(userEmail);
      if (!validationResult.shouldProcess) {
        this.logger.warn(
          `🚫 SECURITY: Rejecting notification for ${userEmail}: ${validationResult.reason}`,
        );
        if (validationResult.actionTaken) {
          this.logger.log(`🛠️ Action taken: ${validationResult.actionTaken}`);
        }
        return;
      }

      this.logger.log(
        `✅ Security validation passed for ${userEmail} - processing notification`,
      );

      // Rest of the existing processing logic...
      await this.processUserNotification(userEmail, historyId);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `⚡ Gmail notification processed in ${processingTime}ms for: ${userEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to process Gmail notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Enhanced active user session validation
   */
  private async validateActiveUserSession(userEmail: string): Promise<boolean> {
    try {
      // Check if user has active WebSocket connections
      const activeConnections =
        await this.gmailNotificationGateway.getActiveConnections(userEmail);
      const hasActiveSession = activeConnections > 0;

      this.logger.log(
        `🔍 Session validation for ${userEmail}: ${hasActiveSession ? activeConnections + " active connections" : "no active connections"}`,
      );

      return hasActiveSession;
    } catch (error) {
      this.logger.error(
        `❌ Failed to validate user session for ${userEmail}: ${error.message}`,
      );
      return false; // Fail-safe: reject if we can't validate
    }
  }

  /**
   * Proactively cleanup expired Gmail watches for inactive users
   */
  private async cleanupExpiredWatch(userEmail: string): Promise<void> {
    try {
      this.logger.log(`🧹 Cleaning up expired watch for: ${userEmail}`);

      // Find watch by email
      const watch =
        await this.gmailWatchRepository.findByGoogleEmail(userEmail);
      if (!watch) {
        this.logger.log(`No watch found for cleanup: ${userEmail}`);
        return;
      }

      // Stop the watch on Google's side and deactivate in database
      await this.gmailWatchService.stopWatch(watch.userId);

      this.logger.log(`✅ Successfully cleaned up watch for: ${userEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to cleanup watch for ${userEmail}: ${error.message}`,
      );
    }
  }

  /**
   * Process notification for a specific user
   */
  private async processUserNotification(
    userEmail: string,
    historyId: string,
  ): Promise<void> {
    // Implement the actual notification processing logic here
    this.logger.log(
      `Processing notification for ${userEmail} with historyId ${historyId}`,
    );

    // Update watch statistics
    try {
      const watch =
        await this.gmailWatchRepository.findByGoogleEmail(userEmail);
      if (watch) {
        await this.gmailWatchRepository.incrementNotificationCount(
          watch.watchId,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to update watch statistics: ${error.message}`);
    }
  }

  /**
   * Get active user sessions for monitoring
   */
  async getActiveUserSessions(): Promise<Map<string, number>> {
    return this.gmailNotificationGateway.getActiveUserSessions();
  }

  /**
   * Force cleanup of inactive sessions (admin/maintenance function)
   */
  async forceCleanupInactiveSessions(): Promise<void> {
    this.logger.log("🧹 Running forced cleanup of inactive sessions");
    this.gmailNotificationGateway.cleanupInactiveSessions();
  }

  /**
   * Disconnect all WebSocket sessions for a specific user email
   * Used when user explicitly disconnects from email triage
   */
  async disconnectUserSessions(userEmail: string): Promise<void> {
    this.logger.log(`🔌 Disconnecting all WebSocket sessions for user: ${userEmail}`);
    this.gmailNotificationGateway.disconnectUserSessions(userEmail);
  }

  /**
   * Enhanced cleanup that also removes Gmail watches for inactive users
   */
  async comprehensiveCleanup(): Promise<{
    sessionsCleanedUp: number;
    watchesCleanedUp: number;
    watchesCleanupFailed: number;
  }> {
    try {
      this.logger.log(
        "🧹 Starting comprehensive cleanup of sessions and watches",
      );

      // Get currently active user sessions
      const activeSessions = await this.getActiveUserSessions();
      const activeUserEmails = new Set(activeSessions.keys());

      this.logger.log(`📊 Found ${activeUserEmails.size} active user sessions`);

      // Clean up WebSocket sessions first
      this.gmailNotificationGateway.cleanupInactiveSessions();

      // Clean up Gmail watches for users without active sessions
      const watchCleanupResult =
        await this.gmailWatchService.cleanupInactiveWatches(activeUserEmails);

      const result = {
        sessionsCleanedUp: activeSessions.size - activeUserEmails.size,
        watchesCleanedUp: watchCleanupResult.cleaned,
        watchesCleanupFailed: watchCleanupResult.failed,
      };

      this.logger.log(`🎯 Comprehensive cleanup completed:
        - Sessions cleaned: ${result.sessionsCleanedUp}
        - Watches cleaned: ${result.watchesCleanedUp}
        - Watch cleanup failures: ${result.watchesCleanupFailed}`);

      return result;
    } catch (error) {
      this.logger.error("Failed to perform comprehensive cleanup:", error);
      throw error;
    }
  }

  /**
   * Validate notification and prevent cross-contamination
   * Returns true if notification should be processed, false if it should be rejected
   */
  async validateNotificationSafety(userEmail: string): Promise<{
    shouldProcess: boolean;
    reason: string;
    actionTaken?: string;
  }> {
    try {
      // Check if user has active sessions
      const activeConnections = await this.validateActiveUserSession(userEmail);

      if (!activeConnections) {
        // User has no active sessions - this could be cross-contamination
        this.logger.warn(
          `🚫 SECURITY: Notification for ${userEmail} rejected - no active sessions`,
        );

        // Proactively clean up the watch
        await this.cleanupExpiredWatch(userEmail);

        return {
          shouldProcess: false,
          reason: "No active user sessions found",
          actionTaken: "Watch cleanup initiated",
        };
      }

      // Check if this is a recent watch (avoid processing very old notifications)
      const watch =
        await this.gmailWatchRepository.findByGoogleEmail(userEmail);
      if (watch && watch.createdAt) {
        const watchAge = Date.now() - watch.createdAt.getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (watchAge > maxAge) {
          this.logger.warn(
            `⏰ Notification for ${userEmail} rejected - watch too old (${Math.round(watchAge / (24 * 60 * 60 * 1000))} days)`,
          );

          return {
            shouldProcess: false,
            reason: "Watch is too old",
            actionTaken: "Consider watch renewal",
          };
        }
      }

      return {
        shouldProcess: true,
        reason: "Validation passed",
      };
    } catch (error) {
      this.logger.error(
        `Failed to validate notification safety for ${userEmail}: ${error.message}`,
      );
      return {
        shouldProcess: false,
        reason: "Validation failed due to error",
        actionTaken: "Notification rejected for safety",
      };
    }
  }
}
