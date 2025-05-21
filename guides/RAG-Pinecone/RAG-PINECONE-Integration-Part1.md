# Pinecone Module Implementation

This section covers the implementation of the Pinecone module in our NestJS application, following best practices for dependency injection and module organization.

## 1. Setting Up the Pinecone Module

### Module Structure

First, let's create a Pinecone module with the necessary services:

```typescript
// src/pinecone/pinecone.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PineconeService } from './pinecone.service';
import { PineconeIndexService } from './pinecone-index.service';
import { PineconeConnectionService } from './pinecone-connection.service';

@Module({
  imports: [ConfigModule],
  providers: [
    PineconeService,
    PineconeIndexService,
    PineconeConnectionService,
  ],
  exports: [
    PineconeService,
    PineconeIndexService,
    PineconeConnectionService,
  ],
})
export class PineconeModule {}
```

### Configuration Service

Next, let's implement a configuration service for Pinecone:

```typescript
// src/pinecone/pinecone-config.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';

@Injectable()
export class PineconeConfigService {
  private static instance: Pinecone;

  constructor(private configService: ConfigService) {}

  static getInstance(): Pinecone {
    if (!PineconeConfigService.instance) {
      const apiKey = process.env.PINECONE_API_KEY;
      if (!apiKey) {
        throw new Error('PINECONE_API_KEY environment variable not set');
      }
      PineconeConfigService.instance = new Pinecone({
        apiKey,
      });
    }
    return PineconeConfigService.instance;
  }

  getPinecone(): Pinecone {
    return PineconeConfigService.getInstance();
  }
}
```

## 2. Connection Service Implementation

The connection service handles the low-level operations with Pinecone:

```typescript
// src/pinecone/pinecone-connection.service.ts
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
      const response = await index.query({
        vector,
        topK: options.topK || 10,
        filter: options.filter,
        includeMetadata: options.includeMetadata || true,
        includeValues: options.includeValues || false,
        namespace,
      });
      return response;
    } catch (error) {
      this.logger.error(`Error querying vectors in ${indexName}: ${error.message}`);
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
        await index.upsert({
          vectors,
          namespace,
        });
      } else {
        // Process in batches
        const batches = [];
        for (let i = 0; i < vectors.length; i += batchSize) {
          const batch = vectors.slice(i, i + batchSize);
          batches.push(batch);
        }
        
        // Process batches with controlled concurrency
        await this.processBatchesWithConcurrency(
          batches,
          async (batch) => {
            await index.upsert({
              vectors: batch,
              namespace,
            });
          },
          concurrency,
        );
      }
    } catch (error) {
      this.logger.error(`Error upserting vectors to ${indexName}: ${error.message}`);
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
    const results = [];
    
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
        results.push(await Promise.race(activeTasks.map((t, i) => t.then(result => ({ result, index: i })))));
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
      this.logger.error(`Error deleting vectors from ${indexName}: ${error.message}`);
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
      this.logger.error(`Error deleting vectors by filter from ${indexName}: ${error.message}`);
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
      const index = this.pinecone.index(indexName);
      return await index.fetch({ ids, namespace });
    } catch (error) {
      this.logger.error(`Error fetching vectors from ${indexName}: ${error.message}`);
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
      const stats = await index.describeStats({ describeIndexStatsRequest: { filter: {} } });
      return !!stats.namespaces && !!stats.namespaces[namespace];
    } catch (error) {
      this.logger.error(`Error checking if namespace exists in ${indexName}: ${error.message}`);
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
```

## 3. Index Management Service

For managing Pinecone indexes:

```typescript
// src/pinecone/pinecone-index.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Pinecone, Index, IndexList } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';
import { PineconeConfigService } from './pinecone-config.service';

export enum VectorIndexes {
  USER_CONTEXT = 'user-context',
  MEETING_ANALYSIS = 'meeting-analysis',
  TRANSCRIPT_EMBEDDINGS = 'transcript-embeddings',
}

export interface IndexConfig {
  dimension?: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
  serverless: boolean;
  cloud: string; // e.g., 'aws' or 'gcp'
  region: string; // e.g., 'us-west-1'
  embeddingModel?:
    | 'multilingual-e5-large'
    | 'pinecone-sparse-english-v0'
    | 'text-embedding-3-large'
    | 'text-embedding-ada-002'
    | 'llama-text-embed-v2';
  tags?: Record<string, string>;
}

@Injectable()
export class PineconeIndexService {
  private pinecone: Pinecone;
  private readonly logger = new Logger(PineconeIndexService.name);

  constructor(
    private configService: ConfigService,
    private pineconeConfigService: PineconeConfigService,
  ) {
    this.pinecone = this.pineconeConfigService.getPinecone();
  }

  /**
   * List all indexes in the Pinecone project
   */
  async listIndexes(): Promise<IndexList> {
    return this.pinecone.listIndexes();
  }

  /**
   * Checks if an index exists
   */
  async indexExists(indexName: string): Promise<boolean> {
    const indexList = await this.listIndexes();
    return (
      indexList.indexes?.some((index) => index.name === indexName) || false
    );
  }

  /**
   * Creates an index if it doesn't exist
   */
  async ensureIndexExists(
    indexName: VectorIndexes | string,
    config: IndexConfig,
  ): Promise<void> {
    const exists = await this.indexExists(indexName);

    if (!exists) {
      this.logger.info(`Creating Pinecone index: ${indexName}`);
      await this.pinecone.createIndexForModel({
        name: indexName,
        cloud: config.cloud,
        region: config.region,
        embed: {
          model: config.embeddingModel || 'multilingual-e5-large',
          metric: config.metric || 'cosine',
          fieldMap: {
            text: 'text',
          },
        },
        waitUntilReady: true,
        tags: config.tags || { project: 'meeting-analysis' },
      });
      this.logger.info(`Index ${indexName} created and ready.`);
    } else {
      this.logger.info(`Index ${indexName} already exists.`);
    }
  }

  /**
   * Gets an index instance
   */
  getIndex(indexName: VectorIndexes | string): Index {
    return this.pinecone.index(indexName);
  }

  /**
   * Deletes an index
   */
  async deleteIndex(indexName: VectorIndexes | string): Promise<void> {
    const exists = await this.indexExists(indexName);

    if (exists) {
      await this.pinecone.deleteIndex(indexName);
      this.logger.info(`Index ${indexName} deleted.`);
    } else {
      this.logger.info(`Index ${indexName} does not exist, nothing to delete.`);
    }
  }

  /**
   * Gets index statistics
   */
  async describeIndex(indexName: VectorIndexes | string): Promise<any> {
    return this.pinecone.describeIndex(indexName);
  }
}
```

