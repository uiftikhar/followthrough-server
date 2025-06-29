import { Injectable, Inject, Logger } from "@nestjs/common";
import { BaseAgent, AgentConfig } from "../../agents/base-agent";
import { LLM_SERVICE } from "../../llm/constants/injection-tokens";
import { LlmService } from "../../llm/llm.service";
import { EMAIL_REPLY_DRAFT_CONFIG } from "./constants/injection-tokens";
import {
  EmailReplyDraft,
  EmailReplyDraftConfig,
  EmailClassification,
  EmailSummary,
} from "../dtos/email-triage.dto";

@Injectable()
export class EmailReplyDraftAgent extends BaseAgent {
  protected readonly logger = new Logger(EmailReplyDraftAgent.name);

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(EMAIL_REPLY_DRAFT_CONFIG)
    private readonly config: EmailReplyDraftConfig,
  ) {
    // Configure BaseAgent with email reply draft settings
    const agentConfig: AgentConfig = {
      name: config.name || "Email Reply Draft Agent",
      systemPrompt: config.systemPrompt,
      llmOptions: {
        temperature: 0.7,
        model: "gpt-4o",
        maxTokens: 500,
      },
    };
    super(llmService, agentConfig);
  }

  /**
   * Process state for LangGraph workflow
   * This is the main entry point for the agent in the LangGraph flow
   */
  async processState(state: any): Promise<any> {
    this.logger.log("Processing email reply draft state");

    if (!state.emailData) {
      this.logger.warn("No email data found in state");
      return state;
    }

    try {
      const replyDraft = await this.generateReplyDraft(
        state.emailData.body,
        state.emailData.metadata,
        state.classification,
        state.summary,
      );

      return {
        ...state,
        replyDraft,
      };
    } catch (error) {
      this.logger.error(`Email reply draft generation failed: ${error.message}`);
      
      // Return state with fallback reply
      return {
        ...state,
        replyDraft: {
          subject: `Re: ${state.emailData.metadata?.subject || "Email"}`,
          body: "Thank you for your email. We have received your message and will respond accordingly.",
          tone: "professional",
          confidence: 0.0,
        },
      };
    }
  }

  async generateReplyDraft(
    emailContent: string,
    metadata: any,
    classification: EmailClassification,
    summary: EmailSummary,
  ): Promise<EmailReplyDraft> {
    this.logger.log(`Generating reply draft for: ${metadata.subject}`);

    const template =
      this.config.replyTemplates[classification.priority] ||
      this.config.replyTemplates[classification.category] ||
      this.config.replyTemplates.normal ||
      "Hi {{sender_name}}, Thank you for contacting us...";

    const prompt = `Original Email:
Subject: ${metadata.subject}
From: ${metadata.from}
Classification: ${classification.priority} priority, ${classification.category}
Summary: ${summary.summary}

Base Template: ${template}

Generate a professional reply draft that:
1. Acknowledges their ${summary.problem}
2. Shows understanding of their ${summary.context}
3. Addresses their ${summary.ask}
4. Maintains appropriate tone for ${classification.priority} priority

Personalize with sender name: ${metadata.from}

Respond in JSON format:
{
  "subject": "Re: ${metadata.subject}",
  "body": "complete reply draft",
  "tone": "professional|friendly|urgent",
  "next_steps": ["action1", "action2"]
}`;

    try {
      const model = this.llmService.getChatModel({
        temperature: 0.3,
        maxTokens: 400,
      });

      const messages = [
        { role: "system", content: this.config.systemPrompt },
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

      const replyDraft = JSON.parse(parsedContent);

      this.logger.log(`Reply draft generated successfully`);
      return replyDraft;
    } catch (error) {
      this.logger.error(`Failed to generate reply draft: ${error.message}`);

      // Return default reply draft on error
      return {
        subject: `Re: ${metadata.subject}`,
        body: `Dear ${metadata.from},\n\nThank you for your email. We have received your message and will get back to you soon.\n\nBest regards,\nSupport Team`,
        tone: "professional",
        next_steps: ["Review request", "Respond within 24 hours"],
      };
    }
  }
}
