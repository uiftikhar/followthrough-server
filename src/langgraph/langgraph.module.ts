import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LanggraphCoreModule } from "./core/core.module";
import { UnifiedWorkflowService } from "./unified-workflow.service";
import { SharedCoreModule } from "../shared/shared-core.module";
import { DatabaseModule } from "../database/database.module";
import { EventEmitterModule } from "@nestjs/event-emitter";

/**
 * LangGraph module for orchestrating agent workflows
 * Provides the unified workflow service that routes requests to appropriate teams
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LanggraphCoreModule, // Provides TeamHandlerRegistry, GraphExecutionService
    SharedCoreModule, // Provides all agents and core services
    DatabaseModule, // For session storage
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ".",
    }),
  ],
  providers: [
    UnifiedWorkflowService,
  ],
  exports: [
    UnifiedWorkflowService,
    LanggraphCoreModule,
  ],
})
export class LanggraphModule {}
