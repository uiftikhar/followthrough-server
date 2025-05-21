import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EmbeddingService } from './embedding.service';
import { ChunkingService } from './chunking.service';
import { DocumentProcessorService } from './document-processor.service';
import { PineconeModule } from '../pinecone/pinecone.module';
import {
  EMBEDDING_SERVICE,
  CHUNKING_SERVICE,
  DOCUMENT_PROCESSOR_SERVICE,
} from './constants/injection-tokens';
import { LlmModule } from '../langgraph/llm/llm.module';
import { DimensionAdapterService } from './dimension-adapter.service';
import { SemanticChunkingService } from './semantic-chunking.service';
import { SimilarityUtilsService } from './similarity-utils.service';
import { SentenceParserService } from './sentence-parser.service';
import { ChunkOptimizationService } from './chunk-optimization.service';

@Module({
  imports: [
    ConfigModule,
    LlmModule,
    PineconeModule,
    CacheModule.register({
      ttl: 60 * 60 * 1000, // 1 hour cache TTL
      max: 100, // Maximum number of items in cache
    }),
  ],
  providers: [
    EmbeddingService,
    ChunkingService,
    DocumentProcessorService,
    {
      provide: EMBEDDING_SERVICE,
      useClass: EmbeddingService,
    },
    {
      provide: CHUNKING_SERVICE,
      useExisting: ChunkingService,
    },
    {
      provide: DOCUMENT_PROCESSOR_SERVICE,
      useExisting: DocumentProcessorService,
    },
    DimensionAdapterService,
    SemanticChunkingService,
    SimilarityUtilsService,
    SentenceParserService,
    ChunkOptimizationService,
  ],
  exports: [
    EMBEDDING_SERVICE,
    CHUNKING_SERVICE,
    DOCUMENT_PROCESSOR_SERVICE,
    DimensionAdapterService,
    SemanticChunkingService,
    SimilarityUtilsService,
    SentenceParserService,
    ChunkOptimizationService,
  ],
})
export class EmbeddingModule {}
