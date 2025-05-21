import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm.service';
import { LLM_SERVICE } from './constants/injection-tokens';

@Module({
  imports: [ConfigModule],
  providers: [
    // Concrete implementation
    LlmService,

    // Token-based provider
    {
      provide: LLM_SERVICE,
      useExisting: LlmService,
    },
  ],
  exports: [
    // Concrete implementation
    LlmService,

    // Token-based provider
    LLM_SERVICE,
  ],
})
export class LlmModule {}