## 4. Main Pinecone Service

The main service that applications will interact with:

```typescript
// src/pinecone/pinecone.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RecordMetadata } from '@pinecone-database/pinecone';
import { PineconeConnectionService } from './pinecone-connection.service';
import { PineconeIndexService, VectorIndexes, IndexConfig } from './pinecone-index.service';
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
  async initializeIndexes(indexes: { name: VectorIndexes | string; config: IndexConfig }[]): Promise<void> {
    for (const { name, config } of indexes) {
      await this.indexService.ensureIndexExists(name, config);
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
        (match) => match.score !== undefined && match.score >= (options.minScore || 0),
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
    const response = await this.connectionService.fetchVectors<T>(indexName, ids, ns);
    
    // Transform to better typed records
    const result: Record<string, { id: string; values: number[]; metadata: T }> = {};
    
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
  async namespaceExists(indexName: string, namespace: string): Promise<boolean> {
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
```

## 5. Types Definition

Define type definitions for Pinecone operations:

```typescript
// src/pinecone/pinecone.types.ts
import { RecordMetadata } from '@pinecone-database/pinecone';

export interface VectorRecord<T extends RecordMetadata = RecordMetadata> {
  id: string;
  values: number[];
  metadata?: T;
}

export type PineconeFilter = Record<string, any>;

export interface QueryOptions {
  topK?: number;
  filter?: PineconeFilter;
  includeMetadata?: boolean;
  includeValues?: boolean;
}

export interface UpsertOptions {
  batchSize?: number;
  concurrency?: number;
}

export interface IndexStats {
  namespaces: Record<
    string,
    {
      vectorCount: number;
    }
  >;
  dimension: number;
  indexFullness: number;
  totalVectorCount: number;
}
```

## 6. Integration with App Module

To integrate the Pinecone module with the main application, update the app module:

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PineconeModule } from './pinecone/pinecone.module';
// Other imports...

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PineconeModule,
    // Other modules...
  ],
  // ...
})
export class AppModule {}
```

## 7. Initialization Script

Create a script to initialize Pinecone indexes on application startup:

```typescript
// src/pinecone/initialize-indexes.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PineconeService } from './pinecone.service';
import { VectorIndexes, IndexConfig } from './pinecone-index.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PineconeInitializer implements OnModuleInit {
  private readonly logger = new Logger(PineconeInitializer.name);

  constructor(
    private readonly pineconeService: PineconeService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Pinecone indexes...');
    
    // Common configuration for all indexes
    const baseConfig: IndexConfig = {
      metric: 'cosine',
      serverless: true,
      cloud: this.configService.get<string>('PINECONE_CLOUD') || 'aws',
      region: this.configService.get<string>('PINECONE_REGION') || 'us-west-2',
      embeddingModel: 'llama-text-embed-v2',
      tags: { project: 'productive-ai' },
    };
    
    // Define indexes to initialize
    const indexes = [
      { name: VectorIndexes.USER_CONTEXT, config: baseConfig },
      { name: VectorIndexes.MEETING_ANALYSIS, config: baseConfig },
      { name: VectorIndexes.TRANSCRIPT_EMBEDDINGS, config: baseConfig },
    ];
    
    try {
      await this.pineconeService.initializeIndexes(indexes);
      this.logger.log('All Pinecone indexes initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Pinecone indexes', error.stack);
    }
  }
}
```

Add the initializer to the providers in the Pinecone module:

```typescript
// Update in src/pinecone/pinecone.module.ts
@Module({
  imports: [ConfigModule],
  providers: [
    PineconeService,
    PineconeIndexService,
    PineconeConnectionService,
    PineconeConfigService,
    PineconeInitializer, // Add this
  ],
  exports: [
    PineconeService,
    PineconeIndexService,
    PineconeConnectionService,
  ],
})
export class PineconeModule {}
```

## 8. Environment Configuration

Create a `.env` file with the necessary Pinecone configuration:

```
PINECONE_API_KEY=your-api-key
PINECONE_CLOUD=aws
PINECONE_REGION=us-west-2
```

Update your environment validation schema as needed:

```typescript
// src/config/config.schema.ts
import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Other environment variables...
  PINECONE_API_KEY: Joi.string().required(),
  PINECONE_CLOUD: Joi.string().default('aws'),
  PINECONE_REGION: Joi.string().default('us-west-2'),
});
```

This completes the Pinecone module implementation. In the next part, we'll cover the Embedding Service implementation. 