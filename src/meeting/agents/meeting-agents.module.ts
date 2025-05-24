import { Module } from '@nestjs/common';
import { LanggraphCoreModule } from '../../langgraph/core/core.module';
import { AgentFrameworkModule } from '../../agent-framework/agent-framework.module';
import { RagCoreModule } from '../../rag-core/rag-core.module';
import { LlmModule } from '../../llm/llm.module';

// Agent Factory (moved from AgentFrameworkModule to resolve circular dependency)
import { AgentFactory } from '../../langgraph/agents/agent.factory';

// Meeting-specific regular agents
import { TopicExtractionAgent } from '../../langgraph/agents/topic-extraction.agent';
import { ActionItemAgent } from '../../langgraph/agents/action-item.agent';
import { SentimentAnalysisAgent } from '../../langgraph/agents/sentiment-analysis.agent';
import { SummaryAgent } from '../../langgraph/agents/summary.agent';
import { ParticipationAgent } from '../../langgraph/agents/participation.agent';

// Meeting-specific RAG agents
import {
  RagMeetingAnalysisAgent,
  RAG_MEETING_ANALYSIS_CONFIG,
  RagMeetingAnalysisConfig
} from '../../langgraph/agents/rag-agents/rag-meeting-agent';
import {
  RagTopicExtractionAgent,
  RAG_TOPIC_EXTRACTION_CONFIG,
  RagTopicExtractionConfig
} from '../../langgraph/agents/rag-agents/rag-topic-extraction-agent';
import {
  RagSentimentAnalysisAgent,
  RAG_SENTIMENT_ANALYSIS_CONFIG,
  RagSentimentAnalysisConfig
} from '../../langgraph/agents/rag-agents/rag-sentiment-analysis-agent';

// Agent configuration constants
import { AgentExpertise } from '../../rag/agents/rag-enhanced-agent';
import {
  TOPIC_EXTRACTION_SYSTEM_PROMPT,
  SENTIMENT_ANALYSIS_PROMPT
} from '../../instruction-promtps';

/**
 * MeetingAgentsModule - Domain Services Layer
 * Provides all meeting-specific agents (regular and RAG-enhanced) and AgentFactory
 * Part of Phase 3 migration from SharedCoreModule
 * AgentFactory moved here to resolve circular dependency
 * LlmModule imported directly since AgentFactory needs LlmService
 * LanggraphCoreModule imported for STATE_SERVICE needed by RAG agents
 */
@Module({
  imports: [
    LlmModule,              // Added: AgentFactory needs LlmService
    LanggraphCoreModule,    // Added: RAG agents need STATE_SERVICE
    AgentFrameworkModule,
    RagCoreModule,
  ],
  providers: [
    // Agent Factory (moved from AgentFrameworkModule)
    AgentFactory,
    
    // Meeting-specific regular agents
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    
    // Meeting-specific RAG agents
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
    RagSentimentAnalysisAgent,
    
    // RAG Agent Configurations
    {
      provide: RAG_MEETING_ANALYSIS_CONFIG,
      useFactory: (): RagMeetingAnalysisConfig => ({
        name: 'Meeting Summary Agent',
        systemPrompt: 'You are an AI assistant specialized in generating comprehensive meeting summaries.',
        chunkSize: 4000,
        chunkOverlap: 200,
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: 'meeting-analysis',
            namespace: 'summaries',
            topK: 3,
            minScore: 0.7,
          },
        },
      }),
    },
    {
      provide: RAG_TOPIC_EXTRACTION_CONFIG,
      useFactory: (): RagTopicExtractionConfig => ({
        name: 'Topic Extraction Agent',
        systemPrompt: TOPIC_EXTRACTION_SYSTEM_PROMPT,
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
      }),
    },
    {
      provide: RAG_SENTIMENT_ANALYSIS_CONFIG,
      useFactory: (): RagSentimentAnalysisConfig => ({
        name: 'Sentiment Analysis Agent',
        systemPrompt: SENTIMENT_ANALYSIS_PROMPT,
        expertise: [AgentExpertise.SENTIMENT_ANALYSIS],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: 'meeting-analysis',
            namespace: 'sentiment-analysis',
            topK: 3,
            minScore: 0.7,
          },
        },
      }),
    },
  ],
  exports: [
    // Agent Factory
    AgentFactory,
    
    // Regular agents
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    
    // RAG agents
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
    RagSentimentAnalysisAgent,
  ],
})
export class MeetingAgentsModule {} 