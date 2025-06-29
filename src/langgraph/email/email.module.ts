import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EmailService } from "./email.service";
import { GmailConnector } from "./connectors/gmail.connector";
import { OutlookConnector } from "./connectors/outlook.connector";
import { EmailConnectorFactory } from "./connectors/email-connector.factory";
import { MCPModule } from "../../mcp/mcp.module";
import { EmailWorkflowModule } from "./workflow/email-workflow.module";
import { EmailActionController } from "./email-action.controller";
import { EnhancedEmailFilterService } from "./filters/enhanced-email-filter.service";
import { EmailProcessingCacheService } from "./cache/email-processing-cache.service";
import { DatabaseModule } from "../../database/database.module";

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
    DatabaseModule, // Provides EmailTriageSessionRepository
    EmailWorkflowModule, // Provides optimized EmailTriageService and centralized event handling
  ],
  controllers: [
    EmailActionController, // User action handlers for email workflow results
  ],
  providers: [
    EmailService,
    GmailConnector,
    OutlookConnector,
    EmailConnectorFactory,
    EnhancedEmailFilterService,
    EmailProcessingCacheService,
  ],
  exports: [
    EmailService, 
    EmailWorkflowModule,
    EnhancedEmailFilterService,
    EmailProcessingCacheService,
  ],
})
export class EmailModule {}
