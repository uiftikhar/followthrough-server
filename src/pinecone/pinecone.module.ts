import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PineconeService } from './pinecone.service';
import { PineconeConnectionService } from './pinecone-connection.service';
import { PineconeConfigService } from './pinecone-config.service';
import { PineconeIndexService } from './pinecone-index.service';
import { PineconeInitializer } from './initialize-indexes';
import {
  PINECONE_SERVICE,
  PINECONE_CONNECTION_SERVICE,
  PINECONE_INDEX_SERVICE,
} from './constants/injection-tokens';

@Module({
  imports: [ConfigModule],
  providers: [
    // Concrete implementations
    PineconeService,
    PineconeConfigService,
    PineconeConnectionService,
    PineconeIndexService,
    PineconeInitializer,

    // Token-based providers
    {
      provide: PINECONE_SERVICE,
      useExisting: PineconeService,
    },
    {
      provide: PINECONE_CONNECTION_SERVICE,
      useExisting: PineconeConnectionService,
    },
    {
      provide: PINECONE_INDEX_SERVICE,
      useExisting: PineconeIndexService,
    },
  ],
  exports: [
    // Concrete implementations
    PineconeService,
    PineconeConfigService,
    PineconeConnectionService,
    PineconeIndexService,

    // Token-based providers
    PINECONE_SERVICE,
    PINECONE_CONNECTION_SERVICE,
    PINECONE_INDEX_SERVICE,
  ],
})
export class PineconeModule {}
