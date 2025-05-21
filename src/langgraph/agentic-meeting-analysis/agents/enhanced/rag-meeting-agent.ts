import { Injectable, Inject } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import {
  RagEnhancedAgent,
  RagAgentConfig,
  RagAgentOptions,
} from '../../../../rag/agents/rag-enhanced-agent';
import { IRagService } from '../../../../rag/interfaces/rag-service.interface';
import { RetrievalOptions } from '../../../../rag/retrieval.service';
import { RAG_SERVICE } from '../../../../rag/constants/injection-tokens';
import { LLM_SERVICE } from '../../../llm/constants/injection-tokens';
import { STATE_SERVICE } from '../../../state/constants/injection-tokens';
import { LlmService } from '../../../llm/llm.service';
import { StateService } from '../../../state/state.service';
import { AgentExpertise } from '../../interfaces/agent.interface';
import {
  EXTRACT_ACTION_ITEMS_PROMPT,
  ANALYZE_PARTICIPATION_PROMPT,
  FINAL_MEETING_SUMMARY_PROMPT,
  MEETING_CHUNK_ANALYSIS_PROMPT,
  MEETING_EFFECTIVENESS_PROMPT,
  CONTEXT_INTEGRATION_PROMPT,
  COORDINATION_PROMPT,
  MANAGEMENT_PROMPT,
  SENTIMENT_ANALYSIS_PROMPT
} from '../../../../instruction-promtps';

// Define token locally to avoid circular dependency
export const RAG_MEETING_ANALYSIS_CONFIG = 'RAG_MEETING_ANALYSIS_CONFIG';

export interface RagMeetingAnalysisConfig extends RagAgentConfig {
  expertise?: AgentExpertise[];
  specializationPrompt?: string;
  specializedQueries?: Record<string, string>;
  /**
   * Whether to include transcripts in the state as is or process them for RAG
   */
  processTranscriptsForRag?: boolean;
}

/**
 * RAG-enhanced agent specialized for meeting analysis
 */
