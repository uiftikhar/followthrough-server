import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentConfig } from './base-agent';
import { LlmService } from '../llm/llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface Topic {
  name: string;
  subtopics?: string[];
  duration?: number;
  participants?: string[];
  relevance?: number;
}

@Injectable()
export class TopicExtractionAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: 'TopicExtractor',
      systemPrompt:
        'You are a specialized agent for extracting key topics from meeting transcripts. Identify main themes, discussions, and subject areas covered in the transcript.',
      llmOptions: {
        temperature: 0.3,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  /**
   * Extract topics from a transcript
   */
  async extractTopics(transcript: string): Promise<Topic[]> {
    const model = this.getChatModel();

    const prompt = `
    Extract the main topics discussed in this meeting transcript. 
    For each topic, include:
    - The name of the topic
    - Any subtopics (if applicable)
    - Approximate duration of discussion (if it can be inferred)
    - Main participants (if they can be identified)
    - Relevance to the overall meeting (on a scale of 1-10)

    Format the response as a JSON array of topic objects.

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
      return JSON.parse(jsonStr) as Topic[];
    } catch (error) {
      this.logger.error(
        `Failed to parse topics from response: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Process a state object for topic extraction
   */
  async processState(state: any): Promise<any> {
    this.logger.debug('Processing state for topic extraction');

    if (!state.transcript) {
      this.logger.warn('No transcript found in state');
      return state;
    }

    const topics = await this.extractTopics(state.transcript);

    return {
      ...state,
      topics,
    };
  }
}
