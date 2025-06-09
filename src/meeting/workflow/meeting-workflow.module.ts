import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module";
import { RagCoreModule } from "../../rag-core/rag-core.module";
import { WorkflowFrameworkModule } from "../../workflow-framework/workflow-framework.module";
import { MeetingAnalysisAgentsModule } from "../../langgraph/meeting-analysis/meeting-analysis-agents.module";

// Meeting-specific workflow services
import { MeetingAnalysisGraphBuilder } from "../../langgraph/meeting-analysis/meeting-analysis-graph.builder";
import { MeetingAnalysisService } from "../../langgraph/meeting-analysis/meeting-analysis.service";

/**
 * MeetingWorkflowModule - Application Services Layer
 * Provides meeting-specific workflow and graph building services
 * Uses the new domain-specific MeetingAnalysisAgentsModule for clean separation
 * No circular dependencies - each module has clear domain boundaries
 */
@Module({
  imports: [
    InfrastructureModule, // For SessionRepository
    RagCoreModule, // For RAG_SERVICE, DocumentProcessorService
    WorkflowFrameworkModule, // For UnifiedWorkflowService
    MeetingAnalysisAgentsModule, // For meeting analysis agents
  ],
  providers: [MeetingAnalysisGraphBuilder, MeetingAnalysisService],
  exports: [
    WorkflowFrameworkModule, // Re-export to provide UnifiedWorkflowService
    MeetingAnalysisGraphBuilder,
    MeetingAnalysisService,
  ],
})
export class MeetingWorkflowModule {}
