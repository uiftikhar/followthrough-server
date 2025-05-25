import { Controller, Post, Body, Logger } from "@nestjs/common";
import { UnifiedWorkflowService } from "../langgraph/unified-workflow.service";
import { ZapierEmailPayload } from "./dtos/email-triage.dto";

@Controller("email")
export class EmailTriageController {
  private readonly logger = new Logger(EmailTriageController.name);

  constructor(
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
  ) {}

  /**
   * Test endpoint for email triage functionality
   * POST /email/triage
   */
  @Post("triage")
  async testEmailTriage(@Body() emailPayload: any): Promise<any> {
    this.logger.log("Received email triage test request");

    try {
      // Transform input to our unified format for email triage
      const input = {
        type: "email_triage",
        emailData: {
          id: emailPayload.id || `test-${Date.now()}`,
          body: emailPayload.body || emailPayload.content,
          metadata: {
            subject: emailPayload.subject,
            from: emailPayload.from,
            to: emailPayload.to || "support@company.com",
            timestamp: emailPayload.timestamp || new Date().toISOString(),
            headers: emailPayload.headers || {},
          },
        },
        sessionId: `email-session-${Date.now()}`,
      };

      this.logger.log(
        `Processing email triage for: ${input.emailData.metadata.subject}`,
      );

      // Route through existing Master Supervisor
      const result = await this.unifiedWorkflowService.processInput(
        input,
        { sessionId: input.sessionId },
        emailPayload.userId || "test-user",
      );

      this.logger.log("Email triage completed successfully");
      return {
        success: true,
        sessionId: input.sessionId,
        result,
      };
    } catch (error) {
      this.logger.error(`Email triage failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test webhook endpoint for Zapier integration
   * POST /email/webhook
   */
  @Post("webhook")
  async handleEmailWebhook(
    @Body() emailPayload: ZapierEmailPayload,
  ): Promise<any> {
    this.logger.log("Received email webhook from external source");

    try {
      // Transform Zapier payload to our unified format
      const input = {
        type: "email_triage",
        emailData: {
          id: emailPayload.id,
          body: emailPayload.body,
          metadata: {
            subject: emailPayload.subject,
            from: emailPayload.from,
            to: emailPayload.to,
            timestamp: emailPayload.timestamp,
            headers: emailPayload.headers,
          },
        },
      };

      // Route through existing Master Supervisor
      const result = await this.unifiedWorkflowService.processInput(
        input,
        emailPayload.metadata || {},
        emailPayload.userId || "webhook-user",
      );

      return {
        success: true,
        message: "Email processed successfully",
        result,
      };
    } catch (error) {
      this.logger.error(
        `Webhook processing failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
