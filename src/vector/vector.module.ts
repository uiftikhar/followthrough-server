import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";

// Pinecone Services
import { PineconeConfigService } from "../pinecone/pinecone-config.service";
import { PineconeConnectionService } from "../pinecone/pinecone-connection.service";
import { PineconeIndexService } from "../pinecone/pinecone-index.service";
import { PineconeService } from "../pinecone/pinecone.service";
import { PineconeInitializer } from "../pinecone/initialize-indexes";

// Embedding Services
import { EmbeddingService } from "../embedding/embedding.service";
import { DimensionAdapterService } from "../embedding/dimension-adapter.service";
import { OpenAIService } from "../embedding/openai.service";

// Injection Tokens
import {
  PINECONE_SERVICE,
  PINECONE_CONNECTION_SERVICE,
  PINECONE_INDEX_SERVICE,
} from "../pinecone/constants/injection-tokens";
import { EMBEDDING_SERVICE } from "../embedding/constants/injection-tokens";

/**
 * VectorModule - Core Services Layer
 * Provides Pinecone and Embedding services for vector operations
 * Part of Phase 1 migration from SharedCoreModule
 */
@Module({
  imports: [InfrastructureModule],
  providers: [
    // Pinecone Services
    PineconeConfigService,
    PineconeConnectionService,
    PineconeIndexService,
    PineconeService,
    PineconeInitializer,

    // Embedding Services
    EmbeddingService,
    DimensionAdapterService,
    OpenAIService,

    // Injection Tokens
    {
      provide: PINECONE_SERVICE,
      useExisting: PineconeService,
    },
    {
      provide: PINECONE_CONNECTION_SERVICE,
      useExisting: PineconeConnectionService,
    },
    {
      provide: PINECONE_INDEX_SERVICE,
      useExisting: PineconeIndexService,
    },
    {
      provide: EMBEDDING_SERVICE,
      useExisting: EmbeddingService,
    },
  ],
  exports: [
    PineconeService,
    PineconeConfigService,
    PineconeConnectionService,
    PineconeIndexService,
    EmbeddingService,
    DimensionAdapterService,
    OpenAIService,
    PINECONE_SERVICE,
    PINECONE_CONNECTION_SERVICE,
    PINECONE_INDEX_SERVICE,
    EMBEDDING_SERVICE,
  ],
})
export class VectorModule {}
