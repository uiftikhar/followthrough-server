import { Injectable, Inject, Logger } from "@nestjs/common";
import { LLM_SERVICE } from "../../llm/constants/injection-tokens";
import { LlmService } from "../../llm/llm.service";
import { DelegationResult } from "../dtos/email-triage.dto";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface DelegationSummary {
  summary: string;
  emailBody: string;
  recommendedActions: string[];
}

/**
 * EmailDelegationAgent - Handles human-to-human email delegation
 * Part of Phase 5 implementation for team collaboration
 * Generates AI-powered delegation summaries and sends notifications
 */
@Injectable()
export class EmailDelegationAgent {
  private readonly logger = new Logger(EmailDelegationAgent.name);

  constructor(@Inject(LLM_SERVICE) private readonly llmService: LlmService) {}

  /**
   * Delegate an email from one user to another with AI-generated summary
   */
  async delegateEmail(
    emailId: string,
    emailData: any,
    triageResult: any,
    delegator: User,
    delegateTo: User,
    notes?: string,
  ): Promise<DelegationResult> {
    this.logger.log(
      `Delegating email ${emailId} from ${delegator.name} to ${delegateTo.name}`,
    );

    try {
      // Generate AI-powered delegation summary
      const delegationSummary = await this.generateDelegationSummary(
        emailData,
        triageResult,
        delegator,
        delegateTo,
        notes,
      );

      // Send delegation email to teammate
      await this.sendDelegationEmail(
        emailData,
        delegationSummary,
        delegator,
        delegateTo,
      );

      // Create delegation record
      const delegation: DelegationResult = {
        id: `delegation-${Date.now()}`,
        emailId,
        delegatorId: delegator.id,
        delegateId: delegateTo.id,
        notes: notes || "",
        summary: delegationSummary.summary,
        status: "pending",
        createdAt: new Date(),
      };

      this.logger.log(`Email delegation completed: ${delegation.id}`);
      return delegation;
    } catch (error) {
      this.logger.error(
        `Email delegation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate AI-powered delegation summary using LLM
   */
  private async generateDelegationSummary(
    emailData: any,
    triageResult: any,
    delegator: User,
    delegateTo: User,
    notes?: string,
  ): Promise<DelegationSummary> {
    this.logger.log("Generating AI-powered delegation summary");

    const prompt = `Generate a professional delegation summary for the following email:

ORIGINAL EMAIL:
Subject: ${emailData.metadata?.subject || "No subject"}
From: ${emailData.metadata?.from || "Unknown sender"}
Body: ${emailData.body}

TRIAGE ANALYSIS:
Priority: ${triageResult?.classification?.priority || "Unknown"}
Category: ${triageResult?.classification?.category || "Unknown"}
Problem: ${triageResult?.summary?.problem || "Not analyzed"}
Context: ${triageResult?.summary?.context || "Not analyzed"}
Ask: ${triageResult?.summary?.ask || "Not analyzed"}

DELEGATION CONTEXT:
Delegator: ${delegator.name} (${delegator.email})
Delegate: ${delegateTo.name} (${delegateTo.email})
Additional Notes: ${notes || "None provided"}

Create a delegation summary that includes:
1. A brief summary of why this email is being delegated
2. Key context and urgency
3. Recommended next steps
4. Professional delegation email body

Respond in JSON format:
{
  "summary": "Brief delegation reason and context",
  "emailBody": "Complete professional email body for the delegate",
  "recommendedActions": ["action1", "action2", "action3"]
}`;

    try {
      const model = this.llmService.getChatModel({
        temperature: 0.3,
        maxTokens: 500,
      });

      const messages = [
        {
          role: "system",
          content:
            "You are an AI assistant specialized in generating professional delegation summaries for team collaboration. Be clear, concise, and actionable.",
        },
        { role: "user", content: prompt },
      ];

      const response = await model.invoke(messages);
      const content = response.content.toString();

      // Try to parse JSON from response
      let parsedContent = content;
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) ||
        content.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        parsedContent = jsonMatch[1];
      }

      const summary = JSON.parse(parsedContent);

      this.logger.log("Delegation summary generated successfully");
      return summary;
    } catch (error) {
      this.logger.error(
        `Failed to generate delegation summary: ${error.message}`,
      );

      // Return fallback summary on error
      return {
        summary: `Email delegation from ${delegator.name} to ${delegateTo.name}`,
        emailBody: `Dear ${delegateTo.name},

${delegator.name} has delegated the following email to you for handling:

Subject: ${emailData.metadata?.subject || "Email"}
From: ${emailData.metadata?.from || "Unknown sender"}
Priority: ${triageResult?.classification?.priority || "Normal"}

${notes ? `Additional notes: ${notes}` : ""}

Please review and respond accordingly.

Best regards,
Email Triage System`,
        recommendedActions: [
          "Review email",
          "Respond to sender",
          "Update delegation status",
        ],
      };
    }
  }

  /**
   * Send delegation email notification to teammate
   */
  private async sendDelegationEmail(
    emailData: any,
    delegationSummary: DelegationSummary,
    delegator: User,
    delegateTo: User,
  ): Promise<void> {
    this.logger.log(`Sending delegation email to ${delegateTo.email}`);

    try {
      // For now, we'll log the email that would be sent
      // In a real implementation, this would use an actual email service
      const delegationEmail = {
        to: delegateTo.email,
        from: delegator.email,
        subject: `Email Delegated: ${emailData.metadata?.subject || "Untitled"}`,
        body: delegationSummary.emailBody,
        metadata: {
          delegationId: `delegation-${Date.now()}`,
          originalEmailId: emailData.id,
          delegatorId: delegator.id,
          delegateId: delegateTo.id,
        },
      };

      // Log the delegation email (in production, replace with actual email sending)
      this.logger.log(
        "Delegation email would be sent:",
        JSON.stringify(delegationEmail, null, 2),
      );

      // TODO: Implement actual email sending via external email service
      // For now, we simulate successful email sending

      this.logger.log("Delegation email simulation completed successfully");
    } catch (error) {
      this.logger.error(
        `Failed to send delegation email: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update delegation status (e.g., accepted, completed)
   */
  async updateDelegationStatus(
    delegationId: string,
    status: "pending" | "accepted" | "completed",
    notes?: string,
  ): Promise<void> {
    this.logger.log(`Updating delegation ${delegationId} status to ${status}`);

    // TODO: Implement delegation status persistence
    // For now, just log the update
    this.logger.log(`Delegation ${delegationId} status updated: ${status}`, {
      notes,
    });
  }

  /**
   * Get delegation history for an email
   */
  async getDelegationHistory(emailId: string): Promise<DelegationResult[]> {
    this.logger.log(`Getting delegation history for email ${emailId}`);

    // TODO: Implement delegation history retrieval
    // For now, return empty array
    return [];
  }
}
