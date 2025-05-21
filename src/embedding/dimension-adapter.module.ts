import { Module } from '@nestjs/common';
import { DimensionAdapterService } from './dimension-adapter.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [DimensionAdapterService],
  exports: [DimensionAdapterService],
})
export class DimensionAdapterModule {}
