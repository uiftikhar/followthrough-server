import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { GmailConnector } from './connectors/gmail.connector';
import { OutlookConnector } from './connectors/outlook.connector';
import { EmailConnectorFactory } from './connectors/email-connector.factory';
import { MCPModule } from '../mcp/mcp.module';
import { EmailWorkflowModule } from './workflow/email-workflow.module';
import { EmailTriageController } from './email-triage.controller';

/**
 * EmailModule - Application Layer
 * Provides email triage controllers and integrates with workflow modules
 * Part of Phase 2 of email triage implementation
 */
@Module({
  imports: [
    ConfigModule,
    MCPModule,
    EmailWorkflowModule,  // Provides workflow services and UnifiedWorkflowService
  ],
  controllers: [
    EmailTriageController,
  ],
  providers: [
    EmailService,
    GmailConnector,
    OutlookConnector,
    EmailConnectorFactory,
  ],
  exports: [
    EmailService,
    EmailWorkflowModule,
  ],
})
export class EmailModule {} 