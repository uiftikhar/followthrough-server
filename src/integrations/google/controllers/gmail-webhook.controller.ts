import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
  UnauthorizedException,
  Param,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Types } from "mongoose";
import {
  PubSubService,
  PubSubMessage,
  GmailNotification,
} from "../services/pubsub.service";
import { GmailService } from "../services/gmail.service";
import { GoogleOAuthService } from "../services/google-oauth.service";
import { GmailWatchService } from "../services/gmail-watch.service";
import { UnifiedWorkflowService } from "../../../langgraph/unified-workflow.service";
import { gmail_v1 } from "googleapis";
import * as crypto from "crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";

interface PubSubPushPayload {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

interface WebhookVerificationParams {
  "hub.mode"?: string;
  "hub.topic"?: string;
  "hub.challenge"?: string;
  "hub.verify_token"?: string;
}

interface GmailEmailData {
  id: string;
  threadId: string;
  body: string;
  metadata: {
    subject: string;
    from: string;
    to: string;
    timestamp: string;
    headers?: any;
    gmailSource: boolean;
    messageId: string;
    labels?: string[];
    userId: string;
  };
}

@Controller("api/gmail/webhooks")
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly gmailService: GmailService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly gmailWatchService: GmailWatchService,
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.webhookSecret =
      this.configService.get<string>("GMAIL_WEBHOOK_SECRET") || "";
    if (!this.webhookSecret) {
      this.logger.warn(
        "GMAIL_WEBHOOK_SECRET not configured - webhook verification disabled",
      );
    }
  }

  /**
   * Handle Gmail push notifications from Google Pub/Sub
   * POST /api/gmail/webhooks/push
   */
  @Post("push")
  @HttpCode(HttpStatus.OK)
  async handlePushNotification(
    @Body() payload: PubSubPushPayload,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify the request comes from Google Cloud Pub/Sub
      await this.verifyGooglePubSubRequest(headers, payload);

      const messageId = payload.message.messageId;
      this.logger.log(`🔔 PUSH NOTIFICATION RECEIVED: ${messageId}`);
      this.logger.log(
        `📡 Headers: User-Agent: ${headers["user-agent"]}, From: ${headers["from"]}`,
      );

      // Decode the Gmail notification
      const pubsubMessage: PubSubMessage = {
        data: payload.message.data,
        messageId: payload.message.messageId,
        publishTime: payload.message.publishTime,
        attributes: payload.message.attributes,
      };

      const notification =
        this.pubSubService.decodePubSubMessage(pubsubMessage);
      if (!notification) {
        this.logger.error(`❌ Failed to decode notification ${messageId}`);
        return { success: false, message: "Failed to decode notification" };
      }

      const userEmail = notification.emailAddress;
      this.logger.log(
        `📧 Push notification for: ${userEmail}, historyId: ${notification.historyId}`,
      );

      // Process the notification with user context validation
      const processedCount = await this.processGmailNotification(notification);

      if (processedCount > 0) {
        this.logger.log(
          `✅ Push notification processed successfully for ${userEmail}: ${processedCount} emails`,
        );
      } else {
        this.logger.log(
          `ℹ️ Push notification processed but no new emails found for ${userEmail}`,
        );
      }

      return {
        success: true,
        message: `Notification processed successfully for ${userEmail}`,
      };
    } catch (error) {
      this.logger.error(
        `❌ Push notification processing failed: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      return {
        success: false,
        message: "Failed to process push notification",
      };
    }
  }

  /**
   * Handle pull notifications (backup method)
   */
  @Post("pull")
  @HttpCode(HttpStatus.OK)
  async processPullNotifications(): Promise<{
    success: boolean;
    processed: number;
  }> {
    try {
      this.logger.log("Processing pull notifications...");

      const notifications = await this.pubSubService.processPulledMessages();
      let totalProcessed = 0;

      for (const notification of notifications) {
        try {
          const processed = await this.processGmailNotification(notification);
          totalProcessed += processed;
        } catch (error) {
          this.logger.error(
            `Failed to process notification for ${notification.emailAddress}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Processed ${totalProcessed} emails from ${notifications.length} notifications`,
      );

      return { success: true, processed: totalProcessed };
    } catch (error) {
      this.logger.error("Failed to process pull notifications:", error);
      throw error;
    }
  }

  /**
   * Webhook verification endpoint (for initial setup)
   */
  @Get("verify")
  async verifyWebhook(
    @Query() params: WebhookVerificationParams,
  ): Promise<string> {
    this.logger.log("Webhook verification request received");

    if (params["hub.mode"] === "subscribe") {
      const challenge = params["hub.challenge"];
      const topic = params["hub.topic"];

      this.logger.log(`Webhook verification for topic: ${topic}`);

      if (challenge) {
        return challenge;
      }
    }

    throw new BadRequestException("Invalid verification request");
  }

  /**
   * Health check endpoint
   */
  @Get("health")
  async getHealth(): Promise<{
    status: string;
    pubsub: boolean;
    subscriptions: any;
    watchStats: any;
    timestamp: string;
  }> {
    try {
      this.logger.log("🏥 Performing webhook health check");

      const [pubsubHealthy, subscriptionHealth, watchStats] = await Promise.all(
        [
          this.pubSubService.testConnection(),
          this.pubSubService.getSubscriptionHealth(),
          this.gmailWatchService.getStatistics(),
        ],
      );

      const result = {
        status: pubsubHealthy ? "healthy" : "unhealthy",
        pubsub: pubsubHealthy,
        subscriptions: subscriptionHealth,
        watchStats: {
          ...watchStats,
          contextNote:
            "Only processing notifications for users with active sessions",
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.log(`🏥 Webhook health check completed: ${result.status}`);

      return result;
    } catch (error) {
      this.logger.error("❌ Webhook health check failed:", error);
      return {
        status: "unhealthy",
        pubsub: false,
        subscriptions: null,
        watchStats: null,
        timestamp: new Date().toISOString(),
      };
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

        // This indicates an orphaned watch - try to clean it up if possible
        await this.handleOrphanedWatch(notification.emailAddress);

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

      // ENHANCED: Process each new email through the triage system with better error handling
      let processedCount = 0;
      for (const email of newEmails) {
        try {
          this.logger.log(
            `🚀 Starting triage for email: ${email.id} - "${email.metadata.subject}" from ${email.metadata.from}`,
          );

          // Trigger the email triage process
          await this.triggerEmailTriage(watchInfo.watchId, email);
          processedCount++;

          this.logger.log(
            `✅ Triage initiated successfully for email: ${email.id}`,
          );
        } catch (error) {
          this.logger.error(`❌ Failed to process email ${email.id}:`, error);

          // Still emit a failed event for this email
          this.eventEmitter.emit("email.triage.failed", {
            emailId: email.id,
            emailAddress: notification.emailAddress,
            subject: email.metadata.subject,
            from: email.metadata.from,
            error: error.message,
            timestamp: new Date().toISOString(),
            source: "gmail_push",
          });
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
   * Handle orphaned watch notifications
   * This occurs when Google sends notifications for watches that no longer exist in our database
   */
  private async handleOrphanedWatch(emailAddress: string): Promise<void> {
    try {
      this.logger.log(
        `🧹 Handling orphaned watch notification for: ${emailAddress}`,
      );

      // Log orphaned watch for monitoring and cleanup
      this.logger.warn(`📊 ORPHANED WATCH DETECTED:
        - Email: ${emailAddress}
        - Action: Google is sending notifications for a watch not in our database
        - Likely causes: 
          1. Server crash/restart without proper cleanup
          2. Manual database cleanup without Google API cleanup
          3. Development/testing without cleanup
        - Auto-resolution: Watch will expire within 7 days
        - Manual cleanup: Use cleanup scripts or Google Cloud Console`);

      // Try to find any watches for this email in the database (including inactive ones)
      const inactiveWatch =
        await this.gmailWatchService.getWatchInfoByEmail(emailAddress);

      if (inactiveWatch) {
        this.logger.log(
          `🔍 Found inactive watch in database for: ${emailAddress}, watchId: ${inactiveWatch.watchId}`,
        );
        this.logger.log(
          `💡 This watch may have been manually deactivated but not cleaned up in Google`,
        );

        // Try to stop the watch on Google's side using the existing watch info
        await this.attemptGoogleWatchCleanup(
          emailAddress,
          inactiveWatch.userId.toString(),
        );
      } else {
        this.logger.log(
          `🔍 No watch record found in database for: ${emailAddress} - completely orphaned`,
        );

        // Try to find user by email and stop any watches
        await this.attemptOrphanedWatchCleanup(emailAddress);
      }

      // Emit event for monitoring/alerting systems
      this.eventEmitter.emit("gmail.orphaned_watch_detected", {
        emailAddress,
        timestamp: new Date().toISOString(),
        hasInactiveRecord: !!inactiveWatch,
        watchId: inactiveWatch?.watchId,
        cleanupAttempted: true,
      });

      // TODO: Implement proactive cleanup if we have service account permissions
      // For now, log the recommended cleanup steps
      this.logger.log(`🔧 Recommended cleanup for orphaned watch:
        1. Use the cleanup script: ./scripts/cleanup-orphaned-gmail-watches.sh
        2. Or manually call: POST /api/gmail/debug/force-stop-all (with admin token)
        3. Or wait for natural expiration (within 7 days)
        4. Or use Google Cloud Console to manage Pub/Sub subscriptions`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to handle orphaned watch for ${emailAddress}:`,
        error,
      );
    }
  }

  /**
   * Attempt to cleanup orphaned watch by trying to stop it on Google's side
   */
  private async attemptGoogleWatchCleanup(
    emailAddress: string,
    userId: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `🔧 Attempting Google watch cleanup for: ${emailAddress} (userId: ${userId})`,
      );

      // Try to get authenticated client and stop the watch
      const client =
        await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: "v1", auth: client });

      // Stop any active watch for this user
      await gmail.users.stop({ userId: "me" });

      this.logger.log(
        `✅ Successfully stopped Google watch for: ${emailAddress}`,
      );

      // Also ensure database record is cleaned up
      await this.gmailWatchService.deactivateWatch(new Types.ObjectId(userId));

      this.logger.log(`✅ Cleaned up database record for: ${emailAddress}`);
    } catch (error) {
      if (error.code === 404) {
        this.logger.log(
          `ℹ️ No active watch found on Google's side for: ${emailAddress} (already cleaned up)`,
        );
      } else if (error.code === 401 || error.code === 403) {
        this.logger.warn(
          `🔑 Authentication error cleaning up watch for ${emailAddress}: ${error.message}`,
        );
      } else {
        this.logger.error(
          `❌ Failed to cleanup Google watch for ${emailAddress}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Attempt to cleanup completely orphaned watch (no database record)
   */
  private async attemptOrphanedWatchCleanup(
    emailAddress: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `🕵️ Attempting to find and cleanup completely orphaned watch for: ${emailAddress}`,
      );

      // For completely orphaned watches, we can't easily clean them up without knowing the userId
      // The best we can do is log detailed information and provide cleanup guidance

      this.logger.warn(`⚠️ COMPLETELY ORPHANED WATCH: ${emailAddress}
        - No database record found
        - Google is still sending notifications
        - Cannot automatically clean up without user context
        - Recommended actions:
          1. Run nuclear reset: POST /api/gmail/webhooks/admin/reset-all-watches
          2. Or wait 7 days for natural expiration
          3. Or manually manage via Google Cloud Console`);

      // Emit a special event for completely orphaned watches
      this.eventEmitter.emit("gmail.completely_orphaned_watch", {
        emailAddress,
        timestamp: new Date().toISOString(),
        recommendedAction: "nuclear_reset_or_wait_expiration",
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to analyze orphaned watch for ${emailAddress}: ${error.message}`,
      );
    }
  }

  /**
   * Get new emails from Gmail history using History API
   */
  private async getNewEmailsFromHistory(
    watchId: string,
    emailAddress: string,
    currentHistoryId: string,
  ): Promise<GmailEmailData[]> {
    try {
      // Get watch info to find the user and last processed history ID
      const watchInfo =
        await this.gmailWatchService.getWatchInfoByEmail(emailAddress);
      if (!watchInfo || !watchInfo.isActive) {
        throw new Error(`Active watch not found for email: ${emailAddress}`);
      }

      const lastHistoryId = watchInfo.historyId;
      const userId = watchInfo.userId.toString(); // Convert ObjectId to string
      let currentGmailHistoryId: string;

      this.logger.log(
        `Fetching Gmail history from ${lastHistoryId} to ${currentHistoryId} for ${emailAddress} (userId: ${userId})`,
      );

      // IMPORTANT: Check if we're trying to fetch the same history range
      if (lastHistoryId === currentHistoryId) {
        this.logger.log(
          `⚠️ Same history ID detected (${lastHistoryId}), skipping to avoid duplicates`,
        );
        return [];
      }

      // Get authenticated Gmail client using the user ID
      const authClient =
        await this.googleOAuthService.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: "v1", auth: authClient });

      // ENHANCED: Test authentication and detect stale historyId
      try {
        const profile = await gmail.users.getProfile({ userId: "me" });
        currentGmailHistoryId = profile.data.historyId!;
        this.logger.log(
          `✅ Gmail authentication verified for ${emailAddress}, current historyId: ${currentGmailHistoryId}`,
        );

        // CRITICAL FIX: Detect if watch historyId is too old
        const historyIdDiff =
          parseInt(currentGmailHistoryId) - parseInt(lastHistoryId);
        this.logger.log(
          `📊 History ID analysis: Watch=${lastHistoryId}, Current=${currentGmailHistoryId}, Diff=${historyIdDiff}`,
        );

        // If difference is too large (>1000000), the historyId is stale
        if (historyIdDiff > 1000000) {
          this.logger.warn(
            `🚨 STALE HISTORY ID DETECTED: Watch historyId ${lastHistoryId} is too old (current: ${currentGmailHistoryId}, diff: ${historyIdDiff})`,
          );

          // Reset watch to current historyId to fix the issue
          await this.gmailWatchService.updateHistoryId(
            watchId,
            currentGmailHistoryId,
          );
          this.logger.log(
            `🔄 Reset watch ${watchId} historyId from ${lastHistoryId} to ${currentGmailHistoryId}`,
          );

          // Skip processing this notification since we can't get historical data
          this.logger.log(
            `⏭️ Skipping notification processing due to stale historyId - watch is now synced for future notifications`,
          );
          return [];
        }
      } catch (authError) {
        this.logger.error(
          `❌ Gmail authentication failed for ${emailAddress}:`,
          authError,
        );
        throw new Error(`Gmail authentication failed: ${authError.message}`);
      }

      // ENHANCED: Use improved history API parameters with fallback handling
      this.logger.log(
        `📡 Calling Gmail History API with startHistoryId: ${lastHistoryId}`,
      );

      let historyResponse;
      try {
        historyResponse = await gmail.users.history.list({
          userId: "me",
          startHistoryId: lastHistoryId,
          historyTypes: ["messageAdded"], // Only look for new messages
          maxResults: 100,
          // Removed labelId filter to catch all messages, then filter client-side
        });
      } catch (historyError) {
        this.logger.error(
          `❌ Gmail History API error: ${historyError.message} (code: ${historyError.code})`,
        );

        // Handle 404 (history not found) by resetting to current historyId
        if (historyError.code === 404) {
          this.logger.warn(
            `📭 History ID ${lastHistoryId} not found (too old), resetting to current: ${currentGmailHistoryId}`,
          );

          // Reset watch to current historyId
          await this.gmailWatchService.updateHistoryId(
            watchId,
            currentGmailHistoryId,
          );
          this.logger.log(
            `🔄 Watch ${watchId} reset to current historyId: ${currentGmailHistoryId}`,
          );

          // Return empty array - future notifications will work with synced historyId
          return [];
        }

        // Re-throw other errors
        throw historyError;
      }

      const histories = historyResponse.data.history || [];
      const newEmails: GmailEmailData[] = [];

      this.logger.log(
        `📊 Gmail History API returned ${histories.length} history entries`,
      );

      // ENHANCED: More detailed logging for each history entry
      for (let i = 0; i < histories.length; i++) {
        const history = histories[i];
        this.logger.log(
          `📜 Processing history entry ${i + 1}/${histories.length}, historyId: ${history.id}`,
        );

        if (history.messagesAdded && history.messagesAdded.length > 0) {
          this.logger.log(
            `📬 Found ${history.messagesAdded.length} new messages in this history entry`,
          );

          for (const messageAdded of history.messagesAdded) {
            try {
              // Check if message has INBOX label (filter client-side)
              const messageLabels = messageAdded.message?.labelIds || [];
              if (!messageLabels.includes("INBOX")) {
                this.logger.log(
                  `⏭️ Skipping message ${messageAdded.message?.id} - not in INBOX (labels: ${messageLabels.join(", ")})`,
                );
                continue;
              }

              this.logger.log(
                `🔄 Transforming message: ${messageAdded.message?.id}`,
              );

              const emailData = await this.transformGmailMessage(
                gmail,
                messageAdded.message!,
                emailAddress,
                userId,
              );

              if (emailData) {
                newEmails.push(emailData);
                this.logger.log(
                  `✅ Successfully transformed email: ${emailData.id} - "${emailData.metadata.subject}" from ${emailData.metadata.from}`,
                );

                // ENHANCED: Emit email received event immediately
                this.logger.log(
                  `📡 Emitting email.received event for: ${emailData.id}`,
                );
                this.eventEmitter.emit("email.received", {
                  emailId: emailData.id,
                  emailAddress: emailAddress,
                  subject: emailData.metadata.subject,
                  from: emailData.metadata.from,
                  to: emailData.metadata.to,
                  body: emailData.body.substring(0, 200), // Preview
                  timestamp: new Date().toISOString(),
                  fullEmail: {
                    id: emailData.id,
                    threadId: emailData.threadId,
                    metadata: emailData.metadata,
                    bodyLength: emailData.body.length,
                  },
                });
              } else {
                this.logger.warn(
                  `⚠️ Failed to transform message ${messageAdded.message?.id} - returned null`,
                );
              }
            } catch (error) {
              this.logger.error(
                `❌ Failed to transform Gmail message ${messageAdded.message?.id}:`,
                error,
              );
            }
          }
        } else {
          this.logger.log(
            `📭 No new messages in history entry ${i + 1}, historyId: ${history.id}`,
          );
        }
      }

      // ENHANCED: Always update watch with new history ID, even if no emails found
      // This prevents reprocessing the same history range
      this.logger.log(
        `🔄 Updating watch ${watchId} history ID from ${lastHistoryId} to ${currentHistoryId}`,
      );

      await this.gmailWatchService.updateHistoryId(watchId, currentHistoryId);
      this.logger.log(
        `✅ Updated watch ${watchId} with new history ID: ${currentHistoryId}`,
      );

      this.logger.log(
        `🎯 FINAL RESULT: Successfully processed ${newEmails.length} new emails for ${emailAddress} from ${histories.length} history entries`,
      );

      return newEmails;
    } catch (error) {
      this.logger.error(
        `❌ CRITICAL ERROR in getNewEmailsFromHistory for ${emailAddress}:`,
        error,
      );

      // Enhanced error logging with context
      if (error.code === 401) {
        this.logger.error(
          `🔑 Authentication error - token may be expired for ${emailAddress}`,
        );
      } else if (error.code === 403) {
        this.logger.error(
          `🚫 Permission error - check Gmail API scopes for ${emailAddress}`,
        );
      } else if (error.code === 404) {
        this.logger.error(
          `📭 History not found - historyId may be too old for ${emailAddress}`,
        );
      } else {
        this.logger.error(
          `🔥 Unexpected error (code: ${error.code}): ${error.message}`,
        );
      }

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
  ): Promise<GmailEmailData | null> {
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

  /**
   * Trigger email triage for a specific email using UnifiedWorkflowService
   */
  private async triggerEmailTriage(
    watchId: string,
    email: GmailEmailData,
  ): Promise<void> {
    try {
      this.logger.log(
        `🎯 Triggering email triage for email ${email.id} from watch ${watchId}`,
      );
      this.logger.log(
        `📧 Email details - Subject: "${email.metadata.subject}", From: ${email.metadata.from}`,
      );

      // Get user ID from email metadata or watch info
      const userId = email.metadata.userId || watchId; // Fallback to watchId if userId not available
      this.logger.log(`👤 Using userId: ${userId} for triage processing`);

      // Emit immediate email received notification for real-time updates
      this.logger.log(
        `📡 Emitting email.received event for immediate notification`,
      );
      this.eventEmitter.emit("email.received", {
        emailId: email.id,
        emailAddress: email.metadata.to,
        subject: email.metadata.subject,
        from: email.metadata.from,
        to: email.metadata.to,
        body: email.body.substring(0, 500), // First 500 chars for preview
        timestamp: email.metadata.timestamp,
        fullEmail: {
          id: email.id,
          threadId: email.threadId,
          metadata: email.metadata,
          bodyLength: email.body.length,
        },
      });

      // Transform Gmail email data to unified workflow input format
      const triageInput = {
        type: "email_triage",
        emailData: {
          id: email.id,
          body: email.body,
          metadata: email.metadata,
        },
        content: email.body, // Include content for processing
      };

      this.logger.log(
        `🔄 Submitting email to UnifiedWorkflowService for full triage processing`,
      );

      // Emit triage started event
      this.logger.log(`📡 Emitting triage.started event`);
      this.eventEmitter.emit("email.triage.started", {
        emailId: email.id,
        emailAddress: email.metadata.to,
        subject: email.metadata.subject,
        from: email.metadata.from,
        timestamp: new Date().toISOString(),
        source: "gmail_push",
      });

      // Process through existing unified workflow service
      const result = await this.unifiedWorkflowService.processInput(
        triageInput,
        {
          source: "gmail_push",
          watchId,
          emailAddress: email.metadata.to,
          gmailSource: email.metadata.gmailSource,
        },
        userId,
      );

      this.logger.log(
        `✅ Email triage initiated for ${email.id}, session: ${result.sessionId}`,
      );

      // Emit triage processing event with session info
      this.logger.log(
        `📡 Emitting triage.processing event for session: ${result.sessionId}`,
      );
      this.eventEmitter.emit("email.triage.processing", {
        sessionId: result.sessionId,
        emailId: email.id,
        emailAddress: email.metadata.to,
        subject: email.metadata.subject,
        status: result.status,
        timestamp: new Date().toISOString(),
        source: "gmail_push",
      });

      // Note: triage.completed events will be emitted by the workflow system when processing finishes
      // The UnifiedWorkflowService should emit these events automatically

      this.logger.log(
        `🎉 Triage process successfully started for email: ${email.id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to trigger email triage for email ${email.id}:`,
        error,
      );

      // Emit error event for real-time notifications
      this.logger.log(`📡 Emitting triage.failed event for email: ${email.id}`);
      this.eventEmitter.emit("email.triage.failed", {
        emailId: email.id,
        emailAddress: email.metadata.to,
        subject: email.metadata.subject,
        error: error.message,
        timestamp: new Date().toISOString(),
        source: "gmail_push",
      });

      throw error;
    }
  }

  /**
   * Verify Google Cloud Pub/Sub request authenticity
   */
  private verifyGooglePubSubRequest(
    headers: Record<string, string>,
    payload: PubSubPushPayload,
  ): void {
    try {
      // Method 1: Check User-Agent (Google Cloud Pub/Sub sends specific user-agent)
      const userAgent = headers["user-agent"] || headers["User-Agent"] || "";
      const validUserAgents = ["APIs-Google", "Google-Cloud-Pub-Sub", "Google"];

      const hasValidUserAgent = validUserAgents.some((ua) =>
        userAgent.includes(ua),
      );
      if (!hasValidUserAgent) {
        this.logger.warn(`⚠️ Suspicious user-agent: ${userAgent}`);
        // For development, we'll log but not reject
        // In production, you might want to reject invalid user agents
      }

      // Method 2: Check From header (Google notifications come from noreply@google.com)
      const fromHeader = headers["from"] || headers["From"] || "";
      if (fromHeader && !fromHeader.includes("google.com")) {
        this.logger.warn(`⚠️ Suspicious from header: ${fromHeader}`);
      }

      // Method 3: Verify payload structure
      if (!payload.message || !payload.subscription) {
        throw new BadRequestException("Invalid Pub/Sub payload structure");
      }

      if (!payload.message.data || !payload.message.messageId) {
        throw new BadRequestException("Invalid Pub/Sub message structure");
      }

      // Method 4: Verify subscription name matches expected pattern
      const expectedPattern =
        /^projects\/[\w-]+\/subscriptions\/(gmail-push|gmail-pull)/;
      if (!expectedPattern.test(payload.subscription)) {
        this.logger.warn(`⚠️ Unexpected subscription: ${payload.subscription}`);
        // Log warning but don't reject - subscription names might vary
      }

      // Method 5: Optional token validation if configured
      if (process.env.GMAIL_WEBHOOK_TOKEN) {
        // Check if token is present in the payload attributes
        const token = payload.message.attributes?.token;

        // Only validate token if the message actually contains one
        // Google's default push notifications don't include custom tokens
        if (token) {
          if (token !== process.env.GMAIL_WEBHOOK_TOKEN) {
            this.logger.warn("🚫 Invalid webhook token in message attributes");
            throw new UnauthorizedException("Invalid webhook token");
          } else {
            this.logger.log("✅ Valid webhook token verified");
          }
        } else {
          // Token is configured but not present in message - this is normal for Google
          this.logger.log(
            "ℹ️ Webhook token configured but not present in message (normal for Google Pub/Sub)",
          );
        }
      }

      this.logger.log(`✅ Google Pub/Sub request verification passed`);
    } catch (error) {
      this.logger.error(
        "❌ Google Pub/Sub request verification failed:",
        error,
      );
      throw error;
    }
  }

  /**
   * Process new emails from Gmail History API and trigger triage
   */
  private async processNewEmails(
    newEmails: any[],
    emailAddress: string,
  ): Promise<void> {
    this.logger.log(
      `Processing ${newEmails.length} new emails for ${emailAddress}`,
    );

    for (const email of newEmails) {
      try {
        const sessionId = `gmail-${emailAddress}-${Date.now()}`;

        // Emit start event for real-time tracking
        this.eventEmitter.emit("email.triage.started", {
          sessionId,
          emailId: email.id,
          emailAddress,
          timestamp: new Date().toISOString(),
        });

        // Process email through unified workflow service
        const result = await this.unifiedWorkflowService.processInput(
          {
            type: "email_triage",
            content: email.body,
            emailData: email,
            metadata: email.metadata,
          },
          {
            source: "gmail_push",
            emailAddress: emailAddress,
          },
          sessionId,
        );

        this.logger.log(
          `Email triage completed for ${email.id}, session: ${result.sessionId}`,
        );

        // Emit completion event for real-time notifications
        this.eventEmitter.emit("email.triage.completed", {
          sessionId: result.sessionId,
          emailId: email.id,
          emailAddress: emailAddress,
          result: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to trigger email triage for email ${email.id}:`,
          error,
        );

        // Emit error event
        this.eventEmitter.emit("email.triage.failed", {
          emailId: email.id,
          emailAddress: emailAddress,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  @Get("debug/:emailAddress")
  async debugEmailHistory(
    @Param("emailAddress") emailAddress: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `🔍 DEBUG: Analyzing Gmail notification processing for ${emailAddress}`,
      );

      // Get watch info
      const watchInfo =
        await this.gmailWatchService.getWatchInfoByEmail(emailAddress);
      if (!watchInfo) {
        return { error: "No watch found for email address" };
      }

      // Get authenticated Gmail client
      const authClient = await this.googleOAuthService.getAuthenticatedClient(
        watchInfo.userId.toString(),
      );
      const gmail = google.gmail({ version: "v1", auth: authClient });

      // Get current profile to see latest history ID
      const profile = await gmail.users.getProfile({ userId: "me" });
      const currentHistoryId = profile.data.historyId!;

      this.logger.log(
        `📊 Watch historyId: ${watchInfo.historyId}, Current historyId: ${currentHistoryId}`,
      );

      // Try to fetch history
      const historyResponse = await gmail.users.history.list({
        userId: "me",
        startHistoryId: watchInfo.historyId,
        historyTypes: ["messageAdded"],
        maxResults: 10,
      });

      const histories = historyResponse.data.history || [];
      const debugInfo = {
        emailAddress,
        watchInfo: {
          watchId: watchInfo.watchId,
          historyId: watchInfo.historyId,
          currentHistoryId,
          isActive: watchInfo.isActive,
          lastError: watchInfo.lastError,
        },
        historyResponse: {
          totalHistories: histories.length,
          histories: histories.map((h) => ({
            id: h.id,
            messagesAdded: h.messagesAdded?.length || 0,
            messages:
              h.messagesAdded?.map((m) => ({
                id: m.message?.id,
                labels: m.message?.labelIds,
              })) || [],
          })),
        },
        recommendation:
          histories.length === 0
            ? "No history entries found - this might be why no emails are being processed"
            : `Found ${histories.length} history entries with messages to process`,
      };

      return debugInfo;
    } catch (error) {
      this.logger.error(`❌ Debug analysis failed:`, error);
      return { error: error.message, stack: error.stack };
    }
  }

  @Post("force-refresh/:emailAddress")
  async forceRefreshEmailHistory(
    @Param("emailAddress") emailAddress: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `🔄 FORCE REFRESH: Manually processing emails for ${emailAddress}`,
      );

      // Get watch info
      const watchInfo =
        await this.gmailWatchService.getWatchInfoByEmail(emailAddress);
      if (!watchInfo) {
        return { error: "No watch found for email address" };
      }

      // Get authenticated Gmail client
      const authClient = await this.googleOAuthService.getAuthenticatedClient(
        watchInfo.userId.toString(),
      );
      const gmail = google.gmail({ version: "v1", auth: authClient });

      // Get current profile to get latest history ID
      const profile = await gmail.users.getProfile({ userId: "me" });
      const currentHistoryId = profile.data.historyId!;

      this.logger.log(
        `📊 Current Gmail historyId: ${currentHistoryId}, Watch historyId: ${watchInfo.historyId}`,
      );

      // Force process with current history ID
      const processedCount = await this.processGmailNotification({
        emailAddress,
        historyId: currentHistoryId,
      });

      return {
        success: true,
        message: `Force refresh completed for ${emailAddress}`,
        processedEmails: processedCount,
        watchInfo: {
          watchId: watchInfo.watchId,
          oldHistoryId: watchInfo.historyId,
          newHistoryId: currentHistoryId,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Force refresh failed:`, error);
      return {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      };
    }
  }

  /**
   * Get all active Gmail watches (admin endpoint)
   * GET /api/gmail/webhooks/admin/watches
   */
  @Get("admin/watches")
  async getAllActiveWatches(): Promise<any> {
    try {
      this.logger.log(`📊 Getting all active Gmail watches`);

      const allWatches = await this.gmailWatchService.getAllActiveWatches();

      const watchesSummary = allWatches.map((watch) => ({
        watchId: watch.watchId,
        googleEmail: watch.googleEmail,
        historyId: watch.historyId,
        expiresAt: watch.expiresAt,
        isActive: watch.isActive,
        notificationsReceived: watch.notificationsReceived || 0,
        emailsProcessed: watch.emailsProcessed || 0,
        errorCount: watch.errorCount || 0,
        lastError: watch.lastError,
        userId: watch.userId,
      }));

      return {
        success: true,
        message: `Found ${allWatches.length} active watches`,
        totalWatches: allWatches.length,
        watches: watchesSummary,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to get all active watches: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Failed to get active watches: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * NUCLEAR OPTION: Delete ALL Gmail watches and start fresh
   * POST /api/gmail/webhooks/admin/reset-all-watches
   */
  @Post("admin/reset-all-watches")
  async resetAllWatches(): Promise<any> {
    try {
      this.logger.log(`🚨 NUCLEAR RESET: Deleting ALL Gmail watches`);

      // Get all active watches first
      const allWatches = await this.gmailWatchService.getAllActiveWatches();
      const totalWatches = allWatches.length;

      if (totalWatches === 0) {
        return {
          success: true,
          message: "No active watches found to reset",
          totalWatches: 0,
          stoppedWatches: 0,
          failedWatches: 0,
          errors: [],
        };
      }

      this.logger.log(`📊 Found ${totalWatches} watches to reset`);

      let stoppedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];
      const resetResults: any[] = [];

      // Stop all watches in parallel for speed
      const stopPromises = allWatches.map(async (watch) => {
        try {
          this.logger.log(
            `🛑 Stopping watch for: ${watch.googleEmail} (${watch.watchId})`,
          );

          let googleApiSuccess = false;
          let authError = null;

          // Try to stop the watch via Gmail API
          try {
            const client = await this.googleOAuthService.getAuthenticatedClient(
              watch.userId.toString(),
            );
            const gmail = google.gmail({ version: "v1", auth: client });
            await gmail.users.stop({ userId: "me" });
            googleApiSuccess = true;
            this.logger.log(
              `✅ Stopped Google watch for: ${watch.googleEmail}`,
            );
          } catch (apiError) {
            authError = apiError;
            if (apiError.code === 404) {
              this.logger.log(
                `ℹ️ No active watch found on Google's side for: ${watch.googleEmail}`,
              );
              googleApiSuccess = true; // Consider 404 as success (already stopped)
            } else if (apiError.code === 401 || apiError.code === 403) {
              this.logger.warn(
                `🔑 Authentication failed for ${watch.googleEmail}: ${apiError.message}`,
              );
            } else {
              this.logger.error(
                `❌ Google API error for ${watch.googleEmail}: ${apiError.message}`,
              );
            }
          }

          // Always try to deactivate in database, regardless of Google API result
          try {
            await this.gmailWatchService.deactivateWatch(watch.userId);
            this.logger.log(
              `✅ Deactivated database watch for: ${watch.googleEmail}`,
            );
          } catch (dbError) {
            this.logger.error(
              `❌ Database deactivation failed for ${watch.googleEmail}: ${dbError.message}`,
            );
            throw dbError; // This is more critical than Google API failure
          }

          stoppedCount++;

          return {
            success: true,
            email: watch.googleEmail,
            watchId: watch.watchId,
            action: "stopped",
            googleApiSuccess,
            authError: authError ? (authError as any).message : undefined,
          };
        } catch (error) {
          failedCount++;
          const errorMsg = `Failed to stop watch for ${watch.googleEmail}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);

          return {
            success: false,
            email: watch.googleEmail,
            watchId: watch.watchId,
            error: errorMsg,
          };
        }
      });

      // Wait for all operations to complete
      const results = await Promise.allSettled(stopPromises);

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          resetResults.push(result.value);
        } else {
          failedCount++;
          errors.push(`Promise rejected: ${result.reason}`);
          resetResults.push({
            success: false,
            error: `Promise rejected: ${result.reason}`,
          });
        }
      });

      const summary = {
        success: stoppedCount > 0,
        message: `Reset completed: ${stoppedCount} stopped, ${failedCount} failed`,
        totalWatches,
        stoppedWatches: stoppedCount,
        failedWatches: failedCount,
        successRate:
          totalWatches > 0
            ? Math.round((stoppedCount / totalWatches) * 100)
            : 100,
        errors,
        results: resetResults,
      };

      this.logger.log(`🎯 Reset Summary:
        - Total watches: ${totalWatches}
        - Successfully stopped: ${stoppedCount}
        - Failed: ${failedCount}
        - Success rate: ${summary.successRate}%`);

      if (errors.length > 0) {
        this.logger.warn(`⚠️ Some watches failed to stop:`, errors);
      }

      return summary;
    } catch (error) {
      this.logger.error(
        `❌ NUCLEAR RESET failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Nuclear reset failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Create fresh Gmail watches for all authenticated users
   * POST /api/gmail/webhooks/admin/recreate-all-watches
   */
  @Post("admin/recreate-all-watches")
  async recreateAllWatches(): Promise<any> {
    try {
      this.logger.log(`🔄 Recreating fresh Gmail watches for all users`);

      // This would need to be implemented based on how you track authenticated users
      // For now, return instructions for manual recreation
      return {
        success: true,
        message: "Use individual user endpoints to recreate watches",
        instructions: [
          "1. Each user should call POST /api/gmail/watch to create new watch",
          "2. Or use POST /gmail/client/setup-notifications endpoint",
          "3. New watches will be created with current historyId",
          "4. This ensures no stale historyId issues",
        ],
        nextSteps: {
          manualRecreation: "POST /api/gmail/watch (per user)",
          clientSetup: "POST /gmail/client/setup-notifications (per user)",
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Recreate all watches failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Recreate failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Health check for Gmail watch system
   * GET /api/gmail/webhooks/admin/watch-health
   */
  @Get("admin/watch-health")
  async getWatchHealth(): Promise<any> {
    try {
      this.logger.log(`🩺 Checking Gmail watch system health`);

      const allWatches = await this.gmailWatchService.getAllActiveWatches();
      const now = new Date();

      const healthStats = {
        totalWatches: allWatches.length,
        expiredWatches: 0,
        expiringIn24h: 0,
        watchesWithErrors: 0,
        staleWatches: 0,
        healthyWatches: 0,
      };

      const watchDetails = allWatches.map((watch) => {
        const timeToExpiry =
          new Date(watch.expiresAt).getTime() - now.getTime();
        const hoursToExpiry = timeToExpiry / (1000 * 60 * 60);
        const isExpired = hoursToExpiry <= 0;
        const isExpiringSoon = hoursToExpiry <= 24 && hoursToExpiry > 0;
        const hasErrors = (watch.errorCount || 0) > 0;

        // Check for stale historyId (rough estimate)
        const historyIdNum = parseInt(watch.historyId);
        const isStale = !isNaN(historyIdNum) && historyIdNum < 1000000; // Very rough heuristic

        if (isExpired) healthStats.expiredWatches++;
        if (isExpiringSoon) healthStats.expiringIn24h++;
        if (hasErrors) healthStats.watchesWithErrors++;
        if (isStale) healthStats.staleWatches++;
        if (!isExpired && !hasErrors && !isStale) healthStats.healthyWatches++;

        return {
          watchId: watch.watchId,
          googleEmail: watch.googleEmail,
          historyId: watch.historyId,
          hoursToExpiry: Math.round(hoursToExpiry * 10) / 10,
          isExpired,
          isExpiringSoon,
          hasErrors,
          errorCount: watch.errorCount || 0,
          lastError: watch.lastError,
          isStale,
          notificationsReceived: watch.notificationsReceived || 0,
          emailsProcessed: watch.emailsProcessed || 0,
        };
      });

      const overallHealth = {
        status:
          healthStats.healthyWatches === healthStats.totalWatches
            ? "healthy"
            : healthStats.healthyWatches > healthStats.totalWatches * 0.8
              ? "warning"
              : "critical",
        healthPercentage:
          healthStats.totalWatches > 0
            ? Math.round(
                (healthStats.healthyWatches / healthStats.totalWatches) * 100,
              )
            : 100,
      };

      return {
        success: true,
        overallHealth,
        healthStats,
        recommendations: this.generateHealthRecommendations(healthStats),
        watchDetails,
        timestamp: now.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Watch health check failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Health check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  private generateHealthRecommendations(stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.expiredWatches > 0) {
      recommendations.push(
        `❌ ${stats.expiredWatches} watches have expired - recreate them immediately`,
      );
    }

    if (stats.expiringIn24h > 0) {
      recommendations.push(
        `⚠️ ${stats.expiringIn24h} watches expire in 24h - renew them soon`,
      );
    }

    if (stats.watchesWithErrors > 0) {
      recommendations.push(
        `🚨 ${stats.watchesWithErrors} watches have errors - investigate and fix`,
      );
    }

    if (stats.staleWatches > 0) {
      recommendations.push(
        `🕰️ ${stats.staleWatches} watches may have stale historyId - reset them`,
      );
    }

    if (stats.healthyWatches === stats.totalWatches && stats.totalWatches > 0) {
      recommendations.push(`✅ All watches are healthy!`);
    }

    if (stats.totalWatches === 0) {
      recommendations.push(
        `📭 No active watches found - users need to set up notifications`,
      );
    }

    return recommendations;
  }

  /**
   * Force stop orphaned watch by email address
   * POST /api/gmail/webhooks/admin/force-stop-orphaned/:emailAddress
   */
  @Post("admin/force-stop-orphaned/:emailAddress")
  async forceStopOrphanedWatch(
    @Param("emailAddress") emailAddress: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `🚨 FORCE STOP ORPHANED WATCH: Starting cleanup for ${emailAddress}`,
      );

      const results = {
        success: false,
        message: "Cleanup in progress",
        emailAddress,
        actions: {
          databaseSearched: false,
          googleWatchStopped: false,
          userAuthValid: false,
          cleanupCompleted: false,
        },
        details: {
          foundUser: null as any,
          errors: [] as string[],
        },
      };

      // Step 1: Search for any database records (active or inactive)
      try {
        const watchInfo =
          await this.gmailWatchService.getWatchInfoByEmail(emailAddress);
        results.actions.databaseSearched = true;

        if (watchInfo) {
          results.details.foundUser = {
            userId: watchInfo.userId,
            watchId: watchInfo.watchId,
            isActive: watchInfo.isActive,
            historyId: watchInfo.historyId,
          };

          this.logger.log(
            `📋 Found database record for ${emailAddress}: userId=${watchInfo.userId}, watchId=${watchInfo.watchId}`,
          );

          // Step 2: Try to stop Google watch using the found user
          try {
            const client = await this.googleOAuthService.getAuthenticatedClient(
              watchInfo.userId.toString(),
            );
            results.actions.userAuthValid = true;

            const gmail = google.gmail({ version: "v1", auth: client });
            await gmail.users.stop({ userId: "me" });
            results.actions.googleWatchStopped = true;

            this.logger.log(
              `✅ Successfully stopped Google watch for ${emailAddress}`,
            );

            // Step 3: Clean up database record
            await this.gmailWatchService.deactivateWatch(watchInfo.userId);
            results.actions.cleanupCompleted = true;

            this.logger.log(
              `✅ Deactivated database watch for ${emailAddress}`,
            );

            results.success = true;
            results.message = `Successfully cleaned up orphaned watch for ${emailAddress}`;
          } catch (authError) {
            results.details.errors.push(
              `Authentication failed: ${authError.message}`,
            );

            if (authError.code === 404) {
              this.logger.log(
                `ℹ️ No active watch found on Google's side for ${emailAddress} (already stopped)`,
              );
              results.actions.googleWatchStopped = true; // Consider it stopped if 404
            } else if (authError.code === 401 || authError.code === 403) {
              this.logger.warn(
                `🔑 Authentication expired for ${emailAddress}: ${authError.message}`,
              );
              results.actions.userAuthValid = false;
            } else {
              this.logger.error(
                `❌ Failed to stop Google watch: ${authError.message}`,
              );
            }

            // Still try to clean up database even if Google API fails
            try {
              await this.gmailWatchService.deactivateWatch(watchInfo.userId);
              results.actions.cleanupCompleted = true;
              this.logger.log(
                `✅ Cleaned up database record despite Google API failure`,
              );
            } catch (dbError) {
              results.details.errors.push(
                `Database cleanup failed: ${dbError.message}`,
              );
            }
          }
        } else {
          this.logger.log(
            `📭 No database record found for ${emailAddress} - completely orphaned`,
          );
          results.details.errors.push(
            "No database record found - completely orphaned watch",
          );
        }
      } catch (error) {
        results.details.errors.push(`Database search failed: ${error.message}`);
        this.logger.error(`❌ Database search failed: ${error.message}`);
      }

      // Step 4: If no database record found, provide guidance
      if (!results.details.foundUser) {
        results.message = `No database record found for ${emailAddress}. This is a completely orphaned watch that must be handled via nuclear reset.`;
        results.details.errors.push(
          "Recommended action: Run nuclear reset to clean up all orphaned watches",
        );
      }

      // Final assessment
      if (
        results.actions.cleanupCompleted ||
        (!results.details.foundUser && results.actions.databaseSearched)
      ) {
        results.success = true;
        if (!results.message.includes("Successfully")) {
          results.message = `Cleanup completed for ${emailAddress} (no active watch found)`;
        }
      }

      this.logger.log(`🎯 ORPHANED WATCH CLEANUP SUMMARY for ${emailAddress}:
        - Database searched: ${results.actions.databaseSearched}
        - User auth valid: ${results.actions.userAuthValid}
        - Google watch stopped: ${results.actions.googleWatchStopped}
        - Cleanup completed: ${results.actions.cleanupCompleted}
        - Errors: ${results.details.errors.length}`);

      return {
        ...results,
        nextSteps: results.success
          ? {
              status: "completed",
              message: "Orphaned watch cleanup completed",
              recommendation:
                "Monitor logs to confirm no more notifications for this email",
            }
          : {
              status: "partial_or_failed",
              message: "Manual intervention may be required",
              recommendations: [
                "1. Try nuclear reset: POST /api/gmail/webhooks/admin/reset-all-watches",
                "2. Check Google Cloud Console Pub/Sub subscriptions",
                "3. Wait 7 days for natural watch expiration",
                "4. Verify user OAuth tokens are still valid",
              ],
            },
      };
    } catch (error) {
      this.logger.error(
        `❌ FORCE STOP ORPHANED WATCH failed for ${emailAddress}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Force stop failed: ${error.message}`,
        emailAddress,
        error: error.message,
        nextSteps: {
          status: "failed",
          recommendation:
            "Try nuclear reset or manual Google Cloud Console cleanup",
        },
      };
    }
  }
}

// Import google here to avoid circular dependency issues
import { google } from "googleapis";
