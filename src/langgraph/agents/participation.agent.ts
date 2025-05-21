import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentConfig } from './base-agent';
import { LlmService } from '../llm/llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ANALYZE_PARTICIPATION_PROMPT } from '../../instruction-promtps';

export interface ParticipationAnalysis {
  participants: Array<{
    name: string;
    speaking_time_percentage?: number;
    contribution_quality?: number; // 1-10 scale
    key_contributions?: string[];
    interaction_patterns?: Array<{
      interacted_with: string;
      interaction_type:
        | 'agreement'
        | 'disagreement'
        | 'question'
        | 'answer'
        | 'support'
        | 'challenge';
      frequency: number;
    }>;
  }>;
  group_dynamics: {
    dominating_participants?: string[];
    balanced?: boolean;
    collaboration_score?: number; // 1-10 scale
    key_observations?: string[];
  };
  engagement_patterns?: {
    high_engagement_topics?: string[];
    low_engagement_topics?: string[];
    engagement_shifts?: Array<{
      from: string;
      to: string;
      approximate_time?: string;
      trigger?: string;
    }>;
  };
}

@Injectable()
export class ParticipationAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: 'ParticipationAgent',
      systemPrompt: ANALYZE_PARTICIPATION_PROMPT,
      llmOptions: {
        temperature: 0.3,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  /**
   * Analyze participation patterns in a transcript
   */
  async analyzeParticipation(
    transcript: string,
    topics?: any[],
  ): Promise<ParticipationAnalysis> {
    const model = this.getChatModel();

    let prompt = `
    Analyze the participation patterns and group dynamics in this meeting transcript.
    
    Transcript:
    ${transcript}
    `;

    // Add additional context if available
    if (topics && topics.length > 0) {
      prompt += `\nExtracted Topics:\n${JSON.stringify(topics, null, 2)}`;
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
      return JSON.parse(jsonStr) as ParticipationAnalysis;
    } catch (error) {
      this.logger.error(
        `Failed to parse participation analysis from response: ${error.message}`,
      );
      return {
        participants: [],
        group_dynamics: {
          balanced: false,
          key_observations: ['Unable to parse participation details'],
        },
      };
    }
  }

  /**
   * Process a state object for participation analysis
   */
  async processState(state: any): Promise<any> {
    this.logger.debug('Processing state for participation analysis');

    if (!state.transcript) {
      this.logger.warn('No transcript found in state');
      return state;
    }

    const participation = await this.analyzeParticipation(
      state.transcript,
      state.topics,
    );

    return {
      ...state,
      participation,
    };
  }
}
