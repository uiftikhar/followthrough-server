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
    const apiKey = this.configService.get<string>('PINECONE_API_KEY');

    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is not defined in the configuration');
    }

    if (!PineconeConfigService.instance) {
      PineconeConfigService.instance = new Pinecone({
        apiKey,
      });
    }

    return PineconeConfigService.instance;
  }
}
