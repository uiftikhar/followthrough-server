import { Module } from '@nestjs/common';
import { ZapierController } from './zapier.controller';
import { WebhookController } from './webhook.controller';
import { ZapierService } from './zapier.service';
import { TriggerController } from './trigger.controller';

@Module({
  controllers: [ZapierController, WebhookController, TriggerController],
  providers: [ZapierService],
  exports: [ZapierService],
})
export class ZapierModule {} 