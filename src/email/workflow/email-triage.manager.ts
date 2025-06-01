import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EmailClassificationAgent } from "../agents/email-classification.agent";
import { EmailSummarizationAgent } from "../agents/email-summarization.agent";
import { EmailReplyDraftAgent } from "../agents/email-reply-draft.agent";
import { EmailTriageResult } from "../dtos/email-triage.dto";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class EmailTriageManager {
  private readonly logger = new Logger(EmailTriageManager.name);

  constructor(
    private readonly classificationAgent: EmailClassificationAgent,
    private readonly summarizationAgent: EmailSummarizationAgent,
    private readonly replyDraftAgent: EmailReplyDraftAgent,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processEmail(emailData: any, context: any): Promise<EmailTriageResult> {
    const sessionId = context.sessionId || uuidv4();

    this.logger.log(`Starting email triage for session: ${sessionId}`);

    try {
      // Emit progress event for start
      this.eventEmitter.emit("email.triage.started", {
        sessionId,
        emailId: emailData.id,
        emailAddress: emailData.metadata?.to || emailData.metadata?.emailAddress,
        subject: emailData.metadata?.subject,
        from: emailData.metadata?.from,
        timestamp: new Date().toISOString(),
        source: context.source || 'email_manager',
      });

      // Execute classification and summarization workers in parallel
      this.logger.log("Running classification and summarization in parallel");
      const [classification, summary] = await Promise.all([
        this.classificationAgent.classifyEmail(
          emailData.body,
          emailData.metadata,
        ),
        this.summarizationAgent.summarizeEmail(
          emailData.body,
          emailData.metadata,
        ),
      ]);

      // Emit progress event for parallel completion
      this.eventEmitter.emit("email.triage.parallel.completed", {
        sessionId,
        classification,
        summary,
        timestamp: new Date().toISOString(),
      });

      // Generate reply draft based on classification and summary
      this.logger.log(
        "Generating reply draft based on classification and summary",
      );
      const replyDraft = await this.replyDraftAgent.generateReplyDraft(
        emailData.body,
        emailData.metadata,
        classification,
        summary,
      );

      const result: EmailTriageResult = {
        sessionId,
        emailId: emailData.id,
        classification,
        summary,
        replyDraft,
        status: "completed",
        processedAt: new Date(),
      };

      // Emit completion event for real-time updates
      this.eventEmitter.emit("email.triage.completed", {
        sessionId,
        emailId: emailData.id,
        emailAddress: emailData.metadata?.to || emailData.metadata?.emailAddress,
        subject: emailData.metadata?.subject,
        result,
        timestamp: new Date().toISOString(),
        source: context.source || 'email_manager',
      });

      this.logger.log(
        `Email triage completed successfully for session: ${sessionId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Email triage failed for session ${sessionId}: ${error.message}`,
        error.stack,
      );

      // Emit error event
      this.eventEmitter.emit("email.triage.failed", {
        sessionId,
        emailId: emailData.id,
        emailAddress: emailData.metadata?.to || emailData.metadata?.emailAddress,
        subject: emailData.metadata?.subject,
        error: error.message,
        timestamp: new Date().toISOString(),
        source: context.source || 'email_manager',
      });

      // Return failed result instead of throwing
      return {
        sessionId,
        emailId: emailData.id,
        classification: {
          priority: "normal",
          category: "other",
          reasoning: "Error occurred during classification",
          confidence: 0.0,
        },
        summary: {
          problem: "Unable to process email",
          context: "An error occurred during processing",
          ask: "Manual review required",
          summary: "Email processing failed",
        },
        replyDraft: {
          subject: `Re: ${emailData.metadata?.subject || "Your Email"}`,
          body: "Thank you for your email. We are experiencing technical difficulties and will get back to you soon.",
          tone: "professional",
          next_steps: ["Manual review", "Technical support"],
        },
        status: "failed",
        processedAt: new Date(),
      };
    }
  }
}
