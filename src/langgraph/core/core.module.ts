import { Module } from "@nestjs/common";
import { TeamHandlerRegistry } from "./team-handler-registry.service";
import { GraphExecutionService } from "./graph-execution.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * Core module for LangGraph functionality and team coordination
 */
@Module({
  providers: [
    // Core Services for Team Coordination
    TeamHandlerRegistry,
    GraphExecutionService,
    
    // Event Emitter for Progress Tracking
    {
      provide: "EVENT_EMITTER",
      useClass: EventEmitter2,
    },
  ],
  exports: [
    TeamHandlerRegistry,
    GraphExecutionService,
  ],
})
export class LanggraphCoreModule {}
