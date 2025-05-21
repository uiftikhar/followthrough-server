import { Module } from '@nestjs/common';
import { StateStorageService } from './state-storage.service';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [StateStorageService],
  exports: [StateStorageService],
})
export class LangGraphPersistenceModule {}
