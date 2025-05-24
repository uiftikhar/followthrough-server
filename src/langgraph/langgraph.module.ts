import { Module } from '@nestjs/common';
import { SharedCoreModule } from '../shared/shared-core.module';
import { MeetingAnalysisModule } from './meeting-analysis/meeting-analysis.module';
import { SupervisorGraphBuilder } from './supervisor/supervisor-graph.builder';
import { UnifiedWorkflowService } from './unified-workflow.service';

/**
 * LanggraphModule - Main module for agent-based workflows
 * Uses SharedCoreModule for ALL dependencies
 * Simplified architecture eliminates circular dependencies
 */
@Module({
  imports: [
    SharedCoreModule,           // Provides ALL services and agents
    MeetingAnalysisModule,      // Feature module for meeting analysis
  ],
  providers: [
    // Only feature-specific services that aren't shared
    SupervisorGraphBuilder,
    UnifiedWorkflowService,
  ],
  exports: [
    // Export shared core for other modules that might need it
    SharedCoreModule,
    
    // Export workflow service
    UnifiedWorkflowService,
    
    // Export graph builders
    SupervisorGraphBuilder,
    
    // Export feature modules
    MeetingAnalysisModule,
  ],
})
export class LanggraphModule {}
