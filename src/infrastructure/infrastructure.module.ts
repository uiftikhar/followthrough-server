import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { DatabaseModule } from "../database/database.module";
import { StorageModule } from "../storage/storage.module";
import { configValidationSchema } from "../config/validation.schema";

/**
 * InfrastructureModule - Foundation layer module
 * Provides all core infrastructure services that other modules depend on
 * Part of Phase 1 migration from SharedCoreModule
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validationSchema: configValidationSchema,
    }),
    DatabaseModule,
    StorageModule,
    CacheModule.register({
      ttl: 1800, // 30 minutes
      max: 100,
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ".",
      maxListeners: 100,
      verboseMemoryLeak: true,
    }),
  ],
  exports: [
    ConfigModule,
    DatabaseModule,
    StorageModule,
    CacheModule,
    EventEmitterModule,
  ],
})
export class InfrastructureModule {}
