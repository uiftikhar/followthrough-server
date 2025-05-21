import { Injectable, Logger } from '@nestjs/common';
import {
  Pinecone,
  Index,
  IndexList,
  ServerlessSpecCloudEnum,
} from '@pinecone-database/pinecone';
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
  cloud: ServerlessSpecCloudEnum;
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
      this.logger.log(`Creating Pinecone index: ${indexName}`);
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
      this.logger.log(`Index ${indexName} created and ready.`);
    } else {
      this.logger.log(`Index ${indexName} already exists.`);
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
      this.logger.log(`Index ${indexName} deleted.`);
    } else {
      this.logger.log(`Index ${indexName} does not exist, nothing to delete.`);
    }
  }

  /**
   * Gets index statistics
   */
  async describeIndex(indexName: VectorIndexes | string): Promise<any> {
    return this.pinecone.describeIndex(indexName);
  }
}
