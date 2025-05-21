import { Module, Provider } from '@nestjs/common';
import {
  RagMeetingAnalysisAgent,
  RAG_MEETING_ANALYSIS_CONFIG,
} from './agents/enhanced/rag-meeting-agent';
import {
  RagTopicExtractionAgent,
  RAG_TOPIC_EXTRACTION_CONFIG,
} from './agents/enhanced/rag-topic-extraction-agent';
import { AgenticMeetingAnalysisService } from './agentic-meeting-analysis.service';
import { LlmModule } from '../llm/llm.module';
import { StateModule } from '../state/state.module';
import { RagModule } from '../../rag/rag.module';
import { AgentExpertise } from './interfaces/agent.interface';
import { 
  MEETING_CHUNK_ANALYSIS_PROMPT,
  EXTRACT_ACTION_ITEMS_PROMPT
} from '../../instruction-promtps';

/**
 * Module for enhanced agentic meeting analysis components
 * using RAG capabilities for better context-awareness
 */
@Module({
  imports: [LlmModule, StateModule, RagModule],
  providers: [
    // Configuration factory provider for RagMeetingAnalysisAgent
    {
      provide: RAG_MEETING_ANALYSIS_CONFIG,
      useFactory: () => ({
        name: 'Meeting Analysis Agent',
        systemPrompt: MEETING_CHUNK_ANALYSIS_PROMPT,
        expertise: [AgentExpertise.TOPIC_ANALYSIS],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: 'meeting-analysis',
            namespace: 'transcripts',
            topK: 5,
            minScore: 0.7,
          },
        },
      }),
    },
    // Configuration factory provider for RagTopicExtractionAgent
    {
      provide: RAG_TOPIC_EXTRACTION_CONFIG,
      useFactory: () => ({
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
            'What are the main topics discussed in this meeting transcript?',
        },
      }),
    },
    // Provide the agents and service
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
    AgenticMeetingAnalysisService,
  ],
  exports: [
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
    AgenticMeetingAnalysisService,
  ],
})
export class AgenticMeetingAnalysisModule {}
