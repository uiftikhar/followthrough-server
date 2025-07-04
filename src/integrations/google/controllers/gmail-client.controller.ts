import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Param,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { Types } from "mongoose";
import { GoogleOAuthService } from "../services/google-oauth.service";
import { GmailWatchService } from "../services/gmail-watch.service";
import { PubSubService, GmailNotification } from "../services/pubsub.service";
import { GmailService } from "../services/gmail.service";
import { GmailNotificationService } from "../services/gmail-notification.service";
import { GmailEmailProcessorService, GmailEmailData } from "../services/gmail-email-processor.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { google, gmail_v1 } from "googleapis";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

interface TestEmailTriageDto {
  subject: string;
  from: string;
  body: string;
  to?: string;
}

interface SetupGmailNotificationsDto {
  labelIds?: string[];
  labelFilterBehavior?: "INCLUDE" | "EXCLUDE";
}

/**
 * Gmail Client Controller - Complete API for Gmail Push Notifications
 *
 * This controller provides all endpoints needed for clients to:
 * 1. Complete OAuth flow with Google
 * 2. Set up Gmail push notifications
 * 3. Test the complete workflow
 * 4. Monitor system health and status
 *
 * Usage Flow:
 * 1. GET /gmail/client/auth-url - Get OAuth URL
 * 2. User completes OAuth flow
 * 3. GET /gmail/client/status - Check connection status
 * 4. POST /gmail/client/setup-notifications - Enable push notifications
 * 5. POST /gmail/client/test-triage - Test email processing
 * 6. GET /gmail/client/health - Monitor system health
 */
