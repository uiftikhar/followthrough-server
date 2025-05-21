import { Injectable, Logger } from '@nestjs/common';
import { RecordMetadata } from '@pinecone-database/pinecone';
import { PineconeConnectionService } from './pinecone-connection.service';
import {
  PineconeIndexService,
  VectorIndexes,
  IndexConfig,
} from './pinecone-index.service';
import { VectorRecord, QueryOptions } from './pinecone.types';

@Injectable()
export class PineconeService {
  private readonly logger = new Logger(PineconeService.name);
  private defaultNamespace = 'default';

  constructor(
    private readonly connectionService: PineconeConnectionService,
    private readonly indexService: PineconeIndexService,
  ) {}

  /**
   * Initialize required indexes
   */
  async initializeIndexes(
    indexes: { name: VectorIndexes | string; config: IndexConfig }[],
  ): Promise<void> {
    for (const { name, config } of indexes) {
      await this.indexService.ensureIndexExists(name, config);
      this.logger.log(`Index ${name} initialized successfully`);
    }
    this.logger.log('Pinecone indexes initialized successfully');
  }

  /**
   * Store a vector in the index
   */
  async storeVector<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    id: string,
    vector: number[],
    metadata: T = {} as T,
    namespace?: string,
  ): Promise<void> {
    const ns = namespace || this.defaultNamespace;
    const record: VectorRecord<T> = { id, values: vector, metadata };

    await this.connectionService.upsertVectors(indexName, [record], ns);
    this.logger.debug(`Vector stored: ${id} in ${indexName}/${ns}`);
  }

  /**
   * Store multiple vectors in the index
   */
  async storeVectors<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    records: Array<{
      id: string;
      vector: number[];
      metadata?: T;
    }>,
    namespace?: string,
  ): Promise<void> {
    const ns = namespace || this.defaultNamespace;
    const vectorRecords: VectorRecord<T>[] = records.map((record) => ({
      id: record.id,
      values: record.vector,
      metadata: record.metadata || ({} as T),
    }));

    await this.connectionService.upsertVectors(indexName, vectorRecords, ns);
    this.logger.debug(`${records.length} vectors stored in ${indexName}/${ns}`);
  }

  /**
   * Query for similar vectors
   */
  async querySimilar<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    queryVector: number[],
    options: {
      topK?: number;
      filter?: Record<string, any>;
      includeValues?: boolean;
      minScore?: number;
      namespace?: string;
    } = {},
  ): Promise<
    Array<{
      id: string;
      score: number;
      metadata: T;
      values?: number[];
    }>
  > {
    const ns = options.namespace || this.defaultNamespace;

    const queryOptions: QueryOptions = {
      topK: options.topK || 10,
      filter: options.filter,
      includeValues: options.includeValues || false,
      includeMetadata: true,
    };

    const response = await this.connectionService.queryVectors<T>(
      indexName,
      queryVector,
      queryOptions,
      ns,
    );

    // Filter results by minimum score if specified
    let matches = response.matches || [];
    if (options.minScore !== undefined) {
      matches = matches.filter(
        (match) =>
          match.score !== undefined && match.score >= (options.minScore || 0),
      );
    }

    // Transform to simplified format
    return matches.map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as T,
      values: match.values,
    }));
  }

  /**
   * Delete vectors by ID
   */
  async deleteVectors(
    indexName: string,
    ids: string[],
    namespace?: string,
  ): Promise<void> {
    const ns = namespace || this.defaultNamespace;
    await this.connectionService.deleteVectors(indexName, ids, ns);
    this.logger.debug(`${ids.length} vectors deleted from ${indexName}/${ns}`);
  }

  /**
   * Delete vectors by filter
   */
  async deleteVectorsByFilter(
    indexName: string,
    filter: Record<string, any>,
    namespace?: string,
  ): Promise<void> {
    const ns = namespace || this.defaultNamespace;
    await this.connectionService.deleteVectorsByFilter(indexName, filter, ns);
    this.logger.debug(`Vectors deleted by filter from ${indexName}/${ns}`);
  }

  /**
   * Fetch specific vectors by ID
   */
  async fetchVectors<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    ids: string[],
    namespace?: string,
  ): Promise<
    Record<
      string,
      {
        id: string;
        values: number[];
        metadata: T;
      }
    >
  > {
    const ns = namespace || this.defaultNamespace;
    const response = await this.connectionService.fetchVectors<T>(
      indexName,
      ids,
      ns,
    );

    // Transform to better typed records
    const result: Record<
      string,
      { id: string; values: number[]; metadata: T }
    > = {};

    if (response.records) {
      for (const [id, record] of Object.entries(response.records)) {
        result[id] = {
          id,
          values: record.values || [],
          metadata: record.metadata as T,
        };
      }
    }

    return result;
  }

  /**
   * Check if namespace exists
   */
  async namespaceExists(
    indexName: string,
    namespace: string,
  ): Promise<boolean> {
    return this.connectionService.namespaceExists(indexName, namespace);
  }

  /**
   * Set default namespace
   */
  setDefaultNamespace(namespace: string): void {
    this.defaultNamespace = namespace;
  }

  /**
   * Get default namespace
   */
  getDefaultNamespace(): string {
    return this.defaultNamespace;
  }
}
