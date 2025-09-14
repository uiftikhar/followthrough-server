import { Module } from "@nestjs/common";
import { SharedCoreModule } from "../../shared/shared-core.module";

// Meeting Analysis Specific Agents
import { TopicExtractionAgent } from "../agents/topic-extraction.agent";
import { ActionItemAgent } from "../agents/action-item.agent";
import { SentimentAnalysisAgent } from "../agents/sentiment-analysis.agent";
import { SummaryAgent } from "../agents/summary.agent";
import { ParticipationAgent } from "../agents/participation.agent";
import { ContextIntegrationAgent } from "../agents/context-integration.agent";

// RAG-Enhanced Meeting Agents
import {
  RAG_MEETING_ANALYSIS_CONFIG,
  RagMeetingAnalysisAgent,
  RagMeetingAnalysisConfig,
} from "../agents/rag-agents/rag-meeting-agent";
import {
  RAG_TOPIC_EXTRACTION_CONFIG,
  RagTopicExtractionAgent,
  RagTopicExtractionConfig,
} from "../agents/rag-agents/rag-topic-extraction-agent";
import {
  RAG_SENTIMENT_ANALYSIS_CONFIG,
  RagSentimentAnalysisAgent,
  RagSentimentAnalysisConfig,
} from "../agents/rag-agents/rag-sentiment-analysis-agent";
import {
  RAG_ACTION_ITEM_CONFIG,
  RagActionItemAgent,
  RagActionItemConfig,
} from "../agents/rag-agents/rag-action-item-agent";
import { TOPIC_EXTRACTION_SYSTEM_PROMPT } from "src/instruction-promtps/meeting-analysis/topic-extraction-prompt";
import { AgentExpertise } from "src/rag/agents/rag-enhanced-agent";
import { SENTIMENT_ANALYSIS_PROMPT } from "src/instruction-promtps/meeting-analysis/sentiment-analysis.prompt";
import { EXTRACT_ACTION_ITEMS_PROMPT } from "src/instruction-promtps";

// Meeting analysis agent factory
import { MeetingAnalysisAgentFactory } from "./meeting-analysis-agent.factory";

/**
 * MeetingAnalysisAgentsModule
 *
 * Contains all agents specifically used for meeting analysis workflows.
 * This module is self-contained and has no circular dependencies.
 */
@Module({
  imports: [
    SharedCoreModule, // For LLM services, RAG services, and base infrastructure
  ],
  providers: [
    // Core meeting analysis agents
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,

    // RAG-enhanced meeting agents
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
    RagSentimentAnalysisAgent,
    RagActionItemAgent,

    // Export meeting analysis agent factory for easy access
    MeetingAnalysisAgentFactory,
    {
      provide: RAG_MEETING_ANALYSIS_CONFIG,
      useFactory: (): RagMeetingAnalysisConfig => ({
        name: "Meeting Summary Agent",
        systemPrompt:
          "You are an AI assistant specialized in generating comprehensive meeting summaries through chunking and analysis.",
        chunkSize: 4000, // Size for chunking large transcripts
        chunkOverlap: 200, // Overlap between chunks
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: "meeting-analysis",
            namespace: "summaries", // Focus on summary-related context
            topK: 3,
            minScore: 0.7,
          },
        },
      }),
    },
    {
      provide: RAG_TOPIC_EXTRACTION_CONFIG,
      useFactory: (): RagTopicExtractionConfig => ({
        name: "Topic Extraction Agent",
        systemPrompt: TOPIC_EXTRACTION_SYSTEM_PROMPT,
        expertise: [AgentExpertise.TOPIC_ANALYSIS],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: "meeting-analysis",
            namespace: "topics",
            topK: 5,
            minScore: 0.7,
          },
        },
        specializedQueries: {
          [AgentExpertise.TOPIC_ANALYSIS]:
            "Extract all topics discussed in this meeting transcript, including their relevance, subtopics, and participating speakers.",
        },
      }),
    },
    {
      provide: RAG_SENTIMENT_ANALYSIS_CONFIG,
      useFactory: (): RagSentimentAnalysisConfig => ({
        name: "Sentiment Analysis Agent",
        systemPrompt: SENTIMENT_ANALYSIS_PROMPT,
        expertise: [AgentExpertise.SENTIMENT_ANALYSIS],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: "meeting-analysis",
            namespace: "sentiment-analysis",
            topK: 3,
            minScore: 0.7,
          },
        },
        specializedQueries: {
          [AgentExpertise.SENTIMENT_ANALYSIS]:
            "Analyze the sentiment of the meeting transcript, including emotional tone, speaker engagement, and sentiment shifts throughout the discussion.",
        },
      }),
    },
    {
      provide: RAG_ACTION_ITEM_CONFIG,
      useFactory: (): RagActionItemConfig => ({
        name: "Action Item Extraction Agent",
        systemPrompt: EXTRACT_ACTION_ITEMS_PROMPT,
        expertise: [AgentExpertise.ACTION_ITEM_EXTRACTION],
        ragOptions: {
          includeRetrievedContext: true,
          retrievalOptions: {
            indexName: "meeting-analysis",
            namespace: "action-items",
            topK: 5,
            minScore: 0.7,
          },
        },
        specializedQueries: {
          [AgentExpertise.ACTION_ITEM_EXTRACTION]:
            "Extract specific, actionable tasks with clear assignees from this meeting transcript. Focus on explicit commitments and assignments.",
        },
      }),
    },
  ],
  exports: [
    // Export all meeting analysis agents
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,
    RagMeetingAnalysisAgent,
    RagTopicExtractionAgent,
    RagSentimentAnalysisAgent,
    RagActionItemAgent,

    // Export the meeting analysis agent factory
    MeetingAnalysisAgentFactory,
  ],
})
export class MeetingAnalysisAgentsModule {}