@Injectable()
export class RagMeetingAnalysisAgent extends RagEnhancedAgent {
  protected readonly expertise: AgentExpertise[];
  protected readonly specializationPrompt: string;
  protected readonly specializedQueries: Record<string, string>;
  protected readonly processTranscriptsForRag: boolean;
  private readonly ragConfiguration: RagAgentOptions;
  private readonly expertisePrompts: Record<AgentExpertise, string>;

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: IRagService,
    @Inject(RAG_MEETING_ANALYSIS_CONFIG) config: RagMeetingAnalysisConfig,
  ) {
    // Keep a copy of the configuration for later use
    const ragConfig = config.ragOptions || {
      includeRetrievedContext: true,
      retrievalOptions: {
        indexName: 'meeting-analysis',
        namespace: 'transcripts',
        topK: 5,
        minScore: 0.7,
      },
    };

    super(llmService, stateService, ragService, {
      name: config.name || 'Meeting Analysis Agent',
      systemPrompt:
        config.systemPrompt ||
        'You are an AI assistant specialized in analyzing meeting transcripts.',
      llmOptions: config.llmOptions,
      ragOptions: ragConfig,
    });

    this.expertise = config.expertise || [AgentExpertise.TOPIC_ANALYSIS];
    this.specializationPrompt = config.specializationPrompt || '';
    this.processTranscriptsForRag = config.processTranscriptsForRag !== false;
    this.ragConfiguration = ragConfig;

    // Set up expertise-specific prompts
    this.expertisePrompts = {
      [AgentExpertise.TOPIC_ANALYSIS]: MEETING_CHUNK_ANALYSIS_PROMPT,
      [AgentExpertise.ACTION_ITEM_EXTRACTION]: EXTRACT_ACTION_ITEMS_PROMPT,
      [AgentExpertise.PARTICIPANT_DYNAMICS]: ANALYZE_PARTICIPATION_PROMPT,
      [AgentExpertise.SUMMARY_GENERATION]: FINAL_MEETING_SUMMARY_PROMPT,
      [AgentExpertise.DECISION_TRACKING]: MEETING_EFFECTIVENESS_PROMPT,
      [AgentExpertise.SENTIMENT_ANALYSIS]: SENTIMENT_ANALYSIS_PROMPT,
      [AgentExpertise.CONTEXT_INTEGRATION]: CONTEXT_INTEGRATION_PROMPT,
      [AgentExpertise.COORDINATION]: COORDINATION_PROMPT,
      [AgentExpertise.MANAGEMENT]: MANAGEMENT_PROMPT,
    } as Record<AgentExpertise, string>;

    // Set up specialized query templates based on expertise
    this.specializedQueries = {
      [AgentExpertise.TOPIC_ANALYSIS]:
        'What are the main topics discussed in this meeting?',
      [AgentExpertise.ACTION_ITEM_EXTRACTION]:
        'What action items were assigned in this meeting?',
      [AgentExpertise.DECISION_TRACKING]:
        'What key decisions were made in this meeting?',
      [AgentExpertise.SUMMARY_GENERATION]:
        'Provide a comprehensive summary of this meeting',
      [AgentExpertise.SENTIMENT_ANALYSIS]:
        'What was the sentiment and emotional tone of this meeting?',
      [AgentExpertise.PARTICIPANT_DYNAMICS]:
        'How did participants interact during this meeting?',
      ...(config.specializedQueries || {}),
    };
  }

  /**
   * Extract a relevant query from the state based on expertise
   */
  protected extractQueryFromState(state: any): string {
    // If transcript is available, use it as the base query
    let query = '';

    if (typeof state === 'object') {
      if (state.transcript) {
        // Start with a shorter version of the transcript to avoid token limits
        const transcript =
          typeof state.transcript === 'string'
            ? state.transcript.substring(0, 500)
            : JSON.stringify(state.transcript).substring(0, 500);

        query = transcript;

        // If we have topics, add them to focus the query
        if (
          state.topics &&
          Array.isArray(state.topics) &&
          state.topics.length > 0
        ) {
          const topicStr = state.topics.map((t: any) => t.name || t).join(', ');
          query = `Topics: ${topicStr}\n\n${query}`;
        }
      } else {
        // No transcript, use the expertise to guide the query
        query = JSON.stringify(state);
      }
    } else {
      query = String(state);
    }

    // Enhance with specialized queries based on expertise
    const expertiseQuery = this.getSpecializedQuery();
    if (expertiseQuery) {
      query = `${expertiseQuery}\n\n${query}`;
    }

    return query;
  }

  /**
   * Get a specialized query based on agent expertise
   */
  protected getSpecializedQuery(): string {
    if (!this.expertise || this.expertise.length === 0) {
      return '';
    }

    // Use the first expertise for query specialization
    const primaryExpertise = this.expertise[0];
    return this.specializedQueries[primaryExpertise] || '';
  }

  /**
   * Override to enhance the system prompt with expertise-specific instructions
   */
  protected getSystemPrompt(): string {
    // Get the primary expertise
    const primaryExpertise = this.expertise[0];
    
    // Try to get a specialized prompt for this expertise
    let expertisePrompt = this.expertisePrompts[primaryExpertise];
    
    // If no specialized prompt is available, use a default
    if (!expertisePrompt) {
      // Get the system prompt from constructor config instead of super.systemPrompt
      let enhancedPrompt = 'You are an AI agent specialized in meeting analysis.';

      // Add specialization based on expertise
      if (this.expertise && this.expertise.length > 0) {
        enhancedPrompt += `\n\nYou specialize in: ${this.expertise.join(', ')}.`;
      }

      // Add custom specialization prompt if provided
      if (this.specializationPrompt) {
        enhancedPrompt += `\n\n${this.specializationPrompt}`;
      }

      return enhancedPrompt;
    }
    
    return expertisePrompt;
  }

  /**
   * Enhanced formatting for meeting-specific contexts
   */
  protected formatRetrievedContext(context: any): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return '';
    }

    // Enhanced formatting specific to meeting analysis
    return `
RELEVANT MEETING CONTEXT:
------------------------
${context.documents
  .map((doc: any, index: number) => {
    const metadata = doc.metadata || {};
    const meetingId = metadata.meetingId || metadata.meeting_id || 'unknown';
    const date = metadata.date || 'unknown';
    const relevance = doc.score
      ? ` (Relevance: ${(doc.score * 100).toFixed(1)}%)`
      : '';

    return `[Meeting ${meetingId} - ${date}]${relevance}\n${doc.content}`;
  })
  .join('\n\n')}
------------------------
`;
  }

  /**
   * Process a transcript with RAG capabilities
   */
  async analyzeTranscript(
    transcript: string,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      expertise?: AgentExpertise;
      retrievalOptions?: RetrievalOptions;
    },
  ): Promise<any> {
    try {
      const expertise = options?.expertise || this.expertise[0];
      const meetingId = options?.meetingId || `meeting-${Date.now()}`;

      // Create a state object with the transcript
      const state = {
        transcript,
        meetingId,
        expertise,
        participants: options?.participantNames || [],
      };

      // Prepare retrieval options with meetingId filter
      const retrievalOptions: RetrievalOptions = {
        ...(options?.retrievalOptions || {}),
        filter: {
          ...(options?.retrievalOptions?.filter || {}),
          meetingId,
        },
        minScore: options?.retrievalOptions?.minScore || 0.7,
      };

      // Extract a query from the state to use for retrieval
      const query = this.extractQueryFromState(state);

      // First, enhance the state with context
      const enhancedState = await this.ragService.enhanceStateWithContext(
        state,
        query,
        retrievalOptions,
      );

      // Process the enhanced state
      const result = await this.processState(enhancedState);

      return result;
    } catch (error) {
      this.logger.error(
        `Error analyzing transcript with RAG: ${error.message}`,
      );
      throw error;
    }
  }
}
