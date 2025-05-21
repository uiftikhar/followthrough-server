import { Injectable, Inject } from '@nestjs/common';
import { IRagService } from '../../../../rag/interfaces/rag-service.interface';
import { RAG_SERVICE } from '../../../../rag/constants/injection-tokens';
import { LLM_SERVICE } from '../../../llm/constants/injection-tokens';
import { STATE_SERVICE } from '../../../state/constants/injection-tokens';
import { LlmService } from '../../../llm/llm.service';
import { StateService } from '../../../state/state.service';
import { AgentExpertise } from '../../interfaces/agent.interface';
import { Topic } from '../../interfaces/state.interface';
import { MEETING_CHUNK_ANALYSIS_PROMPT } from '../../../../instruction-promtps';

// Define the token here to avoid circular import
export const RAG_TOPIC_EXTRACTION_CONFIG = 'RAG_TOPIC_EXTRACTION_CONFIG';

// Import the RagMeetingAnalysisAgent after declaring the token
import {
  RagMeetingAnalysisAgent,
  RagMeetingAnalysisConfig,
} from './rag-meeting-agent';

/**
 * RAG-Enhanced Topic Extraction Agent
 *
 * Specialized agent for extracting topics from meeting transcripts
 * with enhanced context from previous meetings
 */
@Injectable()
export class RagTopicExtractionAgent extends RagMeetingAnalysisAgent {
  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: IRagService,
    @Inject(RAG_TOPIC_EXTRACTION_CONFIG) config: RagMeetingAnalysisConfig,
  ) {
    super(llmService, stateService, ragService, {
      ...config,
      systemPrompt: config.systemPrompt || MEETING_CHUNK_ANALYSIS_PROMPT,
    });
  }

  /**
   * Extract topics from a meeting transcript
   */
  async extractTopics(
    transcript: string,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      retrievalOptions?: {
        includeHistoricalTopics?: boolean;
        topK?: number;
        minScore?: number;
      };
    },
  ): Promise<Topic[]> {
    try {
      // Create a base state for RAG enhancement
      const baseState = { transcript };

      // Prepare retrieval options
      const retrievalOptions = {
        indexName: 'meeting-analysis',
        namespace: 'topics',
        topK: options?.retrievalOptions?.topK || 5,
        minScore: options?.retrievalOptions?.minScore || 0.7,
      };

      // Enhance state with RAG context before proceeding
      const enhancedState = await this.ragService.enhanceStateWithContext(
        baseState,
        'topic extraction',
        retrievalOptions,
      );

      // Now analyze with the enhanced context
      const result = await this.analyzeTranscript(transcript, {
        meetingId: options?.meetingId,
        participantNames: options?.participantNames,
        expertise: AgentExpertise.TOPIC_ANALYSIS,
        retrievalOptions,
      });

      // If result is already an array of topics, return it
      if (Array.isArray(result)) {
        return this.validateTopics(result);
      }

      // If result is a string, try to parse it as JSON
      if (typeof result === 'string') {
        try {
          return this.validateTopics(JSON.parse(result));
        } catch (error) {
          // Not JSON, use a basic fallback
          return [
            {
              name: 'Unstructured Result',
              description: result.substring(0, 250),
              relevance: 5,
            },
          ];
        }
      }

      // Handle unexpected response format
      return [
        {
          name: 'Unknown Topic Format',
          description: 'The agent returned an unexpected format',
          relevance: 1,
        },
      ];
    } catch (error) {
      this.logger.error(`Error extracting topics with RAG: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate and normalize topics
   */
  private validateTopics(topics: any[]): Topic[] {
    if (!Array.isArray(topics)) {
      return [];
    }

    return topics
      .filter(
        (topic) =>
          topic &&
          topic.name &&
          typeof topic.name === 'string' &&
          topic.name.trim() !== '',
      )
      .map((topic) => {
        // Ensure all required properties are present
        return {
          name: topic.name,
          description: topic.description || '',
          relevance: typeof topic.relevance === 'number' ? topic.relevance : 5,
          subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [],
          keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
          participants: Array.isArray(topic.participants)
            ? topic.participants
            : [],
          duration:
            typeof topic.duration === 'number' ? topic.duration : undefined,
        };
      });
  }

  /**
   * Format context specifically for topic extraction
   */
  protected formatRetrievedContext(context: any): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return '';
    }

    // Enhanced formatting specific to topic extraction
    return `
TOPICS FROM RELATED MEETINGS:
---------------------------
${context.documents
  .map((doc: any, index: number) => {
    const metadata = doc.metadata || {};
    const meetingId = metadata.meetingId || metadata.meeting_id || 'unknown';
    const date = metadata.date || 'unknown';
    const relevance = doc.score
      ? ` (Relevance: ${(doc.score * 100).toFixed(1)}%)`
      : '';

    return `Meeting ${meetingId} (${date})${relevance}:\n${doc.content}`;
  })
  .join('\n\n')}
---------------------------

Use the above topics from previous related meetings as context.
If a topic continues from a previous meeting, note that continuity.
However, your primary task is to extract topics from the CURRENT transcript.
`;
  }
}
