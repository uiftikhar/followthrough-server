import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PineconeService } from './pinecone.service';
import { VectorIndexes, IndexConfig } from './pinecone-index.service';
import { ConfigService } from '@nestjs/config';
import { ServerlessSpecCloudEnum } from '@pinecone-database/pinecone';

@Injectable()
export class PineconeInitializer implements OnModuleInit {
  private readonly logger = new Logger(PineconeInitializer.name);

  constructor(
    private readonly pineconeService: PineconeService,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() {
    this.logger.log('Initializing Pinecone indexes...');

    // Common configuration for all indexes
    const baseConfig: IndexConfig = {
      metric: 'cosine',
      serverless: true,
      cloud: this.configService.get<ServerlessSpecCloudEnum>('PINECONE_CLOUD') || 'aws',
      region: this.configService.get<string>('PINECONE_REGION') || 'us-west-2',
      embeddingModel: 'llama-text-embed-v2',
      tags: { project: 'productive-ai' },
    };


    try {
      await this.pineconeService.initializeIndexes([{ name: VectorIndexes.MEETING_ANALYSIS, config: baseConfig }]);
      this.logger.log('All Pinecone indexes initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Pinecone indexes', error.stack);
    }
  }
} 