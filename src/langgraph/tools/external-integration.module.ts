import { Module } from '@nestjs/common';
import { ExternalIntegrationService } from './external-integration.service';

@Module({
  providers: [ExternalIntegrationService],
  exports: [ExternalIntegrationService],
})
export class ExternalIntegrationModule {}
