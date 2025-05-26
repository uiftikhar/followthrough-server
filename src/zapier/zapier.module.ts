import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ZapierController } from "./zapier.controller";
import { WebhookController } from "./webhook.controller";
import { ZapierEmailWebhookController } from "./email-webhook.controller";
import { ZapierService } from "./zapier.service";
import { TriggerController } from "./trigger.controller";
import { WorkflowFrameworkModule } from "../workflow-framework/workflow-framework.module";
import { ZapierApiKey, ZapierApiKeySchema } from "../database/schemas/zapier-api-key.schema";
import { ZapierApiKeyRepository } from "../database/repositories/zapier-api-key.repository";

/**
 * ZapierModule - Integration layer for Zapier webhooks and triggers
 * Updated to include email webhook processing and MongoDB-based API key management
 */
@Module({
  imports: [
    WorkflowFrameworkModule, // For UnifiedWorkflowService access
    MongooseModule.forFeature([
      { name: ZapierApiKey.name, schema: ZapierApiKeySchema },
    ]),
  ],
  controllers: [
    ZapierController,
    WebhookController,
    TriggerController,
    ZapierEmailWebhookController, // Email webhook processing
  ],
  providers: [
    ZapierService,
    ZapierApiKeyRepository, // Repository for API key management
  ],
  exports: [
    ZapierService,
    ZapierApiKeyRepository, // Export for use in other modules
  ],
})
export class ZapierModule {}
