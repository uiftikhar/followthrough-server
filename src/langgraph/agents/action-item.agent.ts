import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentConfig } from './base-agent';
import { LlmService } from '../llm/llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { EXTRACT_ACTION_ITEMS_PROMPT } from '../../instruction-promtps';

export interface ActionItem {
  description: string;
  assignee?: string;
  deadline?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  context?: string;
}

@Injectable()
export class ActionItemAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: 'ActionItemExtractor',
      systemPrompt: EXTRACT_ACTION_ITEMS_PROMPT,
      llmOptions: {
        temperature: 0.2,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  /**
   * Extract action items from a transcript
   */
  async extractActionItems(transcript: string): Promise<ActionItem[]> {
    const model = this.getChatModel();

    const prompt = `
    Analyze the following meeting transcript and extract all action items:

    Transcript:
    ${transcript}
    `;

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
        content.match(/(\[\s*\{[\s\S]*\}\s*\])/);

      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr) as ActionItem[];
    } catch (error) {
      this.logger.error(
        `Failed to parse action items from response: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Process a state object for action item extraction
   */
  async processState(state: any): Promise<any> {
    this.logger.debug('Processing state for action item extraction');

    if (!state.transcript) {
      this.logger.warn('No transcript found in state');
      return state;
    }

    const actionItems = await this.extractActionItems(state.transcript);

    return {
      ...state,
      actionItems,
    };
  }
}
