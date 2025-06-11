import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { EventEmitterModule } from "@nestjs/event-emitter";

// Import only the database and storage modules that don't have complex dependencies
import { DatabaseModule } from "../database/database.module";
import { StorageModule } from "../storage/storage.module";

// Import all service classes directly instead of their modules
import { LlmService } from "../langgraph/llm/llm.service";
import { StateService } from "../langgraph/state/state.service";
import { StateStorageService } from "../langgraph/persistence/state-storage.service";
import { EmbeddingService } from "../embedding/embedding.service";
import { DocumentProcessorService } from "../embedding/document-processor.service";
import { PineconeService } from "../pinecone/pinecone.service";
import { PineconeConnectionService } from "../pinecone/pinecone-connection.service";
import { PineconeIndexService } from "../pinecone/pinecone-index.service";
import { PineconeConfigService } from "../pinecone/pinecone-config.service";
import { PineconeInitializer } from "../pinecone/initialize-indexes";

// Chunking and semantic services
import { ChunkingService } from "../embedding/chunking.service";
import { SemanticChunkingService } from "../embedding/semantic-chunking.service";
import { SentenceParserService } from "../embedding/sentence-parser.service";
import { SimilarityUtilsService } from "../embedding/similarity-utils.service";
import { ChunkOptimizationService } from "../embedding/chunk-optimization.service";

// LanggraphCore services - REMOVED TeamHandlerRegistry (use LanggraphCoreModule instead)
import { GraphExecutionService } from "../langgraph/core/graph-execution.service";

// Agent services
import { AgentFactory } from "../langgraph/agents/agent.factory";

// Shared agents only
import { MasterSupervisorAgent } from "../langgraph/agents/master-supervisor.agent";

// RAG Services
import { RetrievalService } from "../rag/retrieval.service";
import { RagService } from "../rag/rag.service";
import { AdaptiveRagService } from "../rag/adaptive-rag.service";

// Injection tokens
import { LLM_SERVICE } from "../langgraph/llm/constants/injection-tokens";
import { STATE_SERVICE } from "../langgraph/state/constants/injection-tokens";
import {
  RAG_SERVICE,
  RETRIEVAL_SERVICE,
  ADAPTIVE_RAG_SERVICE,
} from "../rag/constants/injection-tokens";
import {
  PINECONE_CONNECTION_SERVICE,
  PINECONE_SERVICE,
} from "../pinecone/constants/injection-tokens";
import { EMBEDDING_SERVICE } from "../embedding";

import { DimensionAdapterService } from "../embedding/dimension-adapter.service";
import { OpenAIService } from "../embedding/openai.service";

/**
 * SharedCoreModule - Directly provides ALL shared services
 * This eliminates circular dependencies by being the single source of truth
 * No more complex module re-exports or dependency chains
 * UPDATED: Removed TeamHandlerRegistry - use LanggraphCoreModule instead
 */
@Module({
  imports: [
    // Only import modules that don't cause circular dependencies
    ConfigModule,
    DatabaseModule,
    StorageModule,

    // Cache configuration
    CacheModule.register({
      ttl: 1800, // 30 minutes
      max: 100,
      isGlobal: true,
    }),

    // Event emitter for progress tracking
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ".",
      maxListeners: 100,
      verboseMemoryLeak: true,
    }),
  ],
  providers: [
    // Core infrastructure services
    LlmService,
    StateStorageService,
    StateService,
    EmbeddingService,

    // Pinecone services (in order of dependencies)
    PineconeConfigService,
    PineconeConnectionService,
    PineconeIndexService,
    PineconeService,
    PineconeInitializer,
    DimensionAdapterService,
    OpenAIService,

    // Chunking and semantic services
    ChunkingService,
    SentenceParserService,
    SimilarityUtilsService,
    ChunkOptimizationService,
    SemanticChunkingService,
    DocumentProcessorService,

    // LanggraphCore services - REMOVED EnhancedGraphService (back to LanggraphCoreModule)
    GraphExecutionService,

    // Shared agents only
    MasterSupervisorAgent,

    // RAG Services
    RetrievalService,
    RagService,
    AdaptiveRagService,

    // Agent factory - depends on all the individual agents above
    AgentFactory,

    // Token-based providers for dependency injection
    {
      provide: LLM_SERVICE,
      useExisting: LlmService,
    },
    {
      provide: STATE_SERVICE,
      useExisting: StateService,
    },
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
    {
      provide: PINECONE_CONNECTION_SERVICE,
      useExisting: PineconeConnectionService,
    },
    {
      provide: PINECONE_SERVICE,
      useExisting: PineconeService,
    },
    {
      provide: EMBEDDING_SERVICE,
      useExisting: EmbeddingService,
    },
  ],
  exports: [
    // Export all imported infrastructure modules
    ConfigModule,
    DatabaseModule,
    StorageModule,
    CacheModule,
    EventEmitterModule,

    // Export core infrastructure services
    LlmService,
    StateStorageService,
    StateService,
    EmbeddingService,

    // Export Pinecone services
    PineconeConfigService,
    PineconeConnectionService,
    PineconeIndexService,
    PineconeService,
    DimensionAdapterService,
    OpenAIService,

    // Export chunking and semantic services
    ChunkingService,
    SentenceParserService,
    SimilarityUtilsService,
    ChunkOptimizationService,
    SemanticChunkingService,
    DocumentProcessorService,

    // Export LanggraphCore services - REMOVED EnhancedGraphService export
    GraphExecutionService,

    // Export agents
    // Shared agents only
    MasterSupervisorAgent,
    // RagMeetingAnalysisAgent,
    // RagTopicExtractionAgent,
    // RagSentimentAnalysisAgent,
    AgentFactory,

    // Export RAG services
    RetrievalService,
    RagService,
    AdaptiveRagService,

    // Export all injection tokens
    LLM_SERVICE,
    STATE_SERVICE,
    RAG_SERVICE,
    RETRIEVAL_SERVICE,
    ADAPTIVE_RAG_SERVICE,
  ],
})
export class SharedCoreModule {}
