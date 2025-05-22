import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphExecutionService } from './graph-execution.service';
import { TeamHandlerRegistry } from './team-handler-registry.service';
import { StateService } from '../state/state.service';
import { DatabaseModule } from '../../database/database.module';
import { ConfigModule } from '@nestjs/config';
import { EnhancedGraphService } from './enhanced-graph.service';
import { LangGraphPersistenceModule } from '../persistence/persistence.module';

/**
 * Core module providing the infrastructure services for agent graphs
 */
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    LangGraphPersistenceModule,
    EventEmitterModule.forRoot({
      // Configure event emitter for progress tracking
      wildcard: true,
      delimiter: '.',
      maxListeners: 100,
      verboseMemoryLeak: true,
    }),
  ],
  providers: [
    GraphExecutionService,
    TeamHandlerRegistry,
    EnhancedGraphService,
    StateService,
  ],
  exports: [
    GraphExecutionService,
    TeamHandlerRegistry,
    EnhancedGraphService,
    StateService,
  ],
})
export class LanggraphCoreModule {} 