import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EmailService } from "./email.service";
import { GmailConnector } from "./connectors/gmail.connector";
import { OutlookConnector } from "./connectors/outlook.connector";
import { EmailConnectorFactory } from "./connectors/email-connector.factory";
import { MCPModule } from "../mcp/mcp.module";
import { EmailWorkflowModule } from "./workflow/email-workflow.module";
import { EmailTriageController } from "./email-triage.controller";
import { EmailActionController } from "./email-action.controller";

/**
 * EmailModule - Application Layer
 * Provides email triage controllers and integrates with workflow modules
 * Part of Phase 2-6 of email triage implementation
 * Updated to include user action handlers for Phase 6
 */
@Module({
  imports: [
    ConfigModule,
    MCPModule,
    EmailWorkflowModule, // Provides workflow services and UnifiedWorkflowService
  ],
  controllers: [
    EmailTriageController,
    EmailActionController, // NEW - Phase 6 user action handlers
  ],
  providers: [
    // TOOO: Remove zapier and mcp
    EmailService,
    GmailConnector,
    OutlookConnector,
    EmailConnectorFactory,
  ],
  exports: [EmailService, EmailWorkflowModule],
})
export class EmailModule {}
