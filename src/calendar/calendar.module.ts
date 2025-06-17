import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CalendarAgentFactory } from "./agents/calendar-agent.factory";
import { CalendarWorkflowService } from "./services/calendar-workflow.service";
import { CalendarSyncService } from "./services/calendar-sync.service";
import { CalendarWebhookService } from "./services/calendar-webhook.service";
import { BriefDeliveryService } from "./services/brief-delivery.service";
import { PostMeetingOrchestrationService } from "./services/post-meeting-orchestration.service";
import { CalendarEventDetectionService } from "./services/calendar-event-detection.service";
import { GoogleCalendarService } from "./services/google-calendar.service";

// Controllers
import { CalendarWebhookController } from "./controllers/calendar-webhook.controller";
import { CalendarWorkflowController } from "./controllers/calendar-workflow.controller";
import { CalendarAgentsModule } from "./agents/calendar-agents.module";
import { SharedCoreModule } from "src/shared/shared-core.module";
import { UnifiedWorkflowService } from "src/langgraph/unified-workflow.service";
import { TeamHandlerRegistry } from "src/langgraph/core/team-handler-registry.service";
import { GoogleOAuthService } from "src/integrations/google/services/google-oauth.service";
import { UserGoogleTokensRepository } from "src/database/repositories/user-google-tokens.repository";
import { TokenEncryptionService } from "src/integrations/google/services/token-encryption.service";
import { GoogleOAuthModule } from "src/integrations/google/google-oauth.module";
@Module({
  imports: [
    ConfigModule,
    CalendarAgentsModule,
    GoogleOAuthModule,
    SharedCoreModule,
  ],
  controllers: [CalendarWebhookController, CalendarWorkflowController],
  providers: [
    TeamHandlerRegistry,
    UnifiedWorkflowService,
    // GoogleOAuthService,
    // UserGoogleTokensRepository,
    // TokenEncryptionService,
    // UserGoogleTokensRepository,
    // Core services that exist
    CalendarAgentFactory,
    CalendarWorkflowService,
    CalendarSyncService,
    CalendarWebhookService,
    BriefDeliveryService,
    PostMeetingOrchestrationService,
    CalendarEventDetectionService,
    GoogleCalendarService,
  ],
  exports: [
    CalendarAgentFactory,
    CalendarWorkflowService,
    CalendarSyncService,
    CalendarWebhookService,
    BriefDeliveryService,
    PostMeetingOrchestrationService,
    CalendarEventDetectionService,
    GoogleCalendarService,
    CalendarAgentsModule,
  ],
})
export class CalendarModule {}
