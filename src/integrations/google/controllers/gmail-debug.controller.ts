import {
  Controller,
  Get,
  Post,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  Body,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/guards/jwt-auth.guard";
import { GmailWatchService } from "../services/gmail-watch.service";
import { GoogleOAuthService } from "../services/google-oauth.service";
import { GmailWatchRepository } from "../../../database/repositories/gmail-watch.repository";
import { google } from "googleapis";

interface OrphanedWatchCleanupDto {
  googleEmail: string;
  forceCleanup?: boolean;
}

@Controller("api/gmail/debug")
@UseGuards(JwtAuthGuard)
export class GmailDebugController {
  private readonly logger = new Logger(GmailDebugController.name);

  constructor(
    private readonly gmailWatchService: GmailWatchService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly gmailWatchRepository: GmailWatchRepository,
  ) {}

  /**
   * Debug Gmail watch status - shows database vs Google API status
   * GET /api/gmail/debug/watch-status
   */
  @Get("watch-status")
  async debugWatchStatus() {
    try {
      this.logger.log("🔍 Debugging Gmail watch status...");

      // Get all watches from database
      const dbWatches = await this.gmailWatchRepository.findAllActive();

      const recommendations: string[] = [];

      const debugInfo = {
        database: {
          totalWatches: dbWatches.length,
          watches: dbWatches.map((watch) => ({
            email: watch.googleEmail,
            watchId: watch.watchId,
            userId: watch.userId.toString(),
            isActive: watch.isActive,
            expiresAt: watch.expiresAt,
            notificationsReceived: watch.notificationsReceived || 0,
            errorCount: watch.errorCount || 0,
            lastError: watch.lastError,
          })),
        },
        recommendations,
      };

      // Add recommendations
      if (dbWatches.length === 0) {
        recommendations.push(
          "🚨 No active watches in database but receiving notifications = ORPHANED WATCHES",
        );
        recommendations.push(
          "💡 Use POST /api/gmail/debug/cleanup-orphaned to clean up",
        );
      }

      recommendations.push(
        "📊 Check server logs for push notifications from unwanted emails",
      );
      recommendations.push(
        "🛡️ Graceful shutdown is enabled to prevent future orphaned watches",
      );

      return {
        success: true,
        debug: debugInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Debug watch status failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Debug watch status failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Clean up orphaned watches that exist in Google but not in database
   * POST /api/gmail/debug/cleanup-orphaned
   */
  @Post("cleanup-orphaned")
  async cleanupOrphanedWatches(@Body() body: OrphanedWatchCleanupDto) {
    try {
      const { googleEmail, forceCleanup = false } = body;

      this.logger.log(
        `🧹 Attempting to cleanup orphaned watch for: ${googleEmail}`,
      );

      if (!googleEmail) {
        throw new HttpException(
          "googleEmail is required",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if watch exists in database
      const dbWatch =
        await this.gmailWatchRepository.findByGoogleEmail(googleEmail);
      if (dbWatch && dbWatch.isActive && !forceCleanup) {
        return {
          success: false,
          message:
            "Watch exists in database and is active. Use forceCleanup: true to override.",
          watchInfo: {
            watchId: dbWatch.watchId,
            userId: dbWatch.userId.toString(),
            isActive: dbWatch.isActive,
          },
        };
      }

      // Try to find the user by email to get authentication
      // This is a bit tricky since we don't have user mapping by email
      // We'll need to try to stop the watch using a service account or admin approach

      this.logger.warn(
        `⚠️ Cannot directly stop orphaned watch for ${googleEmail} - no user mapping available`,
      );
      this.logger.log(`💡 Recommended manual cleanup:`);
      this.logger.log(
        `1. The orphaned watch will expire naturally (within 7 days)`,
      );
      this.logger.log(
        `2. Or use Google Cloud Console to manage Pub/Sub subscriptions`,
      );
      this.logger.log(
        `3. Or implement admin-level cleanup with service account`,
      );

      return {
        success: true,
        action: "identified_orphaned_watch",
        message: `Orphaned watch detected for ${googleEmail}. Watch will expire naturally or needs manual cleanup.`,
        recommendations: [
          "Check Google Cloud Console Pub/Sub subscriptions",
          "Monitor server logs for continued notifications",
          "Implement service account cleanup if needed",
          "Wait for natural expiration (max 7 days)",
        ],
        dbStatus: dbWatch ? "exists_but_inactive" : "not_found",
      };
    } catch (error) {
      this.logger.error(
        `❌ Cleanup orphaned watches failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Cleanup orphaned watches failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Force stop all Gmail watches using Google API (admin function)
   * POST /api/gmail/debug/force-stop-all
   */
  @Post("force-stop-all")
  async forceStopAllWatches() {
    try {
      this.logger.log("🛑 Force stopping all Gmail watches...");

      // Get all database watches first
      const dbWatches = await this.gmailWatchRepository.findAllActive();

      let stoppedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const watch of dbWatches) {
        try {
          this.logger.log(`🛑 Stopping watch for: ${watch.googleEmail}`);

          // Get authenticated client for this user
          const client = await this.googleOAuthService.getAuthenticatedClient(
            watch.userId.toString(),
          );
          const gmail = google.gmail({ version: "v1", auth: client });

          // Stop the watch
          await gmail.users.stop({ userId: "me" });

          // Deactivate in database
          await this.gmailWatchRepository.deactivateByUserId(watch.userId);

          stoppedCount++;
          this.logger.log(`✅ Stopped watch for: ${watch.googleEmail}`);
        } catch (error) {
          failedCount++;
          const errorMsg = `Failed to stop watch for ${watch.googleEmail}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);
        }
      }

      return {
        success: true,
        message: `Force stop completed: ${stoppedCount} stopped, ${failedCount} failed`,
        results: {
          totalWatches: dbWatches.length,
          stoppedCount,
          failedCount,
          errors,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Force stop all watches failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Force stop all watches failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get recent push notification logs (simulated)
   * GET /api/gmail/debug/recent-notifications
   */
  @Get("recent-notifications")
  async getRecentNotifications() {
    try {
      // This would ideally check application logs or a notification history table
      // For now, we'll provide guidance on what to look for

      return {
        success: true,
        message: "Check server logs for recent push notifications",
        lookFor: [
          "PUSH NOTIFICATION RECEIVED messages",
          "Gmail notification decoded for: [email] messages",
          "No active watch found for email: [email] warnings",
        ],
        logPatterns: [
          "🔔 PUSH NOTIFICATION RECEIVED:",
          "📬 Gmail notification decoded for:",
          "⚠️ No active watch found for email:",
        ],
        instructions: [
          "Check recent server logs for these patterns",
          "Any email receiving notifications without active watch = orphaned",
          "Use cleanup endpoints to resolve orphaned watches",
        ],
      };
    } catch (error) {
      this.logger.error(
        `❌ Get recent notifications failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Get recent notifications failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Detect email account mismatches and orphaned notifications
   * GET /api/gmail/debug/account-mismatch
   */
  @Get("account-mismatch")
  async detectAccountMismatch() {
    try {
      this.logger.log("🔍 Detecting email account mismatches...");

      // Get all active watches from database
      const dbWatches = await this.gmailWatchRepository.findAllActive();

      const mismatchInfo = {
        totalActiveWatches: dbWatches.length,
        watchDetails: [] as any[],
        orphanedNotifications: {
          detected: false,
          emails: [] as string[],
          guidance: [] as string[],
        },
        recommendations: [] as string[],
      };

      // Analyze each watch for potential issues
      for (const watch of dbWatches) {
        try {
          // Try to verify the watch account is still valid
          const client = await this.googleOAuthService.getAuthenticatedClient(
            watch.userId.toString(),
          );
          const gmail = google.gmail({ version: "v1", auth: client });
          const profile = await gmail.users.getProfile({ userId: "me" });
          const currentAuthEmail = profile.data.emailAddress!;

          const watchDetail = {
            watchId: watch.watchId,
            storedEmail: watch.googleEmail,
            currentAuthEmail,
            userId: watch.userId.toString(),
            isMatching: watch.googleEmail === currentAuthEmail,
            notificationsReceived: watch.notificationsReceived || 0,
            errorCount: watch.errorCount || 0,
            lastError: watch.lastError,
            status:
              watch.googleEmail === currentAuthEmail ? "valid" : "mismatch",
          };

          mismatchInfo.watchDetails.push(watchDetail);

          if (!watchDetail.isMatching) {
            mismatchInfo.orphanedNotifications.detected = true;
            mismatchInfo.orphanedNotifications.emails.push(watch.googleEmail);
          }
        } catch (error) {
          // Authentication failed - this user's tokens may be expired
          const watchDetail = {
            watchId: watch.watchId,
            storedEmail: watch.googleEmail,
            currentAuthEmail: "AUTH_FAILED",
            userId: watch.userId.toString(),
            isMatching: false,
            notificationsReceived: watch.notificationsReceived || 0,
            errorCount: watch.errorCount || 0,
            lastError: error.message,
            status: "auth_failed",
          };

          mismatchInfo.watchDetails.push(watchDetail);
          mismatchInfo.orphanedNotifications.detected = true;
          mismatchInfo.orphanedNotifications.emails.push(watch.googleEmail);
        }
      }

      // Generate recommendations based on findings
      if (mismatchInfo.orphanedNotifications.detected) {
        mismatchInfo.recommendations.push(
          "🚨 Email account mismatches detected",
        );
        mismatchInfo.recommendations.push(
          "💡 Users may be receiving notifications for wrong accounts",
        );
        mismatchInfo.recommendations.push(
          "🔧 Use POST /api/gmail/debug/cleanup-orphaned to clean up",
        );

        mismatchInfo.orphanedNotifications.guidance = [
          "Check server logs for notifications to emails without active watches",
          "Users should re-authenticate with their intended Gmail account",
          "Clean up watches for accounts that no longer match authentication",
          "Educate users about which Gmail account they're monitoring",
        ];
      } else if (dbWatches.length === 0) {
        mismatchInfo.recommendations.push(
          "ℹ️ No active watches found - no mismatch possible",
        );
        mismatchInfo.recommendations.push(
          "📝 Monitor logs for orphaned notifications from previous sessions",
        );
      } else {
        mismatchInfo.recommendations.push(
          "✅ All active watches appear to be correctly configured",
        );
        mismatchInfo.recommendations.push(
          "📊 Continue monitoring for notification patterns",
        );
      }

      return {
        success: true,
        debug: mismatchInfo,
        summary: {
          totalWatches: mismatchInfo.totalActiveWatches,
          validWatches: mismatchInfo.watchDetails.filter(
            (w) => w.status === "valid",
          ).length,
          mismatchedWatches: mismatchInfo.watchDetails.filter(
            (w) => w.status === "mismatch",
          ).length,
          authFailedWatches: mismatchInfo.watchDetails.filter(
            (w) => w.status === "auth_failed",
          ).length,
          orphanedDetected: mismatchInfo.orphanedNotifications.detected,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Account mismatch detection failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Account mismatch detection failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ADMIN: Unsubscribe all users from Google Pub/Sub notifications (nuclear option)
   * POST /api/gmail/debug/unsubscribe-all-pubsub
   * This stops ALL Gmail watches and Pub/Sub subscriptions for ALL users
   */
  @Post("unsubscribe-all-pubsub")
  async unsubscribeAllPubSubNotifications() {
    try {
      this.logger.log("🚨 ADMIN: Starting nuclear unsubscribe - stopping ALL Gmail watches and Pub/Sub subscriptions");

      const results = {
        success: true,
        message: "Nuclear unsubscribe completed",
        summary: {
          totalWatchesFound: 0,
          googleApiUnsubscribed: 0,
          databaseCleaned: 0,
          authenticationFailed: 0,
          errors: [] as string[]
        },
        details: {
          processedWatches: [] as any[],
          failedWatches: [] as any[]
        }
      };

      // Step 1: Get all active watches from database
      const allWatches = await this.gmailWatchRepository.findAllActive();
      results.summary.totalWatchesFound = allWatches.length;

      if (allWatches.length === 0) {
        this.logger.log("ℹ️ No active watches found to unsubscribe");
        return {
          ...results,
          message: "No active Gmail watches found to unsubscribe",
          recommendation: "Check for orphaned notifications in server logs"
        };
      }

      this.logger.log(`📊 Found ${allWatches.length} active watches to unsubscribe`);

      // Step 2: Process each watch - stop Google API watch (Pub/Sub unsubscription) and clean database
      for (const watch of allWatches) {
        const watchResult = {
          watchId: watch.watchId,
          googleEmail: watch.googleEmail,
          userId: watch.userId.toString(),
          googleApiStopped: false,
          databaseCleaned: false,
          authenticationValid: false,
          error: null as string | null
        };

        try {
          this.logger.log(`🛑 Processing watch for: ${watch.googleEmail} (${watch.watchId})`);

          // Try to stop Gmail watch via Google API (this unsubscribes from Pub/Sub)
          try {
            const client = await this.googleOAuthService.getAuthenticatedClient(
              watch.userId.toString(),
            );
            const gmail = google.gmail({ version: "v1", auth: client });

            // Stop the watch - this stops Pub/Sub notifications
            await gmail.users.stop({ userId: "me" });
            watchResult.googleApiStopped = true;
            watchResult.authenticationValid = true;
            results.summary.googleApiUnsubscribed++;

            this.logger.log(`✅ Stopped Gmail watch (Pub/Sub unsubscribed) for: ${watch.googleEmail}`);
          } catch (apiError) {
            if (apiError.code === 404 || apiError.message?.includes("not found")) {
              // No active watch on Google's side - consider as success
              this.logger.log(`ℹ️ No active watch found on Google's side for: ${watch.googleEmail} (already unsubscribed)`);
              watchResult.googleApiStopped = true;
              watchResult.authenticationValid = true;
              results.summary.googleApiUnsubscribed++;
            } else if (apiError.code === 401 || apiError.code === 403) {
              // Authentication failed
              watchResult.authenticationValid = false;
              watchResult.error = `Authentication failed: ${apiError.message}`;
              results.summary.authenticationFailed++;
              this.logger.warn(`🔑 Authentication failed for ${watch.googleEmail}: ${apiError.message}`);
            } else {
              // Other API error
              watchResult.error = `Google API error: ${apiError.message}`;
              results.summary.errors.push(`Google API error for ${watch.googleEmail}: ${apiError.message}`);
              this.logger.error(`❌ Google API error for ${watch.googleEmail}: ${apiError.message}`);
            }
          }

          // Always try to clean up database record regardless of Google API result
          try {
            await this.gmailWatchService.deactivateWatch(watch.userId);
            watchResult.databaseCleaned = true;
            results.summary.databaseCleaned++;
            this.logger.log(`✅ Deactivated database watch for: ${watch.googleEmail}`);
          } catch (dbError) {
            watchResult.error = watchResult.error 
              ? `${watchResult.error}; Database cleanup failed: ${dbError.message}`
              : `Database cleanup failed: ${dbError.message}`;
            results.summary.errors.push(`Database cleanup failed for ${watch.googleEmail}: ${dbError.message}`);
            this.logger.error(`❌ Database cleanup failed for ${watch.googleEmail}: ${dbError.message}`);
          }

          // Categorize the result
          if (watchResult.error) {
            results.details.failedWatches.push(watchResult);
          } else {
            results.details.processedWatches.push(watchResult);
          }

        } catch (error) {
          // Unexpected error processing this watch
          watchResult.error = `Unexpected error: ${error.message}`;
          results.details.failedWatches.push(watchResult);
          results.summary.errors.push(`Unexpected error for ${watch.googleEmail}: ${error.message}`);
          this.logger.error(`❌ Unexpected error processing watch for ${watch.googleEmail}: ${error.message}`);
        }
      }

      // Step 3: Final assessment
      const totalProcessed = results.summary.googleApiUnsubscribed + results.summary.authenticationFailed;
      const hasErrors = results.summary.errors.length > 0;

      if (hasErrors || results.details.failedWatches.length > 0) {
        results.success = totalProcessed > 0; // Partial success
        results.message = `Nuclear unsubscribe completed with ${results.summary.errors.length} errors - ${results.summary.googleApiUnsubscribed} successfully unsubscribed`;
      } else {
        results.message = `Nuclear unsubscribe completed successfully - ${results.summary.googleApiUnsubscribed} Gmail watches stopped and Pub/Sub unsubscribed`;
      }

      this.logger.log(`🎯 NUCLEAR UNSUBSCRIBE SUMMARY:
        - Total watches found: ${results.summary.totalWatchesFound}
        - Google API unsubscribed: ${results.summary.googleApiUnsubscribed}
        - Database cleaned: ${results.summary.databaseCleaned}
        - Authentication failed: ${results.summary.authenticationFailed}
        - Errors: ${results.summary.errors.length}`);

      if (results.summary.errors.length > 0) {
        this.logger.warn(`⚠️ Some watches failed to unsubscribe:`, results.summary.errors);
      }

      return {
        ...results,
        impact: {
          description: "All Gmail push notifications to this server have been stopped",
          pubsubStatus: "All user Pub/Sub subscriptions have been terminated",
          userImpact: "Users will no longer receive email triage notifications",
          recovery: "Users must re-setup notifications individually using POST /gmail/client/setup-notifications"
        },
        nextSteps: {
          immediate: [
            "Monitor server logs to confirm no more push notifications are received",
            "Check Google Cloud Console Pub/Sub subscriptions for any remaining subscriptions",
            "Notify users that email triage has been disabled"
          ],
          recovery: [
            "Users can re-enable email triage using POST /gmail/client/setup-notifications",
            "Consider implementing user notification system to inform about the reset",
            "Monitor system for proper re-activation by users"
          ]
        }
      };

    } catch (error) {
      this.logger.error(`❌ Nuclear unsubscribe failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          message: `Nuclear unsubscribe failed: ${error.message}`,
          error: error.message,
          recommendation: "Check server logs and try individual cleanup operations instead"
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
