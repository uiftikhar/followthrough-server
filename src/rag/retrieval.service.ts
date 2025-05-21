import { Injectable, Logger, Inject } from '@nestjs/common';
import { PineconeService } from '../pinecone/pinecone.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorIndexes } from '../pinecone/pinecone-index.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { IRetrievalService } from './interfaces/retrieval-service.interface';
import { RETRIEVAL_SERVICE } from './constants/injection-tokens';
import { PINECONE_SERVICE } from '../pinecone/constants/injection-tokens';
import { EMBEDDING_SERVICE } from '../embedding/constants/injection-tokens';

export interface RetrievedDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export interface RetrievalOptions {
  indexName?: VectorIndexes | string;
  namespace?: string;
  topK?: number;
  minScore?: number;
  filter?: Record<string, any>;
  useCaching?: boolean;
}

@Injectable()
export class RetrievalService implements IRetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    @Inject(PINECONE_SERVICE) private readonly pineconeService: PineconeService,
    @Inject(EMBEDDING_SERVICE)
    private readonly embeddingService: EmbeddingService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Retrieve documents similar to the query text
   */
  async retrieveDocuments(
    query: string,
    options: RetrievalOptions = {},
  ): Promise<RetrievedDocument[]> {
    const indexName = options.indexName || VectorIndexes.MEETING_ANALYSIS;
    const namespace = options.namespace || 'documents';
    const topK = options.topK || 5;
    const minScore = options.minScore || 0.7;
    const useCaching = options.useCaching !== false;

    // Check cache if enabled
    if (useCaching) {
      const cacheKey = this.generateCacheKey(
        query,
        indexName,
        namespace,
        options.filter,
      );
      const cachedResults =
        await this.cacheManager.get<RetrievedDocument[]>(cacheKey);

      if (cachedResults) {
        this.logger.debug(`Cache hit for query: ${query.substring(0, 30)}...`);
        return cachedResults;
      }
    }

    try {
      // Convert query to embedding
      const queryEmbedding =
        await this.embeddingService.generateEmbedding(query);

      // Retrieve similar vectors from Pinecone
      const results = await this.pineconeService.querySimilar(
        indexName,
        queryEmbedding,
        {
          topK,
          filter: options.filter,
          minScore,
          namespace,
          includeValues: false,
        },
      );

      // Map results to a more usable format, ensuring content is always a string
      const documents: RetrievedDocument[] = results.map((result) => ({
        id: result.id,
        content: String(result.metadata.content || ''),
        metadata: result.metadata,
        score: result.score,
      }));

      // Cache results if enabled
      if (useCaching && documents.length > 0) {
        const cacheKey = this.generateCacheKey(
          query,
          indexName,
          namespace,
          options.filter,
        );
        await this.cacheManager.set(cacheKey, documents);
      }

      return documents;
    } catch (error) {
      this.logger.error(`Error retrieving documents: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate cache key for retrieval
   */
  private generateCacheKey(
    query: string,
    indexName: string,
    namespace: string,
    filter?: Record<string, any>,
  ): string {
    const filterStr = filter ? JSON.stringify(filter) : '';
    const hash = crypto
      .createHash('md5')
      .update(`${query}:${indexName}:${namespace}:${filterStr}`)
      .digest('hex');

    return `retrieval:${hash}`;
  }

  /**
   * Hybrid search combining keyword and vector search
   */
  async hybridSearch(
    query: string,
    options: RetrievalOptions & {
      keywordWeight?: number;
      vectorWeight?: number;
    } = {},
  ): Promise<RetrievedDocument[]> {
    const keywordWeight = options.keywordWeight || 0.3;
    const vectorWeight = options.vectorWeight || 0.7;

    // Implement simple keyword matching
    const keywordResults = await this.keywordSearch(query, options);

    // Vector search
    const vectorResults = await this.retrieveDocuments(query, options);

    // Combine results with weighted scores
    const combinedResults = new Map<string, RetrievedDocument>();

    // Add keyword results with their score
    keywordResults.forEach((doc) => {
      combinedResults.set(doc.id, {
        ...doc,
        score: doc.score * keywordWeight,
      });
    });

    // Add or update with vector results
    vectorResults.forEach((doc) => {
      if (combinedResults.has(doc.id)) {
        const existing = combinedResults.get(doc.id)!;
        combinedResults.set(doc.id, {
          ...existing,
          score: existing.score + doc.score * vectorWeight,
        });
      } else {
        combinedResults.set(doc.id, {
          ...doc,
          score: doc.score * vectorWeight,
        });
      }
    });

    // Convert to array and sort by score
    return Array.from(combinedResults.values()).sort(
      (a, b) => b.score - a.score,
    );
  }

  /**
   * Simple keyword search (placeholder - would typically use a search engine like Elasticsearch)
   */
  public async keywordSearch(
    query: string,
    options: RetrievalOptions = {},
  ): Promise<RetrievedDocument[]> {
    // Extract keywords (simple implementation)
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .map((word) => word.replace(/[^\w]/g, ''));

    if (keywords.length === 0) {
      return [];
    }

    try {
      // Create a filter for keyword search in metadata
      const keywordFilter: Record<string, any> = {
        $or: keywords.map((keyword) => ({
          content: { $contains: keyword },
        })),
      };

      // Combine with existing filter if any
      const filter = options.filter
        ? { $and: [options.filter, keywordFilter] }
        : keywordFilter;

      // Use the vector service but with keyword filter
      const results = await this.pineconeService.querySimilar(
        options.indexName || VectorIndexes.MEETING_ANALYSIS,
        [], // Empty embedding for pure metadata filtering
        {
          topK: options.topK || 5,
          filter,
          namespace: options.namespace || 'documents',
          includeValues: false,
        },
      );

      // Score based on keyword matches, ensuring content is always a string
      return results.map((result) => {
        const content = String(result.metadata.content || '');
        const matchCount = keywords.reduce(
          (count, keyword) =>
            count + (content.toLowerCase().includes(keyword) ? 1 : 0),
          0,
        );

        return {
          id: result.id,
          content,
          metadata: result.metadata,
          score: matchCount / keywords.length, // Simple scoring metric
        };
      });
    } catch (error) {
      this.logger.error(`Error in keyword search: ${error.message}`);
      return [];
    }
  }
}
