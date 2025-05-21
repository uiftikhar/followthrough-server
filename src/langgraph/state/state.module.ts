import { Module } from '@nestjs/common';
import { StateService } from './state.service';
import { LangGraphPersistenceModule } from '../persistence/persistence.module';
import { STATE_SERVICE } from './constants/injection-tokens';

@Module({
  imports: [LangGraphPersistenceModule],
  providers: [
    // Concrete implementation
    StateService,

    // Token-based provider
    {
      provide: STATE_SERVICE,
      useExisting: StateService,
    },
  ],
  exports: [
    // Concrete implementation
    StateService,

    // Token-based provider
    STATE_SERVICE,
  ],
})
export class StateModule {}
