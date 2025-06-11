import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { LlmModule } from "../llm/llm.module";
import { VectorModule } from "../vector/vector.module";

// Core RAG Services
import { RagService } from "../rag/rag.service";
import { RetrievalService } from "../rag/retrieval.service";
import { AdaptiveRagService } from "../rag/adaptive-rag.service";

// Chunking Services
import { ChunkingService } from "../embedding/chunking.service";
import { SemanticChunkingService } from "../embedding/semantic-chunking.service";
import { SentenceParserService } from "../embedding/sentence-parser.service";
import { SimilarityUtilsService } from "../embedding/similarity-utils.service";
import { ChunkOptimizationService } from "../embedding/chunk-optimization.service";
import { DocumentProcessorService } from "../embedding/document-processor.service";

// Injection Tokens
import {
  RAG_SERVICE,
  RETRIEVAL_SERVICE,
  ADAPTIVE_RAG_SERVICE,
} from "../rag/constants/injection-tokens";
import {
  RAG_MEETING_ANALYSIS_CONFIG,
  RagMeetingAnalysisConfig,
} from "src/langgraph/agents/rag-agents/rag-meeting-agent";

/**
 * RagCoreModule - Platform Services Layer
 * Provides RAG and chunking services for enhanced retrieval
 * Part of Phase 2 migration from SharedCoreModule
 */
@Module({
  imports: [InfrastructureModule, LlmModule, VectorModule],
  providers: [
    // Core RAG Services
    RagService,
    RetrievalService,
    AdaptiveRagService,

    // Chunking Services
    ChunkingService,
    SemanticChunkingService,
    SentenceParserService,
    SimilarityUtilsService,
    ChunkOptimizationService,
    DocumentProcessorService,

    // Injection Tokens
    {
      provide: RAG_SERVICE,
      useExisting: RagService,
    },
    {
      provide: RETRIEVAL_SERVICE,
      useExisting: RetrievalService,
    },
    {
      provide: ADAPTIVE_RAG_SERVICE,
      useExisting: AdaptiveRagService,
    },
  ],
  exports: [
    RagService,
    RetrievalService,
    AdaptiveRagService,
    ChunkingService,
    SemanticChunkingService,
    SentenceParserService,
    SimilarityUtilsService,
    ChunkOptimizationService,
    DocumentProcessorService,
    RAG_SERVICE,
    RETRIEVAL_SERVICE,
    ADAPTIVE_RAG_SERVICE,
  ],
})
export class RagCoreModule {}
