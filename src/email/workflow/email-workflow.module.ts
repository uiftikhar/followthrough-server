import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module";
import { RagCoreModule } from "../../rag-core/rag-core.module";
import { WorkflowFrameworkModule } from "../../workflow-framework/workflow-framework.module";
import { EmailAgentsModule } from "../agents/email-agents.module";
import { SharedCoreModule } from "src/shared/shared-core.module";
// Email-specific workflow services
import { EmailTriageManager } from "./email-triage.manager";
import { EmailTriageService } from "./email-triage.service";

/**
 * EmailWorkflowModule - Application Services Layer
 * Provides email-specific workflow coordination services
 * Part of Phase 1-6 of email triage implementation
 * Follows same pattern as MeetingWorkflowModule
 * Updated to use pure LangGraph approach instead of graph builders
 */
@Module({
  imports: [
    InfrastructureModule, // For database access and events
    RagCoreModule, // For RAG services (future enhancement)
    WorkflowFrameworkModule, // For supervisor and graph execution
    EmailAgentsModule, // For email-specific agents
    SharedCoreModule,
  ],
  providers: [
    EmailTriageManager, // Coordinates the 3 workers
    EmailTriageService, // Team handler that registers with supervisor using LangGraph
  ],
  exports: [
    WorkflowFrameworkModule, // Re-export for controllers
    EmailAgentsModule, // Re-export for controllers to access agents
    EmailTriageManager,
    EmailTriageService,
  ],
})
export class EmailWorkflowModule {}
