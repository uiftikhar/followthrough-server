import { Module, OnModuleInit } from '@nestjs/common';
import { SharedCoreModule } from '../shared/shared-core.module';
import { LanggraphCoreModule } from '../langgraph/core/core.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { GoogleOAuthModule } from '../integrations/google/google-oauth.module';
import { CalendarAgentsModule } from './agents/calendar-agents.module';
import { CalendarWorkflowService } from './services/calendar-workflow.service';
import { CalendarWorkflowController } from './controllers/calendar-workflow.controller';
import { CalendarSyncService } from './services/calendar-sync.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { CalendarWebhookService } from './services/calendar-webhook.service';
import { CalendarWorkflowGraphBuilder } from './builders/calendar-workflow-graph.builder';
import { TeamHandlerRegistry } from '../langgraph/core/team-handler-registry.service';
import { UnifiedWorkflowService } from '../langgraph/unified-workflow.service';
import { BriefDeliveryService } from './services/brief-delivery.service';
import { PostMeetingOrchestrationService } from './services/post-meeting-orchestration.service';

@Module({
  imports: [
    SharedCoreModule,
    LanggraphCoreModule,
    InfrastructureModule,
    GoogleOAuthModule,
    CalendarAgentsModule, // Provides calendar-specific agents
  ],
  providers: [
    CalendarWorkflowService,
    CalendarSyncService,
    GoogleCalendarService,
        CalendarWebhookService,
    CalendarWorkflowGraphBuilder,
    UnifiedWorkflowService,
    BriefDeliveryService,
    PostMeetingOrchestrationService
  ],
  controllers: [CalendarWorkflowController],
  exports: [
    CalendarWorkflowService,
    CalendarSyncService,
    GoogleCalendarService,
  ],
})
export class CalendarModule implements OnModuleInit {
  constructor(
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
    private readonly calendarWorkflowService: CalendarWorkflowService,
    private readonly postMeetingOrchestrationService: PostMeetingOrchestrationService,
  ) {}

  async onModuleInit() {
    // Register calendar workflow as a team handler
    this.teamHandlerRegistry.registerHandler(
      'calendar_workflow',
      this.calendarWorkflowService,
    );

    // Register post-meeting orchestration as a team handler
    this.teamHandlerRegistry.registerHandler(
      'post_meeting_orchestration',
      this.postMeetingOrchestrationService,
    );
  }
} 