import { Module, forwardRef } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module';
import { StateModule } from '../../state/state.module';
import { RagModule } from '../../../rag/rag.module';
import { 
  RagMeetingAnalysisAgent, 
  RAG_MEETING_ANALYSIS_CONFIG,
  RagMeetingAnalysisConfig
} from './rag-meeting-agent';
import { 
  RagTopicExtractionAgent, 
  RAG_TOPIC_EXTRACTION_CONFIG,
  RagTopicExtractionConfig
} from './rag-topic-extraction-agent';
import { AgentExpertise } from '../../../rag/agents/rag-enhanced-agent';
import { 
  MEETING_CHUNK_ANALYSIS_PROMPT, 
  EXTRACT_ACTION_ITEMS_PROMPT, 
  SENTIMENT_ANALYSIS_PROMPT,
  FINAL_MEETING_SUMMARY_PROMPT
} from '../../../instruction-promtps';

/**
 * Submodule that provides RAG-enhanced agents for various analysis tasks
 * These agents can be reused across different modules like meeting analysis and email
 */
@Module({
  imports: [
    LlmModule, 
    StateModule, 
    forwardRef(() => RagModule)
  ],
  providers: [
    // Configuration factory provider for RagMeetingAnalysisAgent
    {
      provide: RAG_MEETING_ANALYSIS_CONFIG,
      useFactory: (): RagMeetingAnalysisConfig => ({
        name: 'Meeting Analysis Agent',
        systemPrompt: MEETING_CHUNK_ANALYSIS_PROMPT,
        expertise: [
          AgentExpertise.TOPIC_ANALYSIS,
          AgentExpertise.ACTION_ITEM_EXTRACTION,
          AgentExpertise.SENTIMENT_ANALYSIS,
          AgentExpertise.SUMMARY_GENERATION
        ],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: 'meeting-analysis',
            namespace: 'transcripts',
            topK: 5,
            minScore: 0.7,
          },
        },
        specializedQueries: {
          [AgentExpertise.ACTION_ITEM_EXTRACTION]: 'Extract all action items from this meeting transcript with assigned owners and due dates if mentioned.',
          [AgentExpertise.SENTIMENT_ANALYSIS]: 'Analyze the sentiment and emotional tone of this meeting, providing an overall score and key sentiment indicators.',
          [AgentExpertise.SUMMARY_GENERATION]: 'Generate a comprehensive meeting summary including key points, decisions made, and next steps.'
        }
      }),
    },
    // Configuration factory provider for RagTopicExtractionAgent
    {
      provide: RAG_TOPIC_EXTRACTION_CONFIG,
      useFactory: (): RagTopicExtractionConfig => ({
        name: 'Topic Extraction Agent',
        systemPrompt: MEETING_CHUNK_ANALYSIS_PROMPT,
        expertise: [AgentExpertise.TOPIC_ANALYSIS],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: 'meeting-analysis',
            namespace: 'topics',
            topK: 5,
            minScore: 0.7,
          },
        },
        specializedQueries: {
          [AgentExpertise.TOPIC_ANALYSIS]:
            'Extract all topics discussed in this meeting transcript, including their relevance, subtopics, and participating speakers.',
        },
      }),
    },
    // Provide the agents
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
  ],
  exports: [
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
  ],
})
export class RagAgentsModule {} 