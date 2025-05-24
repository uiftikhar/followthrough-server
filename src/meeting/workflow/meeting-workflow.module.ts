import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { RagCoreModule } from '../../rag-core/rag-core.module';
import { WorkflowFrameworkModule } from '../../workflow-framework/workflow-framework.module';
import { MeetingAgentsModule } from '../agents/meeting-agents.module';

// Meeting-specific workflow services
import { MeetingAnalysisGraphBuilder } from '../../langgraph/meeting-analysis/meeting-analysis-graph.builder';
import { MeetingAnalysisService } from '../../langgraph/meeting-analysis/meeting-analysis.service';

/**
 * MeetingWorkflowModule - Application Services Layer
 * Provides meeting-specific workflow and graph building services
 * Part of Phase 3 migration from SharedCoreModule
 * Imports InfrastructureModule for database access and RagCoreModule for RAG services
 * Re-exports WorkflowFrameworkModule to provide UnifiedWorkflowService to controllers
 */
@Module({
  imports: [
    InfrastructureModule,     // For SessionRepository
    RagCoreModule,           // For RAG_SERVICE, DocumentProcessorService
    WorkflowFrameworkModule,
    MeetingAgentsModule,
  ],
  providers: [
    MeetingAnalysisGraphBuilder,
    MeetingAnalysisService,
  ],
  exports: [
    WorkflowFrameworkModule,  // Re-export to provide UnifiedWorkflowService
    MeetingAnalysisGraphBuilder,
    MeetingAnalysisService,
  ],
})
export class MeetingWorkflowModule {} 