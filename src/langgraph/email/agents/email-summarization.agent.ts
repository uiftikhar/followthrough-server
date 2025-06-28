import { Injectable, Inject, Logger } from "@nestjs/common";
import { BaseAgent, AgentConfig } from "../../agents/base-agent";
import { LLM_SERVICE } from "../../llm/constants/injection-tokens";
import { LlmService } from "../../llm/llm.service";
import { EMAIL_SUMMARIZATION_CONFIG } from "./constants/injection-tokens";
import {
  EmailSummary,
  EmailSummarizationConfig,
} from "../dtos/email-triage.dto";

@Injectable()
export class EmailSummarizationAgent extends BaseAgent {
  protected readonly logger = new Logger(EmailSummarizationAgent.name);

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(EMAIL_SUMMARIZATION_CONFIG)
    private readonly config: EmailSummarizationConfig,
  ) {
    // Configure BaseAgent with email summarization settings
    const agentConfig: AgentConfig = {
      name: config.name || "Email Summarization Agent",
      systemPrompt: config.systemPrompt,
      llmOptions: {
        temperature: 0.3,
        model: "gpt-4o",
        maxTokens: 300,
      },
    };
    super(llmService, agentConfig);
  }

  /**
   * Process state for LangGraph workflow
   * This is the main entry point for the agent in the LangGraph flow
   */
  async processState(state: any): Promise<any> {
    this.logger.log("Processing email summarization state");

    if (!state.emailData) {
      this.logger.warn("No email data found in state");
      return state;
    }

    try {
      const summary = await this.summarizeEmail(
        state.emailData.body,
        state.emailData.metadata,
      );

      return {
        ...state,
        summary,
      };
    } catch (error) {
      this.logger.error(`Email summarization failed: ${error.message}`);
      
      // Return state with fallback summary
      return {
        ...state,
        summary: {
          briefSummary: "Unable to generate summary",
          keyPoints: ["Email processing failed"],
          sentiment: "neutral",
        },
      };
    }
  }

  async summarizeEmail(
    emailContent: string,
    metadata: any,
  ): Promise<EmailSummary> {
    this.logger.log(`Summarizing email: ${metadata.subject}`);

    const prompt = `Email to summarize:
Subject: ${metadata.subject}
From: ${metadata.from}
Body: ${emailContent}

Extract and summarize:
1. **Problem**: What issue is the sender facing?
2. **Context**: What background information is provided?
3. **Ask**: What specific action or response do they want?

Keep summary under ${this.config.maxSummaryLength} characters.

Respond in JSON format:
{
  "problem": "brief description of the issue",
  "context": "relevant background information", 
  "ask": "what they want us to do",
  "summary": "one-sentence overall summary"
}`;

    try {
      const model = this.llmService.getChatModel({
        temperature: 0.2,
        maxTokens: 300,
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

      const summary = JSON.parse(parsedContent);

      this.logger.log(`Email summarized successfully`);
      return summary;
    } catch (error) {
      this.logger.error(`Failed to summarize email: ${error.message}`);

      // Return default summary on error
      return {
        problem: "Unable to identify specific problem",
        context: "Unable to extract context",
        ask: "Unable to determine request",
        summary: "Failed to summarize email automatically",
      };
    }
  }
}
