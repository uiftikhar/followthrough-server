import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentConfig } from './base-agent';
import { LlmService } from '../llm/llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { CONTEXT_INTEGRATION_PROMPT } from '../../instruction-promtps';

export interface RetrievedContext {
  source: string;
  content: string;
  metadata?: Record<string, any>;
  relevance_score?: number;
}

export interface EnrichedContext {
  original_topics: any[];
  enriched_topics: any[];
  related_meetings?: Array<{
    meeting_id: string;
    title: string;
    date: string;
    relevance: number;
    relevant_topics: string[];
  }>;
  background_knowledge?: Array<{
    topic: string;
    context: string;
    source?: string;
  }>;
  historical_context?: string;
  domain_specific_insights?: Array<{
    topic: string;
    insight: string;
    confidence: number;
  }>;
}

@Injectable()
export class ContextIntegrationAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: 'ContextIntegrationAgent',
      systemPrompt: CONTEXT_INTEGRATION_PROMPT,
      llmOptions: {
        temperature: 0.3,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  /**
   * Integrate retrieved context with the current meeting state
   */
  async integrateContext(
    transcript: string,
    topics: any[],
    retrievedContext: RetrievedContext[],
  ): Promise<EnrichedContext> {
    const model = this.getChatModel();

    const prompt = `
    Integrate the provided context with the current meeting transcript and topics.
    
    Meeting Transcript:
    ${transcript}
    
    Extracted Topics:
    ${JSON.stringify(topics, null, 2)}
    
    Retrieved Context:
    ${JSON.stringify(retrievedContext, null, 2)}
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
      return JSON.parse(jsonStr) as EnrichedContext;
    } catch (error) {
      this.logger.error(
        `Failed to parse context integration from response: ${error.message}`,
      );
      return {
        original_topics: topics,
        enriched_topics: topics,
      };
    }
  }

  /**
   * Process a state object for context integration
   */
  async processState(state: any): Promise<any> {
    this.logger.debug('Processing state for context integration');

    if (!state.transcript || !state.topics || !state.retrievedContext) {
      this.logger.warn('Missing required data for context integration');
      return state;
    }

    const enrichedContext = await this.integrateContext(
      state.transcript,
      state.topics,
      state.retrievedContext,
    );

    return {
      ...state,
      enrichedContext,
    };
  }
}
