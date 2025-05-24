import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { configValidationSchema } from './config/validation.schema';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { LoggingModule } from './logging/logging.module';
import { SharedCoreModule } from './shared/shared-core.module';
import { LanggraphModule } from './langgraph/langgraph.module';
import { RagModule } from './rag/rag.module';
import { ZapierModule } from './zapier/zapier.module';

/**
 * AppModule - Root application module
 * Uses SharedCoreModule for all infrastructure dependencies
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: configValidationSchema,
    }),
    AppConfigModule,
    LoggingModule,
    AuthModule,
    SharedCoreModule, // Provides all shared infrastructure
    LanggraphModule,  // Feature modules
    RagModule,        // Controllers only
    ZapierModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
