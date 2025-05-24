import { Module } from '@nestjs/common';
import { ZapierController } from './zapier.controller';
import { WebhookController } from './webhook.controller';
import { ZapierEmailWebhookController } from './email-webhook.controller';
import { ZapierService } from './zapier.service';
import { TriggerController } from './trigger.controller';
import { WorkflowFrameworkModule } from '../workflow-framework/workflow-framework.module';

/**
 * ZapierModule - Integration layer for Zapier webhooks and triggers
 * Updated to include email webhook processing for Phase 4
 */
@Module({
  imports: [
    WorkflowFrameworkModule, // For UnifiedWorkflowService access
  ],
  controllers: [
    ZapierController,
    WebhookController,
    TriggerController,
    ZapierEmailWebhookController, // NEW - Email webhook processing
  ],
  providers: [ZapierService],
  exports: [ZapierService],
})
export class ZapierModule {} 