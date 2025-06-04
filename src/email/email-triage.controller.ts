import { Controller, Post, Body, Logger } from "@nestjs/common";
import { EmailTriageGraphBuilder } from "./workflow/email-triage-graph.builder";
import { EmailTriageState } from "./dtos/email-triage.dto";
import { v4 as uuidv4 } from "uuid";

@Controller("api/email")
export class EmailTriageController {
  private readonly logger = new Logger(EmailTriageController.name);

  constructor(
    private readonly emailTriageGraphBuilder: EmailTriageGraphBuilder,
  ) {}

  /**
   * PRODUCTION EMAIL TRIAGE ENDPOINT
   * Direct agentic email triage system with RAG enhancement
   * POST /api/email/triage
   *
   * Used internally by the system for processing emails from Gmail webhooks
   * This endpoint should be called by the UnifiedWorkflowService only
   */
  @Post("triage")
  async processEmailTriage(@Body() emailPayload: any): Promise<any> {
    this.logger.log("🚀 Processing email triage request");

    try {
      // Create EmailTriageState for the agentic system
      const sessionId = uuidv4();
      const initialState: EmailTriageState = {
        sessionId,
        emailData: {
          id: emailPayload.emailData?.id || `email-${Date.now()}`,
          body:
            emailPayload.emailData?.body ||
            emailPayload.body ||
            emailPayload.content ||
            "",
          metadata: {
            subject:
              emailPayload.emailData?.metadata?.subject || emailPayload.subject,
            from: emailPayload.emailData?.metadata?.from || emailPayload.from,
            to:
              emailPayload.emailData?.metadata?.to ||
              emailPayload.to ||
              "support@company.com",
            timestamp:
              emailPayload.emailData?.metadata?.timestamp ||
              emailPayload.timestamp ||
              new Date().toISOString(),
            headers:
              emailPayload.emailData?.metadata?.headers ||
              emailPayload.headers ||
              {},
          },
        },
        currentStep: "initializing",
        progress: 0,
      };

      this.logger.log(
        `🔄 Processing email triage for: "${initialState.emailData.metadata.subject}" from ${initialState.emailData.metadata.from}`,
      );

      // Execute the RAG-enhanced email triage graph
      const finalState =
        await this.emailTriageGraphBuilder.executeGraph(initialState);

      this.logger.log("✅ Email triage completed successfully");

      // Return the structured result
      return {
        success: true,
        sessionId,
        classification: finalState.classification,
        summary: finalState.summary,
        replyDraft: finalState.replyDraft,
        currentStep: finalState.currentStep,
        progress: finalState.progress,
        result: finalState.result,
        error: finalState.error,
      };
    } catch (error) {
      this.logger.error(
        `❌ Email triage failed: ${error.message}`,
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
