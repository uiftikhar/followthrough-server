import { Module } from "@nestjs/common";
import { SharedCoreModule } from "../shared/shared-core.module";
import { LanggraphCoreModule } from "./core/core.module";
import { MeetingAnalysisModule } from "./meeting-analysis/meeting-analysis.module";
import { SupervisorGraphBuilder } from "./supervisor/supervisor-graph.builder";
import { UnifiedWorkflowService } from "./unified-workflow.service";

/**
 * LanggraphModule - Main module for agent-based workflows
 * Uses SharedCoreModule for ALL agents and RAG services
 * Uses LanggraphCoreModule for TeamHandlerRegistry and graph execution
 * Simplified architecture eliminates circular dependencies
 */
@Module({
  imports: [
    SharedCoreModule, // Provides ALL agents, RAG services, and OpenAIService
    LanggraphCoreModule, // Provides TeamHandlerRegistry, GraphExecutionService, EnhancedGraphService
    MeetingAnalysisModule, // Feature module for meeting analysis
  ],
  providers: [
    // Only feature-specific services that aren't shared
    SupervisorGraphBuilder, // Now has access to both OpenAIService and TeamHandlerRegistry
    UnifiedWorkflowService,
  ],
  exports: [
    // Export shared core for other modules that might need it
    SharedCoreModule,

    // Export core services for workflow coordination
    LanggraphCoreModule,

    // Export workflow service
    UnifiedWorkflowService,

    // Export graph builders
    SupervisorGraphBuilder,

    // Export feature modules
    MeetingAnalysisModule,
  ],
})
export class LanggraphModule {}
