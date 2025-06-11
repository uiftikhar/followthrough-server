import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpStatus,
  Res,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";
import {
  GoogleCalendarService,
  GoogleWebhookNotification,
} from "../services/google-calendar.service";
import { CalendarWebhookService } from "../services/calendar-webhook.service";
import { CalendarEventDetectionService } from "../services/calendar-event-detection.service";

@Controller("api/webhook/google/calendar")
export class CalendarWebhookController {
  private readonly logger = new Logger(CalendarWebhookController.name);

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly calendarWebhookService: CalendarWebhookService,
    private readonly eventDetectionService: CalendarEventDetectionService,
  ) {}

  /**
   * 🚀 Handle Google Calendar webhook notifications
   * Following Google Calendar API push notification guide
   */
  @Post()
  async handleGoogleWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log("📡 Received Google Calendar webhook notification");
    
    // TEMPORARILY DISABLED FOR TESTING PURE MEETING ANALYSIS
    this.logger.log("⚠️ Webhook processing is temporarily disabled - focusing on meeting analysis only");
    res.status(HttpStatus.OK).send("Webhook disabled during testing");
    return;

    /* COMMENTED OUT FOR TESTING
    try {
      // Extract notification data from headers (Google sends data in headers, not body)
      const notification: GoogleWebhookNotification = {
        channelId: headers["x-goog-channel-id"] || "",
        resourceId: headers["x-goog-resource-id"] || "",
        resourceUri: headers["x-goog-resource-uri"] || "",
        resourceState: (headers["x-goog-resource-state"] || "exists") as
          | "sync"
          | "exists"
          | "not_exists",
        messageNumber: headers["x-goog-message-number"] || "1",
        token: headers["x-goog-channel-token"],
        expiration: headers["x-goog-channel-expiration"],
      };

      this.logger.log(
        `📋 Processing webhook - Channel: ${notification.channelId}, State: ${notification.resourceState}`,
      );

      // Validate required headers
      if (!notification.channelId || !notification.resourceId) {
        this.logger.error("❌ Missing required webhook headers");
        res.status(HttpStatus.BAD_REQUEST).send("Missing required headers");
        return;
      }

      // Step 1: Process webhook through GoogleCalendarService to get changed events
      const result =
        await this.googleCalendarService.processWebhookNotification(
          notification,
        );
      this.logger.log(
        `✅ Found ${result.eventsChanged.length} changed events for user ${result.userId}`,
      );

      // Step 2: Use CalendarWebhookService to handle the notification properly
      await this.calendarWebhookService.handleGoogleWebhook({
        kind: "api#channel",
        id: notification.channelId,
        resourceId: notification.resourceId,
        resourceUri: notification.resourceUri,
        token: notification.token,
        expiration: notification.expiration,
        type: "sync",
      });

      // Step 3: Process event changes through detection service
      if (result.eventsChanged.length > 0) {
        await this.eventDetectionService.processEventChanges(
          result.userId,
          result.eventsChanged,
        );
      }

      // Google expects us to respond with 200-level status to indicate success
      res.status(HttpStatus.OK).send("OK");
    } catch (error) {
      this.logger.error(
        `❌ Error processing Google webhook: ${error.message}`,
        error.stack,
      );

      // Return error status - Google will retry on 500-level errors
      if (
        error.message.includes("authentication") ||
        error.message.includes("token")
      ) {
        res.status(HttpStatus.UNAUTHORIZED).send("Authentication failed");
      } else {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send("Internal server error");
      }
    }
    */ 
  }

  /**
   * 🚀 Handle webhook verification (for initial setup)
   * Google may send verification requests during channel setup
   */
  @Post("verify")
  async verifyGoogleWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log("🔍 Received Google Calendar webhook verification request");

    try {
      // Extract channel information
      const channelId = headers["x-goog-channel-id"];
      const token = headers["x-goog-channel-token"];

      this.logger.log(
        `Verifying channel: ${channelId} with token: ${token ? "Present" : "Missing"}`,
      );

      // In a production environment, you might want to validate the token
      // against your stored channel configurations

      // Respond with success to complete verification
      res.status(HttpStatus.OK).send("Webhook verified successfully");
    } catch (error) {
      this.logger.error(
        `❌ Error verifying Google webhook: ${error.message}`,
        error.stack,
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("Verification failed");
    }
  }

  /**
   * 🚀 Health check endpoint for webhook connectivity
   */
  @Post("health")
  async healthCheck(@Res() res: Response): Promise<void> {
    this.logger.log("🏥 Webhook health check requested");

    res.status(HttpStatus.OK).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "calendar-webhook",
      endpoints: {
        webhook: "/api/webhook/google/calendar",
        verify: "/api/webhook/google/calendar/verify",
        health: "/api/webhook/google/calendar/health",
      },
    });
  }
}
