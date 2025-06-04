import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";

// Import workflow services
import { LanggraphModule } from "../../langgraph/langgraph.module";

// Schemas
import {
  UserGoogleTokens,
  UserGoogleTokensSchema,
} from "../../database/schemas/user-google-tokens.schema";
import {
  GmailWatch,
  GmailWatchSchema,
} from "../../database/schemas/gmail-watch.schema";

// Repositories
import { UserGoogleTokensRepository } from "../../database/repositories/user-google-tokens.repository";
import { GmailWatchRepository } from "../../database/repositories/gmail-watch.repository";

// Services
import { TokenEncryptionService } from "./services/token-encryption.service";
import { GoogleOAuthService } from "./services/google-oauth.service";
import { GmailService } from "./services/gmail.service";
import { PubSubService } from "./services/pubsub.service";
import { GmailWatchService } from "./services/gmail-watch.service";
import { GmailBackgroundService } from "./services/gmail-background.service";
import { GmailShutdownService } from "./services/gmail-shutdown.service";
import { GmailNotificationService } from "./services/gmail-notification.service";

// Controllers
import { GoogleOAuthController } from "./controllers/google-oauth.controller";
import { GmailWebhookController } from "./controllers/gmail-webhook.controller";
import { GmailClientController } from "./controllers/gmail-client.controller";
import { GmailWatchController } from "./controllers/gmail-watch.controller";
import { GmailDebugController } from "./controllers/gmail-debug.controller";

// Guards
import { GoogleAuthGuard } from "./guards/google-auth.guard";

// WebSocket Gateway for real-time notifications
import { GmailNotificationGateway } from "./services/gmail-notification.gateway";

/**
 * GoogleOAuthModule - Server-side Google OAuth integration with Gmail Push Notifications
 *
 * This module provides:
 * - Secure token storage with encryption
 * - OAuth flow management (authorization, callback, refresh)
 * - Authenticated Google API client factory
 * - Gmail push notifications via Google Cloud Pub/Sub
 * - Gmail watch management and lifecycle
 * - Real-time email processing webhooks
 * - Background jobs for watch renewal and health monitoring
 * - Integration guards for protected routes
 *
 * Usage:
 * 1. Import this module in other feature modules
 * 2. Use GoogleOAuthService to get authenticated clients
 * 3. Use GmailService for Gmail API operations
 * 4. Use GmailWatchService for managing Gmail watches
 * 5. Use PubSubService for push notification handling
 * 6. Use GoogleAuthGuard to protect Google API endpoints
 * 7. Configure Gmail push notifications via endpoints
 * 8. Monitor system health and automatic renewals via GmailBackgroundService
 */
@Module({
  imports: [
    ConfigModule, // For Google OAuth and Pub/Sub configuration
    ScheduleModule.forRoot(), // For cron jobs and background tasks
    LanggraphModule, // For UnifiedWorkflowService integration
    MongooseModule.forFeature([
      { name: UserGoogleTokens.name, schema: UserGoogleTokensSchema },
      { name: GmailWatch.name, schema: GmailWatchSchema },
    ]),
  ],
  controllers: [
    GoogleOAuthController, // OAuth flow and Gmail watch management endpoints
    GmailWebhookController, // Gmail push notification webhooks
    GmailClientController, // Gmail client management endpoints
    GmailWatchController, // Gmail watch management endpoints
    GmailDebugController, // Debug and troubleshooting endpoints
  ],
  providers: [
    // Core services
    TokenEncryptionService,
    GoogleOAuthService,
    GmailService,
    PubSubService,
    GmailWatchService,
    GmailBackgroundService, // Background jobs and health monitoring
    GmailShutdownService, // Gmail shutdown service
    GmailNotificationService,

    // Real-time notifications
    GmailNotificationGateway, // WebSocket gateway for real-time client notifications

    // Repositories
    UserGoogleTokensRepository,
    GmailWatchRepository,

    // Guards
    GoogleAuthGuard,
  ],
  exports: [
    // Export services for use in other modules
    GoogleOAuthService,
    GmailService,
    GmailWatchService,
    PubSubService,
    GmailBackgroundService,
    GmailShutdownService,
    GmailNotificationService,
    GmailNotificationGateway, // Export gateway for use in other modules
    GoogleAuthGuard,
    UserGoogleTokensRepository,
    GmailWatchRepository,
    TokenEncryptionService,
  ],
})
export class GoogleOAuthModule {}
