import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentConfig } from './base-agent';
import { LlmService } from '../llm/llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { SENTIMENT_ANALYSIS_PROMPT } from '../../instruction-promtps';

export interface SentimentAnalysis {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  score: number; // -1 to 1 scale
  segments: Array<{
    text: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
    speaker?: string;
    timestamp?: string;
  }>;
  keyEmotions: string[];
  toneShifts: Array<{
    from: string;
    to: string;
    approximate_time?: string;
    trigger?: string;
  }>;
}

@Injectable()
export class SentimentAnalysisAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: 'SentimentAnalyzer',
      systemPrompt: SENTIMENT_ANALYSIS_PROMPT,
      llmOptions: {
        temperature: 0.3,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  /**
   * Analyze sentiment in a transcript
   */
  async analyzeSentiment(transcript: string): Promise<SentimentAnalysis> {
    const model = this.getChatModel();

    const prompt = `
    Analyze the sentiment in this meeting transcript.
    
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
        content.match(/(\{[\s\S]*\})/);

      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr) as SentimentAnalysis;
    } catch (error) {
      this.logger.error(
        `Failed to parse sentiment analysis from response: ${error.message}`,
      );
      return {
        overall: 'neutral',
        score: 0,
        segments: [],
        keyEmotions: [],
        toneShifts: [],
      };
    }
  }

  /**
   * Process a state object for sentiment analysis
   */
  async processState(state: any): Promise<any> {
    this.logger.debug('Processing state for sentiment analysis');

    if (!state.transcript) {
      this.logger.warn('No transcript found in state');
      return state;
    }

    const sentiment = await this.analyzeSentiment(state.transcript);

    return {
      ...state,
      sentiment,
    };
  }
}
