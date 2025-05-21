import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { configValidationSchema } from './config/validation.schema';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { LoggingModule } from './logging/logging.module';
import { StorageModule } from './storage/storage.module';
import { LangGraphModule } from './langgraph/langgraph.module';
import { PineconeModule } from './pinecone/pinecone.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { RagModule } from './rag/rag.module';
import { ZapierModule } from './zapier/zapier.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: configValidationSchema,
    }),
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    AuthModule,
    StorageModule,
    LangGraphModule,
    PineconeModule,
    EmbeddingModule,
    RagModule,
    ZapierModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
