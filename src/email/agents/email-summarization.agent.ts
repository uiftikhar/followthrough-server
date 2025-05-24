import { Injectable, Inject, Logger } from '@nestjs/common';
import { LLM_SERVICE } from '../../langgraph/llm/constants/injection-tokens';
import { LlmService } from '../../langgraph/llm/llm.service';
import { EMAIL_SUMMARIZATION_CONFIG } from './constants/injection-tokens';
import { EmailSummary, EmailSummarizationConfig } from '../dtos/email-triage.dto';

@Injectable()
export class EmailSummarizationAgent {
  private readonly logger = new Logger(EmailSummarizationAgent.name);

  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    @Inject(EMAIL_SUMMARIZATION_CONFIG) private readonly config: EmailSummarizationConfig,
  ) {}

  async summarizeEmail(emailContent: string, metadata: any): Promise<EmailSummary> {
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
        { role: 'system', content: this.config.systemPrompt },
        { role: 'user', content: prompt }
      ];

      const response = await model.invoke(messages);
      const content = response.content.toString();

      // Try to parse JSON from response
      let parsedContent = content;
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
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
        problem: 'Unable to identify specific problem',
        context: 'Unable to extract context',
        ask: 'Unable to determine request',
        summary: 'Failed to summarize email automatically',
      };
    }
  }
} 