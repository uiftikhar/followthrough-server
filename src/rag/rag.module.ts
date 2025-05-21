import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PineconeModule } from '../pinecone/pinecone.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { LlmModule } from '../langgraph/llm/llm.module';
import { CacheModule } from '@nestjs/cache-manager';
import { StateModule } from '../langgraph/state/state.module';
import { MeetingAnalysisModule } from '../langgraph/meeting-analysis/meeting-analysis.module';
import { GraphModule } from '../langgraph/graph/graph.module';
import { AdaptiveRagService } from './adaptive-rag.service';
import { RetrievalService } from './retrieval.service';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import {
  RAG_SERVICE,
  RETRIEVAL_SERVICE,
  ADAPTIVE_RAG_SERVICE,
} from './constants/injection-tokens';

@Module({
  imports: [
    ConfigModule,
    PineconeModule,
    EmbeddingModule,
    LlmModule,
    StateModule,
    MeetingAnalysisModule,
    GraphModule,
    CacheModule.register({
      ttl: 1800, // 30 minutes
      max: 100,
    }),
  ],
  controllers: [RagController],
  providers: [
    // Service implementations
    RetrievalService,
    RagService,
    AdaptiveRagService,

    // Token-based providers for dependency injection
    {
      provide: RETRIEVAL_SERVICE,
      useClass: RetrievalService,
    },
    {
      provide: RAG_SERVICE,
      useClass: RagService,
    },
    {
      provide: ADAPTIVE_RAG_SERVICE,
      useExisting: AdaptiveRagService,
    },
  ],
  exports: [
    // Export both concrete implementations and tokens
    RetrievalService,
    RagService,
    AdaptiveRagService,
    RETRIEVAL_SERVICE,
    RAG_SERVICE,
    ADAPTIVE_RAG_SERVICE,
  ],
})
export class RagModule {}
