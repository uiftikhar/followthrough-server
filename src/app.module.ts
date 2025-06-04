import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule as AppConfigModule } from "./config/config.module";
import { LoggingModule } from "./logging/logging.module";

// New modular architecture imports
import { InfrastructureModule } from "./infrastructure/infrastructure.module";
import { LlmModule } from "./llm/llm.module";
import { VectorModule } from "./vector/vector.module";
import { LanggraphCoreModule } from "./langgraph/core/core.module";
import { RagCoreModule } from "./rag-core/rag-core.module";
import { AgentFrameworkModule } from "./agent-framework/agent-framework.module";
import { WorkflowFrameworkModule } from "./workflow-framework/workflow-framework.module";
import { MeetingAgentsModule } from "./meeting/agents/meeting-agents.module";
import { MeetingWorkflowModule } from "./meeting/workflow/meeting-workflow.module";
import { MeetingAnalysisModule } from "./langgraph/meeting-analysis/meeting-analysis.module";

// Email modules - NEW
import { EmailAgentsModule } from "./email/agents/email-agents.module";
import { EmailWorkflowModule } from "./email/workflow/email-workflow.module";
import { EmailModule } from "./email/email.module";
import { GoogleOAuthModule } from "./integrations/google/google-oauth.module";

/**
 * AppModule - Root application module
 * Uses new modular architecture instead of SharedCoreModule
 * Phase 4 migration from SharedCoreModule completed
 * Includes LanggraphCoreModule for core graph services
 */
@Module({
  imports: [
    // Foundation Layer
    InfrastructureModule,

    // Core Services Layer
    LlmModule,
    VectorModule,

    // Platform Services Layer
    LanggraphCoreModule, // Core LangGraph services
    RagCoreModule,
    AgentFrameworkModule,
    WorkflowFrameworkModule,

    // Domain Services Layer
    MeetingAgentsModule,
    MeetingWorkflowModule,

    // Domain Services Layer - Email (NEW)
    EmailAgentsModule,
    EmailWorkflowModule,

    // Application Layer
    MeetingAnalysisModule,
    EmailModule, // NEW - Provides email triage endpoints

    // External modules
    AppConfigModule,
    LoggingModule,
    AuthModule,
    GoogleOAuthModule,

    // Future modules
    // EmailAgentsModule,
    // EmailWorkflowModule,
    // EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
