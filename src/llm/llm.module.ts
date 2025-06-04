import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { LlmService } from "../langgraph/llm/llm.service";
import { StateStorageService } from "../langgraph/persistence/state-storage.service";
import { LLM_SERVICE } from "../langgraph/llm/constants/injection-tokens";

/**
 * LlmModule - Core Services Layer
 * Provides LLM and State storage services (StateService is in LanggraphCoreModule)
 * Part of Phase 1 migration from SharedCoreModule
 */
@Module({
  imports: [InfrastructureModule],
  providers: [
    LlmService,
    StateStorageService,
    {
      provide: LLM_SERVICE,
      useExisting: LlmService,
    },
  ],
  exports: [LlmService, StateStorageService, LLM_SERVICE],
})
export class LlmModule {}
