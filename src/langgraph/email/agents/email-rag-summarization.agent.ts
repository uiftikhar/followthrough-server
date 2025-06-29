import { Injectable, Inject, Logger } from "@nestjs/common";

  import {
  EmailSummary,
  EmailSummarizationConfig,
} from "../dtos/email-triage.dto";
import { EMAIL_SUMMARIZATION_CONFIG } from "./constants/injection-tokens";
import { LLM_SERVICE } from "src/langgraph/llm/constants/injection-tokens";
import { LlmService } from "src/langgraph/llm/llm.service";
import { VectorIndexes } from "src/pinecone/pinecone-index.service";
import { RAG_SERVICE, RagService } from "src/rag";

/**
 * RAG-Enhanced Email Summarization Agent
 * Uses the email-triage Pinecone index to retrieve relevant context
 * for better email summarization based on historical email patterns
 */
@Injectable()
export class EmailRagSummarizationAgent {
  private readonly logger = new Logger(EmailRagSummarizationAgent.name);

  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
    @Inject(EMAIL_SUMMARIZATION_CONFIG)
    private readonly config: EmailSummarizationConfig,
  ) {}

  async summarizeEmail(
    emailContent: string,
    metadata: any,
  ): Promise<EmailSummary> {
    this.logger.log(`RAG-Enhanced summarizing email: ${metadata.subject}`);

    try {
      // Step 1: Generate a query for RAG retrieval
      const ragQuery = `Email summary: 
Subject: ${metadata.subject}
From: ${metadata.from}
Email type and category analysis`;

      // Step 2: Retrieve relevant context from email-triage index
      this.logger.log(
        "Retrieving relevant email patterns from email-triage index",
      );
      const retrievedContext = await this.ragService.getContext(ragQuery, {
        indexName: VectorIndexes.EMAIL_TRIAGE,
        namespace: "email-summaries",
        topK: 3,
        minScore: 0.7,
      });

      // Step 3: Format context for the LLM
      let contextPrompt = "";
      if (retrievedContext && retrievedContext.length > 0) {
        contextPrompt = `

RELEVANT EMAIL PATTERNS FROM HISTORY:
${retrievedContext
  .map(
    (doc, i) => `
Example ${i + 1}:
${doc.content}
---`,
  )
  .join("\n")}

Use these patterns to help analyze the current email.`;
      }

      // Step 4: Generate summary with enhanced context
      const prompt = `${contextPrompt}

Email to summarize:
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

      const model = this.llmService.getChatModel({
        temperature: 0.2,
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

      const summary = JSON.parse(parsedContent);

      this.logger.log(
        `RAG-Enhanced email summarized successfully with ${retrievedContext.length} context documents`,
      );
      return summary;
    } catch (error) {
      this.logger.error(
        `Failed to RAG-enhance email summary: ${error.message}`,
      );

      // Fallback to basic summarization without RAG
      return this.fallbackSummarization(emailContent, metadata);
    }
  }

  /**
   * Fallback summarization without RAG context
   */
  private async fallbackSummarization(
    emailContent: string,
    metadata: any,
  ): Promise<EmailSummary> {
    this.logger.log("Using fallback summarization without RAG");

    const prompt = `Email to summarize:
Subject: ${metadata.subject}
From: ${metadata.from}
Body: ${emailContent}

Extract and summarize:
1. **Problem**: What issue is the sender facing?
2. **Context**: What background information is provided?
3. **Ask**: What specific action or response do they want?

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

      let parsedContent = content;
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) ||
        content.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        parsedContent = jsonMatch[1];
      }

      return JSON.parse(parsedContent);
    } catch (error) {
      this.logger.error(`Fallback summarization also failed: ${error.message}`);

      // Final fallback with hardcoded response
      return {
        problem: "Unable to identify specific problem",
        context: "Unable to extract context",
        ask: "Unable to determine request",
        summary: "Failed to summarize email automatically",
      };
    }
  }
}
