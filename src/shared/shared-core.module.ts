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

// LanggraphCore services
import { GraphExecutionService } from "../langgraph/core/graph-execution.service";
import { TeamHandlerRegistry } from "../langgraph/core/team-handler-registry.service";
import { EnhancedGraphService } from "../langgraph/core/enhanced-graph.service";

// Agent services
import { AgentFactory } from "../langgraph/agents/agent.factory";
import { TopicExtractionAgent } from "../langgraph/agents/topic-extraction.agent";
import { ActionItemAgent } from "../langgraph/agents/action-item.agent";
import { SentimentAnalysisAgent } from "../langgraph/agents/sentiment-analysis.agent";
import { SummaryAgent } from "../langgraph/agents/summary.agent";
import { ParticipationAgent } from "../langgraph/agents/participation.agent";
import { ContextIntegrationAgent } from "../langgraph/agents/context-integration.agent";
import { MasterSupervisorAgent } from "../langgraph/agents/master-supervisor.agent";

// RAG Services
import { RetrievalService } from "../rag/retrieval.service";
import { RagService } from "../rag/rag.service";
import { AdaptiveRagService } from "../rag/adaptive-rag.service";

// RAG Agents and their configs
import {
  RagMeetingAnalysisAgent,
  RAG_MEETING_ANALYSIS_CONFIG,
  RagMeetingAnalysisConfig,
} from "../langgraph/agents/rag-agents/rag-meeting-agent";
import {
  RagTopicExtractionAgent,
  RAG_TOPIC_EXTRACTION_CONFIG,
  RagTopicExtractionConfig,
} from "../langgraph/agents/rag-agents/rag-topic-extraction-agent";
import {
  RagSentimentAnalysisAgent,
  RAG_SENTIMENT_ANALYSIS_CONFIG,
  RagSentimentAnalysisConfig,
} from "../langgraph/agents/rag-agents/rag-sentiment-analysis-agent";
import { AgentExpertise } from "../rag/agents/rag-enhanced-agent";
import {
  MEETING_CHUNK_ANALYSIS_PROMPT,
  EXTRACT_ACTION_ITEMS_PROMPT,
  SENTIMENT_ANALYSIS_PROMPT,
  FINAL_MEETING_SUMMARY_PROMPT,
  TOPIC_EXTRACTION_SYSTEM_PROMPT,
} from "../instruction-promtps";

// Injection tokens
import {
  RAG_SERVICE,
  RETRIEVAL_SERVICE,
  ADAPTIVE_RAG_SERVICE,
} from "../rag/constants/injection-tokens";
import { LLM_SERVICE } from "../langgraph/llm/constants/injection-tokens";
import { STATE_SERVICE } from "../langgraph/state/constants/injection-tokens";
import {
  PINECONE_CONNECTION_SERVICE,
  PINECONE_SERVICE,
} from "src/pinecone/constants/injection-tokens";
import { EMBEDDING_SERVICE } from "src/embedding";
import { DimensionAdapterService } from "src/embedding/dimension-adapter.service";
import { OpenAIService } from "src/embedding/openai.service";
import { GoogleOAuthModule } from "src/integrations/google/google-oauth.module";

/**
 * SharedCoreModule - Directly provides ALL shared services
 * This eliminates circular dependencies by being the single source of truth
 * No more complex module re-exports or dependency chains
 */
@Module({
  imports: [
    // Only import modules that don't cause circular dependencies
    ConfigModule,
    DatabaseModule,
    StorageModule,

    GoogleOAuthModule,

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

    // LanggraphCore services
    GraphExecutionService,
    TeamHandlerRegistry,
    EnhancedGraphService,

    // Individual agents
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,
    MasterSupervisorAgent,

    // RAG Services
    RetrievalService,
    RagService,
    AdaptiveRagService,

    // RAG Agents configuration
    {
      provide: RAG_MEETING_ANALYSIS_CONFIG,
      useFactory: (): RagMeetingAnalysisConfig => ({
        name: "Meeting Summary Agent",
        systemPrompt:
          "You are an AI assistant specialized in generating comprehensive meeting summaries through chunking and analysis.",
        chunkSize: 4000, // Size for chunking large transcripts
        chunkOverlap: 200, // Overlap between chunks
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: "meeting-analysis",
            namespace: "summaries", // Focus on summary-related context
            topK: 3,
            minScore: 0.7,
          },
        },
      }),
    },
    {
      provide: RAG_TOPIC_EXTRACTION_CONFIG,
      useFactory: (): RagTopicExtractionConfig => ({
        name: "Topic Extraction Agent",
        systemPrompt: TOPIC_EXTRACTION_SYSTEM_PROMPT,
        expertise: [AgentExpertise.TOPIC_ANALYSIS],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: "meeting-analysis",
            namespace: "topics",
            topK: 5,
            minScore: 0.7,
          },
        },
        specializedQueries: {
          [AgentExpertise.TOPIC_ANALYSIS]:
            "Extract all topics discussed in this meeting transcript, including their relevance, subtopics, and participating speakers.",
        },
      }),
    },
    {
      provide: RAG_SENTIMENT_ANALYSIS_CONFIG,
      useFactory: (): RagSentimentAnalysisConfig => ({
        name: "Sentiment Analysis Agent",
        systemPrompt: SENTIMENT_ANALYSIS_PROMPT,
        expertise: [AgentExpertise.SENTIMENT_ANALYSIS],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: "meeting-analysis",
            namespace: "sentiment-analysis",
            topK: 3,
            minScore: 0.7,
          },
        },
        specializedQueries: {
          [AgentExpertise.SENTIMENT_ANALYSIS]:
            "Analyze the sentiment of the meeting transcript, including emotional tone, speaker engagement, and sentiment shifts throughout the discussion.",
        },
      }),
    },

    // RAG Agents
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
    RagSentimentAnalysisAgent,

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

    // Export LanggraphCore services
    GraphExecutionService,
    TeamHandlerRegistry,
    EnhancedGraphService,

    // Export agents
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,
    MasterSupervisorAgent,
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
    RagSentimentAnalysisAgent,
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
