import { Module } from '@nestjs/common';
import { SharedCoreModule } from '../shared/shared-core.module';
// import { RagController } from './rag.controller';

/**
 * RagModule - Contains RAG-specific controllers
 * All RAG services are provided by SharedCoreModule
 * Simplified architecture eliminates circular dependencies
 */
@Module({
  imports: [SharedCoreModule], // Provides all RAG services and dependencies
  controllers: [],
  providers: [],
  exports: [],
})
export class RagModule {}
