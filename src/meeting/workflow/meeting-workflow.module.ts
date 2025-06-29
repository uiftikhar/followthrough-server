import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module";
import { RagCoreModule } from "../../rag-core/rag-core.module";
import { WorkflowFrameworkModule } from "../../workflow-framework/workflow-framework.module";
import { MeetingAnalysisAgentsModule } from "../../langgraph/meeting-analysis/meeting-analysis-agents.module";
import { SharedCoreModule } from "src/shared/shared-core.module";
// Meeting-specific workflow services
import { MeetingAnalysisService } from "../../langgraph/meeting-analysis/meeting-analysis.service";

/**
 * MeetingWorkflowModule - Application Services Layer
 * Provides meeting-specific workflow services using pure LangGraph
 * Uses the new domain-specific MeetingAnalysisAgentsModule for clean separation
 * No circular dependencies - each module has clear domain boundaries
 * Updated to use LangGraph StateGraph instead of custom graph builders
 */
@Module({
  imports: [
    InfrastructureModule, // For SessionRepository
    RagCoreModule, // For RAG_SERVICE, DocumentProcessorService
    WorkflowFrameworkModule, // For UnifiedWorkflowService
    MeetingAnalysisAgentsModule, // For meeting analysis agents
    SharedCoreModule,
  ],
  providers: [MeetingAnalysisService],
  exports: [
    WorkflowFrameworkModule, // Re-export to provide UnifiedWorkflowService
    MeetingAnalysisService,
  ],
})
export class MeetingWorkflowModule {}
