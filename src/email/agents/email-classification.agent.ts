import { Injectable, Inject, Logger } from "@nestjs/common";
import { LLM_SERVICE } from "../../langgraph/llm/constants/injection-tokens";
import { LlmService } from "../../langgraph/llm/llm.service";
import { EMAIL_CLASSIFICATION_CONFIG } from "./constants/injection-tokens";
import {
  EmailClassification,
  EmailClassificationConfig,
} from "../dtos/email-triage.dto";

@Injectable()
export class EmailClassificationAgent {
  private readonly logger = new Logger(EmailClassificationAgent.name);

  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    @Inject(EMAIL_CLASSIFICATION_CONFIG)
    private readonly config: EmailClassificationConfig,
  ) {}

  async classifyEmail(
    emailContent: string,
    metadata: any,
  ): Promise<EmailClassification> {
    this.logger.log(`Classifying email: ${metadata.subject}`);

    const prompt = `Email to classify:
Subject: ${metadata.subject}
From: ${metadata.from}
Body: ${emailContent}

Classify this email with:
1. Priority: ${this.config.priorities.join(", ")}
2. Category: ${this.config.categories.join(", ")}
3. Reasoning: Brief explanation

Respond in JSON format:
{
  "priority": "urgent|high|normal|low",
  "category": "bug_report|feature_request|question|complaint|praise|other",
  "reasoning": "explanation",
  "confidence": 0.95
}`;

    try {
      const model = this.llmService.getChatModel({
        temperature: 0.1,
        maxTokens: 200,
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

      const classification = JSON.parse(parsedContent);

      this.logger.log(
        `Email classified as ${classification.priority} priority, ${classification.category} category`,
      );
      return classification;
    } catch (error) {
      this.logger.error(`Failed to classify email: ${error.message}`);

      // Return default classification on error
      return {
        priority: "normal",
        category: "other",
        reasoning: "Failed to classify email automatically",
        confidence: 0.0,
      };
    }
  }
}
