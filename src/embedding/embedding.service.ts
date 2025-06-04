import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// import { LlmService } from '../langgraph/llm/llm.service';
import { Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import * as crypto from "crypto";
import OpenAI from "openai";
import { OpenAIEmbeddings } from "@langchain/openai";

export enum EmbeddingModel {
  OPENAI_ADA_002 = "text-embedding-ada-002",
  OPENAI_3_SMALL = "text-embedding-3-small",
  OPENAI_3_LARGE = "text-embedding-3-large",
  ANTHROPIC = "claude-3-embedding",
  LLAMA = "llama-text-embed-v2",
}

export interface EmbeddingOptions {
  model?: EmbeddingModel;
  batchSize?: number;
  dimensions?: number;
  normalized?: boolean;
  useCaching?: boolean;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Service for generating text embeddings
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly defaultModel: EmbeddingModel;
  private readonly defaultDimensions: number;
  private readonly openai: OpenAI;
  private readonly openaiEmbeddings: OpenAIEmbeddings;

  constructor(
    private readonly configService: ConfigService,
    // private readonly llmService: LlmService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // Use new separated configuration with backward compatibility
    this.defaultModel = this.configService.get<EmbeddingModel>(
      "OPENAI_EMBEDDING_MODEL",
      // Fallback to legacy EMBEDDING_MODEL if new one not set
      this.configService.get<EmbeddingModel>(
        "EMBEDDING_MODEL",
        EmbeddingModel.OPENAI_3_LARGE,
      ),
    );
    this.defaultDimensions = this.configService.get<number>(
      "OPENAI_EMBEDDING_DIMENSIONS",
      // Fallback to legacy EMBEDDING_DIMENSIONS if new one not set
      this.configService.get<number>("EMBEDDING_DIMENSIONS", 1024),
    );

    this.logger.log(
      `EmbeddingService initialized with model: ${this.defaultModel}, dimensions: ${this.defaultDimensions}`,
    );

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>("OPENAI_API_KEY"),
    });

    // Initialize LangChain OpenAI embeddings for more advanced features
    this.openaiEmbeddings = new OpenAIEmbeddings({
      openAIApiKey: this.configService.get<string>("OPENAI_API_KEY"),
      modelName: this.mapToSupportedModel(this.defaultModel),
      dimensions: this.defaultDimensions,
      timeout: 60000, // 60 second timeout
      maxRetries: 3,
    });

    this.logger.log(
      `OpenAI embeddings configured with model: ${this.mapToSupportedModel(this.defaultModel)}, dimensions: ${this.defaultDimensions}`,
    );
  }

  private getCallStack(skip = 0, depth = 1): string[] {
    let raw: string;
    if (typeof Error.captureStackTrace === "function") {
      const obj: { stack?: string } = {};
      // omit this helper frame
      Error.captureStackTrace(obj, this.getCallStack);
      raw = obj.stack!;
    } else {
      raw = new Error().stack!;
    }
    const lines = raw
      .split("\n")
      .slice(1) // drop the "Error" line
      .map((l) => l.trim());
    return lines.slice(skip, skip + depth);
  }

  private parseFrame(frameLine: string) {
    const match = /at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)$/.exec(frameLine);
    return match
      ? {
          functionName: match[1],
          file: match[2],
          line: +match[3],
          column: +match[4],
        }
      : null;
  }

  /**
   * Map potentially unsupported models to supported ones
   */
  private mapToSupportedModel(model: string): string {
    if (model === EmbeddingModel.LLAMA) {
      const rawCaller = this.getCallStack(1, 1)[0];
      const info = this.parseFrame(rawCaller);
      if (info) {
        this.logger.warn(
          `*********************** mapToSupportedModel was called by ***********************: \n ${info.functionName} ` +
            `at ${info.file}:${info.line}:${info.column}`,
        );
      }
      this.logger.warn(
        `Mapping unsupported model ${model} to ${EmbeddingModel.OPENAI_3_LARGE}`,
      );
      return EmbeddingModel.OPENAI_3_LARGE;
    }
    return model;
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(
    text: string,
    options: EmbeddingOptions = {},
  ): Promise<number[]> {
    const requestedModel = options.model || this.defaultModel;
    const model = this.mapToSupportedModel(requestedModel);
    const useCaching = options.useCaching !== false; // Default to true

    // Check cache first if caching is enabled
    if (useCaching) {
      const cacheKey = this.generateCacheKey(text, model);
      const cachedEmbedding = await this.cacheManager.get<number[]>(cacheKey);

      if (cachedEmbedding) {
        this.logger.debug(
          `Cache hit for embedding: ${cacheKey.substring(0, 20)}...`,
        );
        return cachedEmbedding;
      }
    }

    try {
      // Generate embedding based on model
      let embedding: number[];

      // For better reliability, use LangChain's OpenAI embeddings
      if (
        model === EmbeddingModel.OPENAI_ADA_002 ||
        model === EmbeddingModel.OPENAI_3_SMALL ||
        model === EmbeddingModel.OPENAI_3_LARGE
      ) {
        // Use LangChain's embeddings which handle batching, retries, etc.
        const result = await this.openaiEmbeddings.embedQuery(text);
        embedding = result;
      } else {
        // Fallback to direct API calls for other models
        embedding = await this.generateDirectEmbedding(text, model);
      }

      // Normalize if requested
      if (options.normalized) {
        embedding = this.normalizeEmbedding(embedding);
      }

      // Cache the result
      if (useCaching) {
        const cacheKey = this.generateCacheKey(text, model);
        await this.cacheManager.set(cacheKey, embedding);
      }

      return embedding;
    } catch (error) {
      this.logger.error(
        `Error generating embedding for openaiEmbeddings: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Generate embeddings directly through API calls
   */
  private async generateDirectEmbedding(
    text: string,
    model: string,
  ): Promise<number[]> {
    if (model.startsWith("text-embedding")) {
      // OpenAI embedding
      const response = await this.openai.embeddings.create({
        model,
        input: text,
      });

      return response.data[0].embedding;
    } else if (model === EmbeddingModel.ANTHROPIC) {
      throw new Error("Anthropic embedding API not yet implemented");
    } else if (model === EmbeddingModel.LLAMA) {
      // Fallback to OpenAI 3 Large for Llama embedding requests
      const response = await this.openai.embeddings.create({
        model: EmbeddingModel.OPENAI_3_LARGE,
        input: text,
      });
      return response.data[0].embedding;
    } else {
      throw new Error(`Unsupported embedding model: ${model}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateEmbeddings(
    texts: string[],
    options: EmbeddingOptions = {},
  ): Promise<number[][]> {
    const batchSize = options.batchSize || 20; // Default batch size
    const model = options.model || this.defaultModel;

    // For OpenAI models, use LangChain's efficient batching
    if (
      model === EmbeddingModel.OPENAI_ADA_002 ||
      model === EmbeddingModel.OPENAI_3_SMALL ||
      model === EmbeddingModel.OPENAI_3_LARGE
    ) {
      // Use LangChain's embeddings which handles batching efficiently
      try {
        // Check cache for all texts
        if (options.useCaching !== false) {
          const cachedResults: (number[] | null)[] = await Promise.all(
            texts.map(async (text) => {
              const cacheKey = this.generateCacheKey(text, model);
              return await this.cacheManager.get<number[]>(cacheKey);
            }),
          );

          // If all texts are cached, return early
          if (cachedResults.every((result) => result !== null)) {
            return cachedResults;
          }

          // Filter out texts that need embedding
          const textsToEmbed: string[] = [];
          const indexMap: number[] = [];

          texts.forEach((text, i) => {
            if (cachedResults[i] === null) {
              textsToEmbed.push(text);
              indexMap.push(i);
            }
          });

          // Generate embeddings for missing texts
          const embeddings =
            await this.openaiEmbeddings.embedDocuments(textsToEmbed);

          // Combine cached and new embeddings
          const result: number[][] = [...cachedResults] as number[][];

          // Replace null values with new embeddings
          indexMap.forEach((originalIndex, newIndex) => {
            result[originalIndex] = embeddings[newIndex];

            // Cache the new embedding
            if (options.useCaching !== false) {
              const cacheKey = this.generateCacheKey(
                texts[originalIndex],
                model,
              );
              this.cacheManager.set(cacheKey, embeddings[newIndex]);
            }
          });

          return result;
        } else {
          // If caching is disabled, generate all embeddings
          return await this.openaiEmbeddings.embedDocuments(texts);
        }
      } catch (error) {
        this.logger.error(
          `Error batch embedding with LangChain: ${error.message}`,
        );
        throw error;
      }
    }

    // For other models, manually batch
    const batches: string[][] = [];

    // Split into batches
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }

    // Process batches
    const embeddings: number[][] = [];

    for (const batch of batches) {
      const batchEmbeddings = await Promise.all(
        batch.map((text) => this.generateEmbedding(text, options)),
      );
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Normalize an embedding vector to unit length
   */
  private normalizeEmbedding(embedding: number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / norm);
  }

  /**
   * Generate a cache key for an embedding
   */
  private generateCacheKey(text: string, model: string): string {
    // Hash the text to create a deterministic key
    const hash = crypto.createHash("sha256").update(text).digest("hex");

    return `embedding:${model}:${hash}`;
  }

  /**
   * Calculate similarity between two embeddings using cosine similarity
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    // Ensure embeddings have the same dimensionality
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same dimensions");
    }

    // Calculate dot product
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    // Prevent division by zero
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    // Return cosine similarity
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}