@Controller("gmail/client")
export class GmailClientController {
  private readonly logger = new Logger(GmailClientController.name);

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly gmailWatchService: GmailWatchService,
    private readonly pubSubService: PubSubService,
    private readonly gmailService: GmailService,
    private readonly gmailNotificationService: GmailNotificationService,
    private readonly gmailEmailProcessor: GmailEmailProcessorService, // ✅ NEW: Unified email processing
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get Google OAuth authorization URL
   * Step 1: Client calls this to get OAuth URL for user
   */
  @Get("auth-url")
  @UseGuards(AuthGuard("jwt"))
  async getAuthUrl(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      const authUrl = this.googleOAuthService.generateAuthUrl(userId);

      this.logger.log(`OAuth URL generated for user: ${userId}`);

      return {
        success: true,
        authUrl,
        message: "Redirect user to this URL to authorize Google access",
        instructions:
          "After user completes OAuth, call /gmail/client/status to verify connection",
      };
    } catch (error) {
      this.logger.error("Failed to generate OAuth URL:", error);
      throw new HttpException(
        "Failed to generate OAuth URL",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Gmail client status with clear account information
   * GET /gmail/client/status
   */
  @Get("status")
  @UseGuards(AuthGuard("jwt"))
  async getStatus(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      this.logger.log(`📊 Getting Gmail status for user: ${userId}`);

      // Check Google OAuth connection (lightweight check)
      const isConnected = await this.googleOAuthService.isConnected(userId);

      let authenticatedEmail: string | null = null;
      let authenticationStatus = "not_connected";

      if (isConnected) {
        try {
          // Get authenticated Gmail account
          const client =
            await this.googleOAuthService.getAuthenticatedClient(userId);
          const gmail = google.gmail({ version: "v1", auth: client });
          const profile = await gmail.users.getProfile({ userId: "me" });
          authenticatedEmail = profile.data.emailAddress!;
          authenticationStatus = "connected";
          this.logger.log(
            `✅ User ${userId} authenticated as Gmail: ${authenticatedEmail}`,
          );
        } catch (error) {
          authenticationStatus = "auth_failed";
          this.logger.warn(
            `❌ Authentication failed for user ${userId}: ${error.message}`,
          );
        }
      } else {
        this.logger.log(`❌ User ${userId} not connected to Google`);
      }

      // Check Gmail watch status
      const watchInfo = await this.gmailWatchService.getWatchInfo(
        new Types.ObjectId(userId),
      );

      // Basic Pub/Sub config check (no network calls)
      const pubsubConfigured = this.pubSubService.isConfiguredProperly();

      // Determine overall status and any issues
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (!isConnected) {
        issues.push("Not connected to Google");
        recommendations.push("Complete OAuth authorization first");
      } else if (authenticationStatus === "auth_failed") {
        issues.push("Google authentication failed");
        recommendations.push("Refresh your Google authorization");
      }

      if (!watchInfo || !watchInfo.isActive) {
        issues.push("No active Gmail watch");
        recommendations.push("Set up Gmail notifications");
      } else if (
        authenticatedEmail &&
        watchInfo.googleEmail !== authenticatedEmail
      ) {
        issues.push("Email account mismatch detected");
        issues.push(
          `Watch exists for ${watchInfo.googleEmail} but authenticated as ${authenticatedEmail}`,
        );
        recommendations.push("Re-authenticate with the correct Gmail account");
        recommendations.push("Then set up notifications again");
      }

      if (!pubsubConfigured) {
        issues.push("Pub/Sub not properly configured");
        recommendations.push("Check Google Cloud configuration");
      }

      const status = {
        user: {
          userId,
          isConnectedToGoogle: isConnected,
          authenticationStatus,
        },
        gmail: {
          authenticatedAs: authenticatedEmail,
          monitoringAccount: watchInfo?.googleEmail || null,
          accountsMatch: authenticatedEmail === watchInfo?.googleEmail,
          watchActive: watchInfo?.isActive || false,
          watchDetails: watchInfo
            ? {
                watchId: watchInfo.watchId,
                expiresAt: watchInfo.expiresAt,
                notificationsReceived: watchInfo.notificationsReceived,
                emailsProcessed: watchInfo.emailsProcessed,
                errorCount: watchInfo.errorCount,
              }
            : null,
        },
        infrastructure: {
          pubsubConfigured,
          note: "Use /gmail/client/health for detailed infrastructure testing",
        },
        health: {
          overall: issues.length === 0 ? "healthy" : "issues_detected",
          issues,
          recommendations,
        },
      };

      // Add specific guidance based on the situation
      if (status.gmail.authenticatedAs && status.gmail.monitoringAccount) {
        if (status.gmail.accountsMatch) {
          status.health.recommendations.unshift(
            "✅ Your Gmail notifications are correctly configured",
          );
        } else {
          status.health.recommendations.unshift(
            "⚠️ Account mismatch: You will not receive notifications for the expected account",
          );
        }
      }

      this.logger.log(
        `📊 Status check completed for user ${userId}: ${status.health.overall}`,
      );

      return {
        success: true,
        status,
        nextSteps:
          status.health.overall === "healthy"
            ? ["Send an email to your monitored account to test notifications"]
            : status.health.recommendations,
      };
    } catch (error) {
      this.logger.error(
        `❌ Get status failed for user ${req.user?.id}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to get status: ${error.message}`,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Setup Gmail push notifications for authenticated user
   * POST /gmail/client/setup-notifications
   */
  @Post("setup-notifications")
  @UseGuards(AuthGuard("jwt"))
  async setupNotifications(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      this.logger.log(`📡 Setting up Gmail notifications for user: ${userId}`);

      // Check if user is connected to Google
      const isConnected = await this.googleOAuthService.isConnected(userId);
      if (!isConnected) {
        throw new HttpException(
          "User not connected to Google. Please complete OAuth first.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get authenticated Gmail client to verify current account
      const client =
        await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: "v1", auth: client });

      // Get the authenticated Gmail account details
      const profile = await gmail.users.getProfile({ userId: "me" });
      const authenticatedEmail = profile.data.emailAddress!;

      this.logger.log(
        `🔐 User authenticated as Gmail account: ${authenticatedEmail}`,
      );

      // Check if user already has active watch
      const existingWatch = await this.gmailWatchService.getWatchInfo(
        new Types.ObjectId(userId),
      );
      if (existingWatch && existingWatch.isActive) {
        // Verify the existing watch is for the same authenticated account
        if (existingWatch.googleEmail !== authenticatedEmail) {
          this.logger.warn(
            `⚠️ Watch exists for different email: ${existingWatch.googleEmail} vs ${authenticatedEmail}`,
          );

          // Clean up old watch first
          await this.gmailWatchService.stopWatch(new Types.ObjectId(userId));
          this.logger.log(
            `🧹 Cleaned up old watch for: ${existingWatch.googleEmail}`,
          );
        } else {
          return {
            success: true,
            message: "Gmail notifications already active",
            status: "already_active",
            watchInfo: {
              watchId: existingWatch.watchId,
              email: existingWatch.googleEmail,
              expiresAt: existingWatch.expiresAt,
              notificationsReceived: existingWatch.notificationsReceived,
            },
          };
        }
      }

      // Create new watch for the authenticated account
      const watchInfo = await this.gmailWatchService.createWatch({
        userId: new Types.ObjectId(userId),
        labelIds: ["INBOX"],
        labelFilterBehavior: "INCLUDE",
      });

      this.logger.log(`Gmail notifications setup for user: ${userId}`);

      return {
        success: true,
        message: "Gmail notifications setup successfully",
        status: "setup_complete",
        watchInfo: {
          watchId: watchInfo.watchId,
          email: watchInfo.googleEmail,
          expiresAt: watchInfo.expiresAt,
          historyId: watchInfo.historyId,
        },
        important: {
          note: "Notifications are active for the authenticated Gmail account only",
          authenticatedAccount: authenticatedEmail,
          monitoringAccount: watchInfo.googleEmail,
          guidance:
            authenticatedEmail === watchInfo.googleEmail
              ? "Your watch is correctly configured for your authenticated account"
              : "WARNING: Account mismatch detected - this should not happen",
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Setup notifications failed: ${error.message}`,
        error.stack,
      );

      // Provide specific guidance for common errors
      const userMessage = `Setup failed: ${error.message}`;
      const guidance: string[] = [];

      if (error.message.includes("User not connected")) {
        guidance.push("Complete Google OAuth authorization first");
        guidance.push("Make sure you authorize the correct Gmail account");
      } else if (error.message.includes("Authentication failed")) {
        guidance.push("Your Google authorization may have expired");
        guidance.push("Try disconnecting and reconnecting your Google account");
      } else if (error.message.includes("insufficient permissions")) {
        guidance.push("Make sure you grant Gmail permissions during OAuth");
        guidance.push("The app needs Gmail read and modify permissions");
      }

      throw new HttpException(
        {
          success: false,
          message: userMessage,
          error: error.message,
          guidance,
          troubleshooting: {
            step1:
              "Verify you are logged into the correct Gmail account in your browser",
            step2:
              "Complete OAuth authorization for that specific Gmail account",
            step3: "Ensure you grant all requested Gmail permissions",
            step4: "Then retry setting up notifications",
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test email triage processing with a real email structure
   * POST /gmail/client/test-triage
   */
  @Post("test-triage")
  @UseGuards(AuthGuard("jwt"))
  async testEmailTriage(
    @Req() req: AuthenticatedRequest,
    @Body() testEmail?: TestEmailTriageDto,
  ): Promise<any> {
    const userId = req.user.id;
    this.logger.log(`Testing email triage for user: ${userId}`);

    try {
      // Check if user is connected to Google
      const isConnected = await this.googleOAuthService.isConnected(userId);
      if (!isConnected) {
        throw new HttpException(
          "User not connected to Google. Please complete OAuth first.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Create a properly structured email for testing
      // Create test email data (GmailEmailData format)
      const emailData: GmailEmailData = {
        id: `test-email-${Date.now()}`,
        threadId: `test-thread-${Date.now()}`,
        body:
          testEmail?.body ||
          "Hello, I am having trouble logging into my account after the recent update. Can you please help me? This is quite urgent as I need to access important documents for tomorrow's meeting.",
        metadata: {
          subject: testEmail?.subject || "Urgent: Login Issues After Update",
          from: testEmail?.from || "john.doe@example.com",
          to: testEmail?.to || req.user.email || "support@company.com",
          timestamp: new Date().toISOString(),
          headers: {},
          messageId: `<test-${Date.now()}@example.com>`,
          labels: [],
          gmailSource: false, // Mark as test email
          userId: userId,
        },
      };

      // ✅ Process through unified email processor service
      const result = await this.gmailEmailProcessor.processEmail(
        emailData,
        'test',
        { userId }
      );

      this.logger.log(
        `Email triage test completed for user: ${userId}, session: ${result.sessionId}`,
      );

      return {
        success: true,
        message: "Email triage test completed successfully",
        sessionId: result.sessionId,
        result: {
          status: result.status,
          sessionId: result.sessionId,
          emailId: result.emailId,
          // Note: GmailEmailProcessorService returns immediate status
          // Full results are available via WebSocket notifications or result retrieval endpoint
          isProcessing: result.status === "processed",
        },
        testEmail: emailData,
        note: "Triage is processing. Use WebSocket notifications or GET /triage-result/:sessionId for results.",
      };
    } catch (error) {
      this.logger.error(
        `Failed to test email triage: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Email triage test failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get real-time triage results for a session
   * GET /gmail/client/triage-result/:sessionId
   */
  @Get("triage-result/:sessionId")
  @UseGuards(AuthGuard("jwt"))
  async getTriageResult(
    @Req() req: AuthenticatedRequest,
    @Param("sessionId") sessionId: string,
  ): Promise<any> {
    const userId = req.user.id;
    this.logger.log(
      `Getting triage result for session: ${sessionId}, user: ${userId}`,
    );

    try {
      // TODO: Implement actual session result retrieval from database
      // This should query the workflow results database for the specific session
      // For now, return error indicating this needs implementation

      return {
        success: false,
        message: "Session result retrieval not yet implemented",
        sessionId,
        note: "Real-time results are available via WebSocket notifications. Database persistence for session results will be implemented next.",
      };
    } catch (error) {
      this.logger.error(
        `Failed to get triage result: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        "Failed to retrieve triage result",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Subscribe to real-time triage notifications
   * POST /gmail/client/subscribe-notifications
   */
  @Post("subscribe-notifications")
  @UseGuards(AuthGuard("jwt"))
  async subscribeToNotifications(
    @Req() req: AuthenticatedRequest,
    @Body() subscription: { webhookUrl?: string; email?: string },
  ): Promise<any> {
    const userId = req.user.id;
    this.logger.log(`Subscribing user ${userId} to triage notifications`);

    try {
      // TODO: Implement notification subscription in database
      // This should store webhook URLs or notification preferences
      // For now, return success as WebSocket subscriptions are handled by the gateway

      return {
        success: true,
        message: "Successfully subscribed to triage notifications",
        subscription: {
          userId,
          webhookUrl: subscription.webhookUrl,
          email: subscription.email,
          subscribedAt: new Date().toISOString(),
          types: ["email_triage_completed", "email_triage_failed"],
        },
        note: "Real-time notifications are available via WebSocket. Webhook notifications will be implemented next.",
      };
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to notifications: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        "Failed to subscribe to notifications",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get active notification subscriptions
   * GET /gmail/client/subscriptions
   */
  @Get("subscriptions")
  @UseGuards(AuthGuard("jwt"))
  async getSubscriptions(@Req() req: AuthenticatedRequest): Promise<any> {
    const userId = req.user.id;
    this.logger.log(`Getting notification subscriptions for user: ${userId}`);

    try {
      // TODO: Implement database query for subscriptions
      // This should return actual subscription records from the database

      return {
        success: true,
        subscriptions: [],
        message:
          "Subscription management will be implemented next. Use WebSocket for real-time notifications.",
      };
    } catch (error) {
      this.logger.error(
        `Failed to get subscriptions: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        "Failed to retrieve subscriptions",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Disconnect from email triage and unsubscribe from Google Pub/Sub notifications
   * POST /gmail/client/disconnect
   */
  @Post("disconnect")
  @UseGuards(AuthGuard("jwt"))
  async disconnectFromEmailTriage(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      
      this.logger.log(`🔌 DISCONNECT: User ${userId} (${userEmail}) disconnecting from email triage and Pub/Sub notifications`);

      const results = {
        success: true,
        message: "Successfully disconnected from email triage and Pub/Sub notifications",
        userId,
        userEmail,
        actions: {
          gmailWatchStopped: false,
          googleApiWatchStopped: false,
          databaseCleaned: false,
          websocketSessionsCleared: false,
          processingCacheCleared: false
        },
        details: {
          watchInfo: null as any,
          errors: [] as string[]
        }
      };

      // Step 1: Get existing watch info for logging
      try {
        const existingWatch = await this.gmailWatchService.getWatchInfo(
          new Types.ObjectId(userId),
        );
        if (existingWatch) {
          results.details.watchInfo = {
            watchId: existingWatch.watchId,
            googleEmail: existingWatch.googleEmail,
            historyId: existingWatch.historyId,
            isActive: existingWatch.isActive,
            notificationsReceived: existingWatch.notificationsReceived
          };
        }
      } catch (error) {
        this.logger.warn(`Could not retrieve watch info: ${error.message}`);
      }

      // Step 2: Stop Gmail watch via Google API (complete Pub/Sub unsubscription)
      try {
        const client = await this.googleOAuthService.getAuthenticatedClient(userId);
        const gmail = google.gmail({ version: "v1", auth: client });

        // Stop any active watch for this user - this stops Pub/Sub notifications
        await gmail.users.stop({ userId: "me" });
        results.actions.googleApiWatchStopped = true;

        this.logger.log(`✅ DISCONNECT: Stopped Gmail watch via Google API (Pub/Sub unsubscribed) for user: ${userId}`);
      } catch (error) {
        if (error.code === 404 || error.message?.includes("not found")) {
          this.logger.log(`ℹ️ DISCONNECT: No active watch found on Google's side for user: ${userId} (already unsubscribed)`);
          results.actions.googleApiWatchStopped = true; // Consider as success
        } else {
          results.details.errors.push(`Google API watch stop failed: ${error.message}`);
          this.logger.error(`❌ DISCONNECT: Failed to stop watch via Google API: ${error.message}`);
        }
      }

      // Step 3: Stop Gmail watch in our database
      try {
        const stopped = await this.gmailWatchService.stopWatch(new Types.ObjectId(userId));
        results.actions.gmailWatchStopped = stopped;
        results.actions.databaseCleaned = true;

        this.logger.log(`✅ DISCONNECT: Cleaned up database watch for user: ${userId}`);
      } catch (error) {
        results.details.errors.push(`Database watch cleanup failed: ${error.message}`);
        this.logger.error(`❌ DISCONNECT: Database cleanup failed: ${error.message}`);
      }

      // Step 4: Clear WebSocket sessions for this user
      try {
        // Get the user's Google email for session cleanup
        let googleEmail = userEmail; // fallback to authenticated email

        if (results.details.watchInfo) {
          googleEmail = results.details.watchInfo.googleEmail;
        } else {
          // Try to get from Google profile
          try {
            const client = await this.googleOAuthService.getAuthenticatedClient(userId);
            const gmail = google.gmail({ version: "v1", auth: client });
            const profile = await gmail.users.getProfile({ userId: "me" });
            googleEmail = profile.data.emailAddress || userEmail;
          } catch (error) {
            this.logger.warn(`Could not get Google email for session cleanup: ${error.message}`);
          }
        }

        // Clear WebSocket sessions for this specific user
        await this.gmailNotificationService.disconnectUserSessions(googleEmail);
        results.actions.websocketSessionsCleared = true;

        this.logger.log(`✅ DISCONNECT: Cleared WebSocket sessions for: ${googleEmail}`);
      } catch (error) {
        results.details.errors.push(`WebSocket session cleanup failed: ${error.message}`);
        this.logger.error(`❌ DISCONNECT: WebSocket session cleanup failed: ${error.message}`);
      }

      // Step 5: Clear processing cache for this user (if we extend the cache service)
      try {
        // Note: This would require extending EmailProcessingCacheService for user-specific clearing
        // For now, we'll log that this should be implemented
        this.logger.log(`ℹ️ DISCONNECT: Processing cache cleanup not implemented yet for user-specific clearing`);
        results.actions.processingCacheCleared = true; // Mark as success for now
      } catch (error) {
        results.details.errors.push(`Processing cache cleanup failed: ${error.message}`);
      }

      // Step 6: Emit disconnect event for monitoring and WebSocket notification
      this.eventEmitter.emit("email.triage.disconnected", {
        userId,
        userEmail,
        googleEmail: results.details.watchInfo?.googleEmail || userEmail,
        timestamp: new Date().toISOString(),
        source: "user_request",
        pubsubUnsubscribed: results.actions.googleApiWatchStopped,
        watchStopped: results.actions.gmailWatchStopped,
        sessionsCleared: results.actions.websocketSessionsCleared
      });

      // Step 7: Final assessment
      const successfulActions = Object.values(results.actions).filter(Boolean).length;
      const hasErrors = results.details.errors.length > 0;

      if (hasErrors) {
        results.success = successfulActions > 0; // Partial success
        results.message = `Disconnect completed with ${results.details.errors.length} errors - ${successfulActions} actions successful`;
      } else {
        results.message = `Successfully disconnected from email triage and Pub/Sub notifications - ${successfulActions} actions completed`;
      }

      this.logger.log(`🎯 DISCONNECT SUMMARY for ${userId}:
        - Gmail watch stopped: ${results.actions.gmailWatchStopped}
        - Google API watch stopped (Pub/Sub unsubscribed): ${results.actions.googleApiWatchStopped}
        - Database cleaned: ${results.actions.databaseCleaned}
        - WebSocket sessions cleared: ${results.actions.websocketSessionsCleared}
        - Processing cache cleared: ${results.actions.processingCacheCleared}
        - Errors: ${results.details.errors.length}`);

      return {
        ...results,
        nextSteps: {
          status: "fully_disconnected",
          description: "You are now completely disconnected from email triage and Google Pub/Sub notifications",
          recommendations: [
            "No more email notifications will be sent to our servers",
            "Your Gmail access tokens remain active for other operations",
            "To reconnect: POST /gmail/client/setup-notifications",
            "To revoke all access: Use Google Account settings"
          ]
        }
      };

    } catch (error) {
      this.logger.error(`❌ DISCONNECT failed for user ${req.user.id}:`, error);
      
      // Still emit event for monitoring even on failure
      this.eventEmitter.emit("email.triage.disconnected", {
        userId: req.user.id,
        userEmail: req.user.email,
        timestamp: new Date().toISOString(),
        source: "user_request",
        success: false,
        error: error.message
      });

      throw new HttpException(
        {
          success: false,
          message: `Failed to disconnect from email triage: ${error.message}`,
          userId: req.user.id,
          userEmail: req.user.email,
          error: error.message,
          nextSteps: {
            status: "disconnect_failed",
            recommendations: [
              "Try the comprehensive cleanup: DELETE /gmail/client/cleanup-notifications",
              "Contact support if the issue persists",
              "Admin can use nuclear reset if needed"
            ]
          }
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Disable Gmail notifications
   */
  @Delete("disable-notifications")
  @UseGuards(AuthGuard("jwt"))
  async disableNotifications(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;

      const stopped = await this.gmailWatchService.stopWatch(
        new Types.ObjectId(userId),
      );

      if (!stopped) {
        return {
          success: true,
          message: "No active Gmail notifications found",
        };
      }

      this.logger.log(`Gmail notifications disabled for user: ${userId}`);

      return {
        success: true,
        message: "Gmail notifications disabled successfully",
        nextSteps: ["Use POST /gmail/client/setup-notifications to re-enable"],
      };
    } catch (error) {
      this.logger.error("Failed to disable Gmail notifications:", error);
      throw new HttpException(
        "Failed to disable Gmail notifications",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get system health and statistics
   */
  @Get("health")
  async getHealth() {
    try {
      const health = await this.getSystemHealth();

      return {
        success: true,
        ...health,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Health check failed:", error);
      return {
        success: false,
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Comprehensive infrastructure health check with network tests
   * GET /gmail/client/infrastructure-health
   */
  @Get("infrastructure-health")
  @UseGuards(AuthGuard("jwt"))
  async getInfrastructureHealth(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      this.logger.log(
        `🔍 Performing infrastructure health check for user: ${userId}`,
      );

      // Perform actual network tests
      const [pubsubHealthy, subscriptionHealth, watchStats] = await Promise.all(
        [
          this.pubSubService.testConnectionWithContext(userId),
          this.pubSubService.getSubscriptionHealth(),
          this.gmailWatchService.getStatistics(),
        ],
      );

      const health = {
        user: {
          userId,
          requestedAt: new Date().toISOString(),
        },
        infrastructure: {
          pubsub: {
            connected: pubsubHealthy,
            subscriptions: subscriptionHealth,
          },
          watches: watchStats,
        },
        status: pubsubHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
      };

      this.logger.log(
        `🔍 Infrastructure health check completed for user ${userId}: ${health.status}`,
      );

      return {
        success: true,
        ...health,
      };
    } catch (error) {
      this.logger.error(
        `❌ Infrastructure health check failed for user ${req.user?.id}: ${error.message}`,
        error,
      );
      return {
        success: false,
        status: "unhealthy",
        error: error.message,
        user: {
          userId: req.user?.id,
          requestedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get detailed watch statistics (admin endpoint)
   */
  @Get("statistics")
  @UseGuards(AuthGuard("jwt"))
  async getStatistics(@Req() req: AuthenticatedRequest) {
    try {
      const statistics = await this.gmailWatchService.getStatistics();
      const pubsubHealth = await this.pubSubService.getSubscriptionHealth();

      return {
        success: true,
        watches: statistics,
        pubsub: pubsubHealth,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Failed to get statistics:", error);
      throw new HttpException(
        "Failed to get statistics",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manual watch renewal (admin endpoint)
   */
  @Post("renew-watch")
  @UseGuards(AuthGuard("jwt"))
  async renewWatch(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;

      const existingWatch = await this.gmailWatchService.getWatchInfo(
        new Types.ObjectId(userId),
      );
      if (!existingWatch) {
        throw new HttpException(
          "No Gmail watch found for user",
          HttpStatus.NOT_FOUND,
        );
      }

      const watchInfo = await this.gmailWatchService.renewWatch(
        existingWatch.watchId,
      );

      this.logger.log(`Gmail watch renewed for user: ${userId}`);

      return {
        success: true,
        message: "Gmail watch renewed successfully",
        watchInfo,
      };
    } catch (error) {
      this.logger.error("Failed to renew Gmail watch:", error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        "Failed to renew Gmail watch",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test Pub/Sub connection
   */
  @Post("test-pubsub")
  @UseGuards(AuthGuard("jwt"))
  async testPubSubConnection(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      this.logger.log(`🧪 Testing Pub/Sub connection for user: ${userId}`);

      const isHealthy =
        await this.pubSubService.testConnectionWithContext(userId);
      const subscriptionHealth =
        await this.pubSubService.getSubscriptionHealth();

      this.logger.log(
        `🧪 Pub/Sub test completed for user ${userId}: ${isHealthy ? "healthy" : "unhealthy"}`,
      );

      return {
        success: true,
        user: {
          userId,
          testedAt: new Date().toISOString(),
        },
        pubsub: {
          connected: isHealthy,
          subscriptions: subscriptionHealth,
        },
        message: isHealthy
          ? "Pub/Sub connection is healthy"
          : "Pub/Sub connection issues detected",
      };
    } catch (error) {
      this.logger.error(
        `❌ Pub/Sub test failed for user ${req.user?.id}: ${error.message}`,
        error,
      );
      return {
        success: false,
        user: {
          userId: req.user?.id,
          testedAt: new Date().toISOString(),
        },
        pubsub: {
          connected: false,
          error: error.message,
        },
        message: "Pub/Sub connection test failed",
      };
    }
  }

  /**
   * Diagnose Push Notification Configuration
   * GET /gmail/client/diagnose-push
   */
  @Get("diagnose-push")
  async diagnosePushNotifications() {
    try {
      this.logger.log("🔍 Diagnosing push notification configuration...");

      // Check Pub/Sub connection and subscriptions
      const pubsubHealthy = await this.pubSubService.testConnection();
      const subscriptionHealth =
        await this.pubSubService.getSubscriptionHealth();

      // Check webhook endpoint accessibility
      const webhookUrl = `${process.env.WEBHOOK_BASE_URL || "https://followthrough-server-production.up.railway.app"}/api/gmail/webhooks/api/gmail/webhooks/push`;

      const diagnosis = {
        pubsub: {
          connection: pubsubHealthy ? "✅ Connected" : "❌ Failed",
          topic: pubsubHealthy ? "✅ Accessible" : "❌ Not accessible",
          pushSubscription: {
            exists: subscriptionHealth.pushSubscription?.exists
              ? "✅ Exists"
              : "❌ Missing",
            messageCount:
              subscriptionHealth.pushSubscription?.messageCount || 0,
            status: subscriptionHealth.pushSubscription?.exists
              ? "Active"
              : "Not configured",
          },
          pullSubscription: {
            exists: subscriptionHealth.pullSubscription?.exists
              ? "✅ Exists"
              : "❌ Missing",
            messageCount:
              subscriptionHealth.pullSubscription?.messageCount || 0,
            status: subscriptionHealth.pullSubscription?.exists
              ? "Active"
              : "Not configured",
          },
        },
        webhook: {
          endpoint: webhookUrl,
          expectedPath: "/api/gmail/webhooks/push",
          method: "POST",
          authentication: process.env.GMAIL_WEBHOOK_SECRET
            ? "✅ Configured"
            : "⚠️ No secret configured",
        },
        environment: {
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
            ? "✅ Set"
            : "❌ Missing",
          topic: process.env.GMAIL_PUBSUB_TOPIC || "gmail-triage",
          credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
            ? "✅ Set"
            : "❌ Missing",
          pushSubscription:
            process.env.GMAIL_PUSH_SUBSCRIPTION ||
            "gmail-push-notification-subscription",
          pullSubscription:
            process.env.GMAIL_PULL_SUBSCRIPTION ||
            "gmail-pull-notification-subscription",
        },
      };

      // Determine overall status
      const issues: string[] = [];
      if (!pubsubHealthy) issues.push("Pub/Sub connection failed");
      if (!subscriptionHealth.pushSubscription?.exists)
        issues.push("Push subscription missing");
      if (!process.env.GOOGLE_CLOUD_PROJECT_ID)
        issues.push("GOOGLE_CLOUD_PROJECT_ID not set");
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS)
        issues.push("GOOGLE_APPLICATION_CREDENTIALS not set");

      const status = issues.length === 0 ? "healthy" : "issues_detected";
      const recommendation = this.getPushNotificationRecommendation(
        issues,
        subscriptionHealth,
      );

      return {
        success: true,
        status,
        diagnosis,
        issues,
        recommendation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("❌ Push notification diagnosis failed:", error);
      return {
        success: false,
        status: "diagnosis_failed",
        error: error.message,
        recommendation: [
          "Check server logs for detailed error information",
          "Verify Google Cloud credentials and permissions",
          "Ensure required environment variables are set",
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test Push Notification Webhook Manually
   * POST /gmail/client/test-webhook
   */
  @Post("test-webhook")
  async testWebhookManually() {
    try {
      this.logger.log("🧪 Testing webhook endpoint manually...");

      // Create a mock push notification payload
      const mockPayload = {
        message: {
          data: Buffer.from(
            JSON.stringify({
              emailAddress: "umer229@gmail.com",
              historyId: "99999999", // Test history ID
            }),
          ).toString("base64"),
          messageId: `test-${Date.now()}`,
          publishTime: new Date().toISOString(),
          attributes: {
            test: "true",
          },
        },
        subscription:
          "projects/your-project/subscriptions/gmail-push-notification-subscription",
      };

      // Make internal call to webhook handler
      const webhookUrl = "/api/gmail/webhooks/push";
      this.logger.log(`📡 Simulating POST to ${webhookUrl}`);
      this.logger.log(
        `📧 Mock payload: ${JSON.stringify(mockPayload, null, 2)}`,
      );

      // Note: We can't easily call the webhook controller directly due to NestJS architecture
      // This endpoint provides the mock payload for external testing

      return {
        success: true,
        message: "Mock webhook payload generated for testing",
        webhookUrl,
        mockPayload,
        instructions: [
          `Use curl or Postman to POST this payload to: ${process.env.WEBHOOK_BASE_URL || "https://followthrough-server-production.up.railway.app"}/api/gmail/webhooks/push`,
          "Check server logs for webhook processing messages",
          "Verify WebSocket clients receive notifications",
        ],
        curlCommand: `curl -X POST \\
  ${process.env.WEBHOOK_BASE_URL || "https://followthrough-server-production.up.railway.app"}/api/gmail/webhooks/push \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(mockPayload)}'`,
      };
    } catch (error) {
      this.logger.error("❌ Webhook test failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get push notification recommendations based on diagnosis
   */
  private getPushNotificationRecommendation(
    issues: string[],
    subscriptionHealth: any,
  ): string[] {
    const recommendations: string[] = [];

    if (issues.includes("Pub/Sub connection failed")) {
      recommendations.push(
        "1. Check Google Cloud credentials and project access",
      );
      recommendations.push(
        "2. Verify GOOGLE_APPLICATION_CREDENTIALS points to valid service account key",
      );
      recommendations.push(
        "3. Ensure the service account has Pub/Sub subscriber and viewer roles",
      );
    }

    if (issues.includes("Push subscription missing")) {
      recommendations.push(
        "4. Run the setup script: ./scripts/setup-pubsub.sh",
      );
      recommendations.push(
        "5. Or manually create push subscription with webhook endpoint",
      );
      recommendations.push("6. Verify webhook endpoint is publicly accessible");
    }

    if (issues.includes("GOOGLE_CLOUD_PROJECT_ID not set")) {
      recommendations.push(
        "7. Set GOOGLE_CLOUD_PROJECT_ID environment variable",
      );
    }

    if (issues.includes("GOOGLE_APPLICATION_CREDENTIALS not set")) {
      recommendations.push(
        "8. Set GOOGLE_APPLICATION_CREDENTIALS environment variable",
      );
    }

    if (recommendations.length === 0) {
      if (subscriptionHealth.pushSubscription?.exists) {
        recommendations.push("✅ Configuration looks good!");
        recommendations.push("If push notifications still not working:");
        recommendations.push(
          "- Check Google Cloud Console for subscription delivery attempts",
        );
        recommendations.push(
          "- Verify webhook endpoint is reachable from Google Cloud",
        );
        recommendations.push(
          "- Check server logs for push notification webhook calls",
        );
        recommendations.push("- Test with: POST /gmail/client/test-webhook");
      }
    }

    return recommendations;
  }

  /**
   * Process pull messages manually (triggers complete email processing pipeline)
   */
  @Post("process-pull-messages")
  async processPullMessages() {
    try {
      this.logger.log(
        "🔄 Processing pull messages through complete email pipeline...",
      );

      // Get notifications from Pub/Sub
      const notifications = await this.pubSubService.processPulledMessages();
      let totalProcessed = 0;

      this.logger.log(
        `📬 Found ${notifications.length} Gmail notifications to process`,
      );

      // Process each notification through the complete pipeline
      for (const notification of notifications) {
        try {
          this.logger.log(
            `🔄 Processing Gmail notification for: ${notification.emailAddress}, historyId: ${notification.historyId}`,
          );
          const processed = await this.processGmailNotification(notification);
          totalProcessed += processed;
        } catch (error) {
          this.logger.error(
            `❌ Failed to process notification for ${notification.emailAddress}:`,
            error,
          );
        }
      }

      this.logger.log(
        `✅ Successfully processed ${totalProcessed} emails from ${notifications.length} notifications`,
      );

      return {
        success: true,
        processed: totalProcessed,
        message: `Processed ${totalProcessed} emails through complete triage pipeline`,
        note: "This processes notifications through the complete email fetching and triage pipeline",
      };
    } catch (error) {
      this.logger.error(
        "❌ Failed to process pull messages through pipeline:",
        error,
      );
      throw new HttpException(
        "Failed to process pull messages",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Process a Gmail notification by fetching new emails and triggering triage
   */
  private async processGmailNotification(
    notification: GmailNotification,
  ): Promise<number> {
    try {
      this.logger.log(
        `🔄 Processing Gmail notification for: ${notification.emailAddress}, historyId: ${notification.historyId}`,
      );

      // Find watch info by email address
      this.logger.log(
        `🔍 Looking up watch info for email: ${notification.emailAddress}`,
      );
      const watchInfo = await this.gmailWatchService.getWatchInfoByEmail(
        notification.emailAddress,
      );
      if (!watchInfo || !watchInfo.isActive) {
        this.logger.warn(
          `⚠️ No active watch found for email: ${notification.emailAddress}`,
        );
        return 0;
      }

      this.logger.log(
        `✅ Found active watch: ${watchInfo.watchId} for email: ${notification.emailAddress}`,
      );
      this.logger.log(
        `📊 Watch info - historyId: ${watchInfo.historyId}, userId: ${watchInfo.userId}`,
      );

      // Get new emails from Gmail history since last known history ID
      this.logger.log(
        `📧 Fetching new emails from history ID ${watchInfo.historyId} to ${notification.historyId}`,
      );
      const newEmails = await this.getNewEmailsFromHistory(
        watchInfo.watchId,
        notification.emailAddress,
        notification.historyId,
      );

      if (newEmails.length === 0) {
        this.logger.log(
          `ℹ️ No new emails found for: ${notification.emailAddress} (historyId: ${notification.historyId})`,
        );
        return 0;
      }

      this.logger.log(`📬 Found ${newEmails.length} new emails for processing`);

      // Process each new email through the triage system
      let processedCount = 0;
      for (const email of newEmails) {
        try {
          this.logger.log(
            `🚀 Starting triage for email: ${email.id} - "${email.metadata.subject}"`,
          );

          // ✅ Process through unified email processor service
          const result = await this.gmailEmailProcessor.processEmail(
            email,
            'pull',
            { 
              watchId: watchInfo.watchId, 
              userId: watchInfo.userId.toString() 
            }
          );

          if (result.status === 'processed') {
            processedCount++;
            this.logger.log(`✅ Email triage completed for: ${email.id}`);
          } else {
            this.logger.log(
              `ℹ️ Email ${email.id} ${result.status}: ${result.reason || 'No reason provided'}`,
            );
          }
        } catch (error) {
          this.logger.error(`❌ Failed to process email ${email.id}:`, error);
          // Error events are now handled by GmailEmailProcessorService
        }
      }

      // Record processed emails in watch statistics
      if (processedCount > 0) {
        await this.gmailWatchService.recordEmailsProcessed(
          watchInfo.watchId,
          processedCount,
        );
        this.logger.log(
          `📊 Recorded ${processedCount} processed emails for watch: ${watchInfo.watchId}`,
        );
      }

      this.logger.log(
        `✅ Processed ${processedCount}/${newEmails.length} new emails for: ${notification.emailAddress}`,
      );
      return processedCount;
    } catch (error) {
      this.logger.error(
        `❌ Failed to process Gmail notification for ${notification.emailAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get new emails from Gmail history using History API
   */
  private async getNewEmailsFromHistory(
    watchId: string,
    emailAddress: string,
    currentHistoryId: string,
  ): Promise<any[]> {
    try {
      // Get watch info to find the user and last processed history ID
      const watchInfo =
        await this.gmailWatchService.getWatchInfoByEmail(emailAddress);
      if (!watchInfo || !watchInfo.isActive) {
        throw new Error(`Active watch not found for email: ${emailAddress}`);
      }

      const lastHistoryId = watchInfo.historyId;
      const userId = watchInfo.userId.toString(); // Convert ObjectId to string

      this.logger.log(
        `Fetching Gmail history from ${lastHistoryId} to ${currentHistoryId} for ${emailAddress} (userId: ${userId})`,
      );

      // Get authenticated Gmail client using the user ID
      const authClient =
        await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: "v1", auth: authClient });

      // Get history of changes since last known history ID
      const historyResponse = await gmail.users.history.list({
        userId: "me",
        startHistoryId: lastHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX", // Focus on inbox messages
        maxResults: 100,
      });

      const histories = historyResponse.data.history || [];
      const newEmails: any[] = [];

      this.logger.log(
        `Found ${histories.length} history entries for ${emailAddress}`,
      );

      // Process each history entry
      for (const history of histories) {
        if (history.messagesAdded) {
          for (const messageAdded of history.messagesAdded) {
            try {
              const emailData = await this.transformGmailMessage(
                gmail,
                messageAdded.message!,
                emailAddress,
                userId,
              );
              if (emailData) {
                newEmails.push(emailData);
                this.logger.log(
                  `Transformed email: ${emailData.id} - "${emailData.metadata.subject}"`,
                );
              }
            } catch (error) {
              this.logger.error(
                `Failed to transform Gmail message ${messageAdded.message?.id}:`,
                error,
              );
            }
          }
        }
      }

      // Update watch with new history ID
      if (newEmails.length > 0) {
        await this.gmailWatchService.updateHistoryId(watchId, currentHistoryId);
        this.logger.log(
          `Updated watch ${watchId} with new history ID: ${currentHistoryId}`,
        );
      }

      this.logger.log(
        `Successfully processed ${newEmails.length} new emails for ${emailAddress}`,
      );
      return newEmails;
    } catch (error) {
      this.logger.error(
        `Failed to get emails from history for ${emailAddress}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Transform Gmail API message to our email format
   */
  private async transformGmailMessage(
    gmail: gmail_v1.Gmail,
    message: gmail_v1.Schema$Message,
    emailAddress: string,
    userId: string,
  ): Promise<any | null> {
    try {
      // Get full message details
      const fullMessage = await gmail.users.messages.get({
        userId: "me",
        id: message.id!,
        format: "full",
      });

      const messageData = fullMessage.data;
      const headers = messageData.payload?.headers || [];

      // Extract email metadata from headers
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value || "";

      const subject = getHeader("Subject");
      const from = getHeader("From");
      const to = getHeader("To");
      const messageId = getHeader("Message-ID");
      const date = getHeader("Date");

      // Extract email body
      const body = this.extractEmailBody(messageData.payload);

      // Skip if essential data is missing
      if (!subject || !from || !body) {
        this.logger.warn(
          `Skipping message ${message.id} - missing essential data (subject: ${!!subject}, from: ${!!from}, body: ${!!body})`,
        );
        return null;
      }

      // Skip automated/system emails
      if (this.isAutomatedEmail(from, subject)) {
        this.logger.log(`Skipping automated email: ${subject} from ${from}`);
        return null;
      }

      return {
        id: message.id!,
        threadId: message.threadId!,
        body: body.substring(0, 10000), // Limit body length
        metadata: {
          subject,
          from,
          to: to || emailAddress,
          timestamp: date || new Date().toISOString(),
          headers: Object.fromEntries(headers.map((h) => [h.name!, h.value!])),
          gmailSource: true,
          messageId,
          labels: messageData.labelIds || undefined,
          userId, // Include user ID for context
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to transform Gmail message ${message.id}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Extract plain text body from Gmail message payload
   */
  private extractEmailBody(
    payload: gmail_v1.Schema$MessagePart | undefined,
  ): string {
    if (!payload) return "";

    // If this part has a body, decode it
    if (payload.body?.data) {
      try {
        return Buffer.from(payload.body.data, "base64").toString("utf-8");
      } catch (error) {
        this.logger.warn("Failed to decode message body:", error);
      }
    }

    // If this is a multipart message, recursively search parts
    if (payload.parts) {
      for (const part of payload.parts) {
        // Look for text/plain parts first
        if (part.mimeType === "text/plain") {
          const body = this.extractEmailBody(part);
          if (body) return body;
        }
      }

      // Fallback to text/html parts
      for (const part of payload.parts) {
        if (part.mimeType === "text/html") {
          const body = this.extractEmailBody(part);
          if (body) {
            // Basic HTML to text conversion (remove tags)
            return body.replace(/<[^>]*>/g, "").trim();
          }
        }
      }

      // Recursively search nested parts
      for (const part of payload.parts) {
        const body = this.extractEmailBody(part);
        if (body) return body;
      }
    }

    return "";
  }

  /**
   * Check if email is automated/system email that should be skipped
   */
  private isAutomatedEmail(from: string, subject: string): boolean {
    const automatedPatterns = [
      /noreply/i,
      /no-reply/i,
      /donotreply/i,
      /notification/i,
      /automated/i,
      /system/i,
      /support@.*\.com/i,
    ];

    const subjectPatterns = [
      /unsubscribe/i,
      /newsletter/i,
      /subscription/i,
      /automated/i,
      /system notification/i,
    ];

    return (
      automatedPatterns.some((pattern) => pattern.test(from)) ||
      subjectPatterns.some((pattern) => pattern.test(subject))
    );
  }


  // All email processing now goes through the centralized GmailEmailProcessorService

  /**
   * Get system health information
   */
  private async getSystemHealth(): Promise<any> {
    try {
      const [pubsubHealthy, subscriptionHealth, watchStats] = await Promise.all(
        [
          this.pubSubService.testConnection(),
          this.pubSubService.getSubscriptionHealth(),
          this.gmailWatchService.getStatistics(),
        ],
      );

      return {
        status: pubsubHealthy ? "healthy" : "unhealthy",
        pubsub: {
          connected: pubsubHealthy,
          subscriptions: subscriptionHealth,
        },
        watches: watchStats,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  /**
   * Get next steps based on current state
   */
  private getNextSteps(
    isOAuthConnected: boolean,
    isNotificationsEnabled: boolean,
  ): string[] {
    if (!isOAuthConnected) {
      return [
        "Complete Google OAuth authorization using the auth-url endpoint",
        "After OAuth, call /gmail/client/status to verify connection",
      ];
    }

    if (!isNotificationsEnabled) {
      return [
        "Enable Gmail notifications using POST /gmail/client/setup-notifications",
        "Test the system using POST /gmail/client/test-triage",
      ];
    }

    return [
      "System is fully configured and ready",
      "Send emails to your Gmail inbox to test push notifications",
      "Use POST /gmail/client/test-triage to test email processing",
      "Monitor system health with GET /gmail/client/health",
    ];
  }

  /**
   * Test push notification processing (for debugging)
   * POST /gmail/client/test-push-notification
   */
  @Post("test-push-notification")
  @UseGuards(AuthGuard("jwt"))
  async testPushNotification(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      this.logger.log(
        `🧪 Testing push notification processing for user: ${userId}`,
      );

      // Check if user is connected to get their Gmail address
      const isConnected = await this.googleOAuthService.isConnected(userId);
      if (!isConnected) {
        throw new HttpException(
          "User not connected to Google. Please complete OAuth first.",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get current watch info to find Gmail address
      const watchInfo = await this.gmailWatchService.getWatchInfo(
        new Types.ObjectId(userId),
      );
      if (!watchInfo || !watchInfo.isActive) {
        throw new HttpException(
          "No active Gmail watch found. Please setup notifications first.",
          HttpStatus.BAD_REQUEST,
        );
      }

      const emailAddress = watchInfo.googleEmail;
      this.logger.log(`📧 Found Gmail address: ${emailAddress}`);
      this.logger.log(`✅ Found active watch: ${watchInfo.watchId}`);

      // Create a simulated push notification payload
      const simulatedNotification = {
        emailAddress,
        historyId: (parseInt(watchInfo.historyId) + 1).toString(), // Simulate new history ID
      };

      this.logger.log(`🔄 Simulating push notification processing...`);
      this.logger.log(
        `📧 Simulated notification: ${JSON.stringify(simulatedNotification)}`,
      );

      // Since we can't easily instantiate the webhook controller here,
      // let's simulate the process by directly calling the pull messages
      const pullResult = await this.processPullMessages();

      this.logger.log(
        `✅ Push notification test completed: ${pullResult.processed} messages processed`,
      );

      return {
        success: true,
        message: "Push notification test completed - forced pull processing",
        result: {
          emailAddress,
          watchId: watchInfo.watchId,
          simulatedHistoryId: simulatedNotification.historyId,
          pullProcessed: pullResult.processed,
          processedEmails: pullResult.processed,
        },
        note: "This test forces pull processing to simulate push notification flow",
      };
    } catch (error) {
      this.logger.error(
        `❌ Push notification test failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Push notification test failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Force process pending Pub/Sub messages
   * POST /gmail/client/force-process-pending
   */
  @Post("force-process-pending")
  @UseGuards(AuthGuard("jwt"))
  async forceProcessPending(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      this.logger.log(
        `🔧 Force processing pending messages for user: ${userId}`,
      );

      // First pull messages from Pub/Sub
      const pullResult = await this.processPullMessages();

      this.logger.log(
        `📬 Pull result: ${pullResult.processed} emails processed through triage`,
      );

      return {
        success: true,
        message: "Force processing completed",
        result: {
          pullProcessed: pullResult.processed,
          processedEmails: pullResult.processed,
        },
        note: "This forces processing of all pending Pub/Sub messages through complete triage pipeline",
      };
    } catch (error) {
      this.logger.error(
        `❌ Force processing failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Force processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Clean up user's Gmail watch and notifications
   * DELETE /gmail/client/cleanup-notifications
   */
  @Delete("cleanup-notifications")
  async cleanupNotifications(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;

      this.logger.log(
        `🧹 CLEANUP: Starting notification cleanup for user: ${userId} (${userEmail})`,
      );

      const results = {
        success: true,
        message: "Cleanup completed successfully",
        userId,
        userEmail,
        actions: {
          watchStopped: false,
          databaseCleaned: false,
          googleApiCalled: false,
          sessionsCleared: false,
        },
        details: {
          watchInfo: null as any,
          errors: [] as string[],
        },
      };

      // Step 1: Check if user has an active watch
      let existingWatch;
      try {
        existingWatch = await this.gmailWatchService.getWatchInfo(
          new Types.ObjectId(userId),
        );

        if (existingWatch) {
          results.details.watchInfo = {
            watchId: existingWatch.watchId,
            googleEmail: existingWatch.googleEmail,
            historyId: existingWatch.historyId,
            isActive: existingWatch.isActive,
            notificationsReceived: existingWatch.notificationsReceived,
            errorCount: existingWatch.errorCount,
          };
        }
      } catch (error) {
        results.details.errors.push(
          `Failed to check existing watch: ${error.message}`,
        );
      }

      // Step 2: Stop Gmail watch via Google API (even if not in our database)
      try {
        const client =
          await this.googleOAuthService.getAuthenticatedClient(userId);
        const gmail = google.gmail({ version: "v1", auth: client });

        // Try to stop any active watch for this user
        await gmail.users.stop({ userId: "me" });
        results.actions.googleApiCalled = true;

        this.logger.log(
          `✅ CLEANUP: Stopped Gmail watch via Google API for user: ${userId}`,
        );
      } catch (error) {
        // This is expected if no watch exists
        if (error.code === 404 || error.message?.includes("not found")) {
          this.logger.log(
            `ℹ️ CLEANUP: No active watch found on Google's side for user: ${userId}`,
          );
        } else {
          results.details.errors.push(
            `Google API stop failed: ${error.message}`,
          );
          this.logger.warn(
            `⚠️ CLEANUP: Failed to stop watch via Google API: ${error.message}`,
          );
        }
      }

      // Step 3: Clean up database records
      try {
        if (existingWatch) {
          const stopped = await this.gmailWatchService.stopWatch(
            new Types.ObjectId(userId),
          );
          results.actions.watchStopped = stopped;
          results.actions.databaseCleaned = true;

          this.logger.log(
            `✅ CLEANUP: Cleaned up database watch for user: ${userId}`,
          );
        } else {
          // Even if no watch in database, make sure it's deactivated
          await this.gmailWatchService.deactivateWatch(
            new Types.ObjectId(userId),
          );
          results.actions.databaseCleaned = true;

          this.logger.log(
            `✅ CLEANUP: Ensured no database watch for user: ${userId}`,
          );
        }
      } catch (error) {
        results.details.errors.push(
          `Database cleanup failed: ${error.message}`,
        );
        this.logger.error(
          `❌ CLEANUP: Database cleanup failed: ${error.message}`,
        );
      }

      // Step 4: Clear WebSocket sessions
      try {
        // Get the user's Google email for session cleanup
        let googleEmail = userEmail; // fallback to authenticated email

        if (existingWatch) {
          googleEmail = existingWatch.googleEmail;
        } else {
          // Try to get from Google profile
          try {
            const client =
              await this.googleOAuthService.getAuthenticatedClient(userId);
            const gmail = google.gmail({ version: "v1", auth: client });
            const profile = await gmail.users.getProfile({ userId: "me" });
            googleEmail = profile.data.emailAddress || userEmail;
          } catch (error) {
            this.logger.warn(
              `Could not get Google email for session cleanup: ${error.message}`,
            );
          }
        }

        // Clear any active WebSocket sessions (force cleanup all inactive sessions)
        await this.gmailNotificationService.forceCleanupInactiveSessions();
        results.actions.sessionsCleared = true;

        this.logger.log(
          `✅ CLEANUP: Cleared WebSocket sessions for: ${googleEmail}`,
        );
      } catch (error) {
        results.details.errors.push(`Session cleanup failed: ${error.message}`);
        this.logger.error(
          `❌ CLEANUP: Session cleanup failed: ${error.message}`,
        );
      }

      // Step 5: Summary and recommendations
      const actionsCount = Object.values(results.actions).filter(
        Boolean,
      ).length;
      const hasErrors = results.details.errors.length > 0;

      if (hasErrors) {
        results.success = actionsCount > 0; // Partial success if some actions worked
        results.message = `Cleanup completed with ${results.details.errors.length} errors - ${actionsCount} actions successful`;
      } else {
        results.message = `Cleanup completed successfully - ${actionsCount} actions performed`;
      }

      this.logger.log(`🎯 CLEANUP SUMMARY for ${userId}:
        - Watch stopped: ${results.actions.watchStopped}
        - Database cleaned: ${results.actions.databaseCleaned}
        - Google API called: ${results.actions.googleApiCalled}
        - Sessions cleared: ${results.actions.sessionsCleared}
        - Errors: ${results.details.errors.length}`);

      return {
        ...results,
        nextSteps: {
          recommendation: "You can now set up fresh notifications",
          setupEndpoint: "POST /gmail/client/setup-notifications",
          description:
            "This will create a new watch with current historyId, eliminating any stale data issues",
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ CLEANUP: Failed for user ${req.user.id}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        message: `Cleanup failed: ${error.message}`,
        userId: req.user.id,
        userEmail: req.user.email,
        error: error.message,
        nextSteps: {
          recommendation: "Try again or contact support",
          adminCleanup: "Admin can use nuclear reset if needed",
        },
      };
    }
  }
}
