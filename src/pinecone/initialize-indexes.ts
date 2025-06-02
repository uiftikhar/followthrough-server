import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PineconeService } from "./pinecone.service";
import { VectorIndexes, IndexConfig } from "./pinecone-index.service";
import { ConfigService } from "@nestjs/config";
import { ServerlessSpecCloudEnum } from "@pinecone-database/pinecone";

@Injectable()
export class PineconeInitializer implements OnModuleInit {
  private readonly logger = new Logger(PineconeInitializer.name);

  constructor(
    private readonly pineconeService: PineconeService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log("Initializing Pinecone indexes...");

    // Get dimensions from config to match embedding model
    const dimensions = this.configService.get<number>(
      "PINECONE_DIMENSIONS",
      1024,
    );

    // Get Pinecone-specific embedding model (used for index metadata only)
    const pineconeEmbeddingModel = this.configService.get<string>(
      "PINECONE_EMBEDDING_MODEL",
      // Fallback to legacy EMBEDDING_MODEL if new one not set
      this.configService.get<string>("EMBEDDING_MODEL", "text-embedding-3-large")
    );

    // Get OpenAI embedding model (used for actual embedding generation)
    const openaiEmbeddingModel = this.configService.get<string>(
      "OPENAI_EMBEDDING_MODEL",
      this.configService.get<string>("EMBEDDING_MODEL", "text-embedding-3-large")
    );

    this.logger.log(
      `📊 Embedding Configuration:
      - OpenAI Embedding Model (for generation): ${openaiEmbeddingModel}
      - Pinecone Index Model (for metadata): ${pineconeEmbeddingModel}
      - Dimensions: ${dimensions}`
    );

    // Common configuration for all indexes
    const baseConfig: IndexConfig = {
      dimension: dimensions, // Explicitly set dimension
      metric: "cosine",
      embeddingModel: pineconeEmbeddingModel as any,
      serverless: true,
      cloud:
        this.configService.get<ServerlessSpecCloudEnum>("PINECONE_CLOUD") ||
        "aws",
      region: this.configService.get<string>("PINECONE_REGION") || "us-west-2",
      tags: { project: "followthrough-ai" },
    };

    this.logger.log(
      `🔧 Configuring indexes with ${dimensions} dimensions for FollowThrough AI`,
    );

    try {
      // Initialize both meeting analysis and email triage indexes
      await this.pineconeService.initializeIndexes([
        {
          name: VectorIndexes.MEETING_ANALYSIS,
          config: {
            ...baseConfig,
            tags: { ...baseConfig.tags, domain: "meetings" },
          },
        },
        {
          name: VectorIndexes.EMAIL_TRIAGE,
          config: {
            ...baseConfig,
            tags: { ...baseConfig.tags, domain: "email" },
          },
        },
      ]);
      this.logger.log("✅ All Pinecone indexes initialized successfully");
    } catch (error) {
      this.logger.error("❌ Failed to initialize Pinecone indexes", error.stack);
    }
  }
}
