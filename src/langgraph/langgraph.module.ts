import { Module } from '@nestjs/common';
import { LanggraphCoreModule } from './core/core.module';
import { MeetingAnalysisGraphBuilder } from './meeting-analysis/meeting-analysis-graph.builder';
import { SupervisorGraphBuilder } from './supervisor/supervisor-graph.builder';
import { UnifiedWorkflowService } from './unified-workflow.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from './llm/llm.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AgentsModule } from './agents/agents.module';

@Module({
  imports: [
    LanggraphCoreModule,
    EmbeddingModule,
    DatabaseModule,
    LlmModule,
    AgentsModule,
    EventEmitterModule.forRoot({
      // Configure event emitter for progress tracking
      wildcard: true,
      delimiter: '.',
      maxListeners: 100,
      verboseMemoryLeak: true,
    }),
  ],
  providers: [
    // Graph builders
    MeetingAnalysisGraphBuilder,
    SupervisorGraphBuilder,
    
    // Workflow service
    UnifiedWorkflowService,
  ],
  exports: [
    // Export core module instead of individual services
    LanggraphCoreModule,
    
    // Export workflow service
    UnifiedWorkflowService,
    
    // Export graph builders
    MeetingAnalysisGraphBuilder,
    SupervisorGraphBuilder,
  ],
})
export class LanggraphModule {}
