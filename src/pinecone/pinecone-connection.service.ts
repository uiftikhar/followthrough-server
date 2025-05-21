import { Injectable, Logger } from '@nestjs/common';
import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';
import { PineconeConfigService } from './pinecone-config.service';
import { VectorRecord, QueryOptions, UpsertOptions } from './pinecone.types';

@Injectable()
export class PineconeConnectionService {
  private pinecone: Pinecone;
  private readonly logger = new Logger(PineconeConnectionService.name);

  constructor(
    private configService: ConfigService,
    private pineconeConfigService: PineconeConfigService,
  ) {
    this.pinecone = this.pineconeConfigService.getPinecone();
  }

  /**
   * Query vectors in an index
   */
  async queryVectors<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    vector: number[],
    options: QueryOptions,
    namespace: string = '',
  ) {
    try {
      const index = this.pinecone.index(indexName);
      const response = await index.namespace(namespace).query({
        vector,
        topK: options.topK || 10,
        filter: options.filter,
        includeMetadata: options.includeMetadata || true,
        includeValues: options.includeValues || false,
      });
      return response;
    } catch (error) {
      this.logger.error(
        `Error querying vectors in ${indexName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Upsert vectors into an index
   */
  async upsertVectors<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    vectors: VectorRecord<T>[],
    namespace: string = '',
    options?: UpsertOptions,
  ) {
    try {
      const index = this.pinecone.index(indexName);

      // Default options
      const batchSize = options?.batchSize || 100;
      const concurrency = options?.concurrency || 5;

      // Batch processing for large vector sets
      if (vectors.length <= batchSize) {
        await index.namespace(namespace).upsert(vectors);
      } else {
        // Process in batches
        const batches: VectorRecord<T>[][] = [];
        for (let i = 0; i < vectors.length; i += batchSize) {
          const batch = vectors.slice(i, i + batchSize);
          batches.push(batch);
        }

        // Process batches with controlled concurrency
        await this.processBatchesWithConcurrency(
          batches,
          async (batch) => {
            await index.namespace(namespace).upsert(batch);
          },
          concurrency,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error upserting vectors to ${indexName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process batches with controlled concurrency
   */
  private async processBatchesWithConcurrency<T>(
    items: T[],
    fn: (item: T) => Promise<any>,
    concurrency: number,
  ): Promise<void> {
    const activeTasks: Promise<any>[] = [];
    const results: any[] = [];

    for (const item of items) {
      const task = (async () => {
        try {
          return await fn(item);
        } catch (error) {
          this.logger.error(`Batch processing error: ${error.message}`);
          throw error;
        }
      })();

      activeTasks.push(task);

      if (activeTasks.length >= concurrency) {
        results.push(
          await Promise.race(
            activeTasks.map((t, i) =>
              t.then((result) => ({ result, index: i })),
            ),
          ),
        );
        activeTasks.splice(results[results.length - 1].index, 1);
      }
    }

    // Wait for remaining tasks
    if (activeTasks.length > 0) {
      await Promise.all(activeTasks);
    }
  }

  /**
   * Delete vectors by ID
   */
  async deleteVectors(
    indexName: string,
    ids: string[],
    namespace: string = '',
  ): Promise<void> {
    try {
      const index = this.pinecone.index(indexName);
      await index.deleteMany({ ids, namespace });
    } catch (error) {
      this.logger.error(
        `Error deleting vectors from ${indexName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Delete vectors by filter
   */
  async deleteVectorsByFilter(
    indexName: string,
    filter: Record<string, any>,
    namespace: string = '',
  ): Promise<void> {
    try {
      const index = this.pinecone.index(indexName);
      await index.deleteMany({ filter, namespace });
    } catch (error) {
      this.logger.error(
        `Error deleting vectors by filter from ${indexName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Fetch vectors by ID
   */
  async fetchVectors<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    ids: string[],
    namespace: string = '',
  ) {
    try {
      const index = this.pinecone.index(indexName).namespace(namespace);
      const response = await index.fetch(ids);
      return response;
    } catch (error) {
      this.logger.error(
        `Error fetching vectors from ${indexName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Check if a namespace exists
   */
  async namespaceExists(
    indexName: string,
    namespace: string,
  ): Promise<boolean> {
    try {
      const index = this.pinecone.index(indexName);
      const stats = await index.describeIndexStats();
      return !!stats.namespaces && !!stats.namespaces[namespace];
    } catch (error) {
      this.logger.error(
        `Error checking if namespace exists in ${indexName}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get a Pinecone index
   */
  getIndex(indexName: string): Index {
    return this.pinecone.index(indexName);
  }
}
