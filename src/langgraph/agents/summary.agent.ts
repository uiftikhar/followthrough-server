import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentConfig } from './base-agent';
import { LlmService } from '../llm/llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { FINAL_MEETING_SUMMARY_PROMPT } from '../../instruction-promtps';

export interface MeetingSummary {
  meetingTitle: string;
  summary: string;
  decisions: Array<{
    title: string;
    content: string;
  }>;
  next_steps?: string[];
}

@Injectable()
export class SummaryAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: 'SummaryAgent',
      systemPrompt: FINAL_MEETING_SUMMARY_PROMPT,
      llmOptions: {
        temperature: 0.4,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  /**
   * Generate a summary from a transcript and analysis data
   */
  async generateSummary(
    transcript: string,
    topics?: any[],
    actionItems?: any[],
    sentiment?: any,
  ): Promise<MeetingSummary> {
    const model = this.getChatModel();

    let prompt = `
    Generate a comprehensive summary of this meeting.
    
    Transcript:
    ${transcript}
    `;

    // Add additional context if available
    if (topics && topics.length > 0) {
      prompt += `\nExtracted Topics:\n${JSON.stringify(topics, null, 2)}`;
    }

    if (actionItems && actionItems.length > 0) {
      prompt += `\nAction Items:\n${JSON.stringify(actionItems, null, 2)}`;
    }

    if (sentiment) {
      prompt += `\nSentiment Analysis:\n${JSON.stringify(sentiment, null, 2)}`;
    }

    const messages = [
      new SystemMessage(this.systemPrompt),
      new HumanMessage(prompt),
    ];

    const response = await model.invoke(messages);

    try {
      // Extract JSON from the response
      const content = response.content.toString();
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) ||
        content.match(/(\{[\s\S]*\})/);

      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr) as MeetingSummary;
    } catch (error) {
      this.logger.error(
        `Failed to parse summary from response: ${error.message}`,
      );
      return {
        meetingTitle: 'Meeting Summary',
        summary: 'This is a placeholder summary due to parsing error.',
        decisions: [],
        next_steps: [],
      };
    }
  }

  /**
   * Process a state object to generate a summary
   */
  async processState(state: any): Promise<any> {
    this.logger.debug('Processing state for summary generation');

    if (!state.transcript) {
      this.logger.warn('No transcript found in state');
      return state;
    }

    const summary = await this.generateSummary(
      state.transcript,
      state.topics,
      state.actionItems,
      state.sentiment,
    );

    return {
      ...state,
      summary,
    };
  }
}
