import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EmailService } from "./email.service";
import { GmailConnector } from "./connectors/gmail.connector";
import { OutlookConnector } from "./connectors/outlook.connector";
import { EmailConnectorFactory } from "./connectors/email-connector.factory";
import { MCPModule } from "../../mcp/mcp.module";
import { EmailWorkflowModule } from "./workflow/email-workflow.module";
import { EmailActionController } from "./email-action.controller";

/**
 * EmailModule - Application Layer
 * Provides email action controllers and integrates with workflow modules
 * Part of Phase 2-6 of email triage implementation
 * Updated to use unified workflow service approach through EmailWorkflowModule
 */
@Module({
  imports: [
    ConfigModule,
    MCPModule,
    EmailWorkflowModule, // Provides workflow services and UnifiedWorkflowService
  ],
  controllers: [
    EmailActionController, // User action handlers for email workflow results
  ],
  providers: [
    EmailService,
    GmailConnector,
    OutlookConnector,
    EmailConnectorFactory,
  ],
  exports: [EmailService, EmailWorkflowModule],
})
export class EmailModule {}
