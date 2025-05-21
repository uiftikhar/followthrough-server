import { Controller, Get, Post, Body, Inject, Optional } from '@nestjs/common';
import { AppService } from './app.service';
import { EmbeddingService } from './embedding/embedding.service';
import { EMBEDDING_SERVICE } from './embedding/constants/injection-tokens';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Optional()
    @Inject(EMBEDDING_SERVICE)
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('test-embedding')
  async testEmbedding(@Body() body: { text: string }) {
    if (!this.embeddingService) {
      return {
        error: 'Embedding service not available',
        status: 'disabled',
      };
    }

    const embedding = await this.embeddingService.generateEmbedding(body.text);
    return {
      text: body.text,
      embedding_length: embedding.length,
      embedding_sample: embedding.slice(0, 5), // Return just a sample
    };
  }
}
