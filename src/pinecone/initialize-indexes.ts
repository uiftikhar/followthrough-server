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

    // Get dimensions from config to match embedding model
    const dimensions = this.configService.get<number>('PINECONE_DIMENSIONS', 1536);
    
    // Common configuration for all indexes
    const baseConfig: IndexConfig = {
      dimension: dimensions, // Explicitly set dimension
      metric: 'cosine',
      serverless: true,
      cloud: this.configService.get<ServerlessSpecCloudEnum>('PINECONE_CLOUD') || 'aws',
      region: this.configService.get<string>('PINECONE_REGION') || 'us-west-2',
      tags: { project: 'meeting-analysis' },
    };

    this.logger.log(`Configuring indexes with ${dimensions} dimensions for meeting analysis`);

    try {
      await this.pineconeService.initializeIndexes([{ name: VectorIndexes.MEETING_ANALYSIS, config: baseConfig }]);
      this.logger.log('All Pinecone indexes initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Pinecone indexes', error.stack);
    }
  }
} 