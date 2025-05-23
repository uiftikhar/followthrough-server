import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MeetingAnalysisController } from './meeting-analysis.controller';
import { MeetingAnalysisService } from './meeting-analysis.service';
import { MeetingAnalysisGateway } from './meeting-analysis.gateway';
import { DatabaseModule } from '../../database/database.module';
import { AgentsModule } from '../agents/agents.module';
import { MeetingAnalysisGraphBuilder } from './meeting-analysis-graph.builder';
import { LlmModule } from '../llm/llm.module';
import { PineconeModule } from '../../pinecone/pinecone.module';
import { EmbeddingModule } from '../../embedding/embedding.module';
import { RagModule } from '../../rag/rag.module';
import { LanggraphCoreModule } from '../core/core.module';
import { UnifiedWorkflowService } from '../unified-workflow.service';

@Module({
  imports: [
    DatabaseModule,
    EventEmitterModule.forRoot(),
    LanggraphCoreModule,
    forwardRef(() => AgentsModule),
    LlmModule,
    PineconeModule,
    EmbeddingModule,
    forwardRef(() => RagModule),
  ],
  controllers: [MeetingAnalysisController],
  providers: [
    MeetingAnalysisService, 
    MeetingAnalysisGateway,
    MeetingAnalysisGraphBuilder,
    UnifiedWorkflowService,
  ],
  exports: [
    MeetingAnalysisService,
    MeetingAnalysisGraphBuilder,
  ],
})
export class MeetingAnalysisModule {}
