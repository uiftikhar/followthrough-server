import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangGraphPersistenceModule } from '../persistence/persistence.module';
import { LlmModule } from '../llm/llm.module';
import { StateModule } from '../state/state.module';
import { SharedCoreModule } from '../../shared/shared-core.module';
import { GoogleOAuthModule } from '../../integrations/google/google-oauth.module';

// Phase 1: Core Infrastructure
import { CalendarWorkflowService } from './services/calendar-workflow.service';
import { CalendarWorkflowController } from './controllers/calendar-workflow.controller';
import { CalendarWorkflowSessionRepository } from './repositories/calendar-workflow-session.repository';
import { PreMeetingContextAgent } from './agents/pre-meeting-context.agent';
import { MeetingBriefGenerationAgent } from './agents/meeting-brief-generation.agent';

// Enhanced Meeting Integration Services
import { GoogleMeetingTrackerService } from './services/google-meeting-tracker.service';
import { MeetingAnalysisTriggerService } from './services/meeting-analysis-trigger.service';
import { EnhancedGoogleOAuthService } from './services/enhanced-google-oauth.service';
import { CalendarWorkflowIntegrationService } from './services/calendar-workflow-integration.service';

@Module({
  imports: [
    ConfigModule,
    LangGraphPersistenceModule,
    LlmModule,
    StateModule,
    SharedCoreModule,
    GoogleOAuthModule, // Provides GoogleOAuthService
  ],
  providers: [
    // Phase 1: Core Infrastructure
    CalendarWorkflowService,
    CalendarWorkflowSessionRepository,
    PreMeetingContextAgent,
    MeetingBriefGenerationAgent,
    
    // Enhanced Meeting Integration
    GoogleMeetingTrackerService,
    MeetingAnalysisTriggerService,
    EnhancedGoogleOAuthService,
    CalendarWorkflowIntegrationService,
  ],
  controllers: [
    CalendarWorkflowController,
  ],
  exports: [
    // Export core services for use by other modules
    CalendarWorkflowService,
    CalendarWorkflowSessionRepository,
    PreMeetingContextAgent,
    MeetingBriefGenerationAgent,
    
    // Export enhanced services
    GoogleMeetingTrackerService,
    MeetingAnalysisTriggerService,
    EnhancedGoogleOAuthService,
    CalendarWorkflowIntegrationService,
  ],
})
export class CalendarWorkflowModule {} 