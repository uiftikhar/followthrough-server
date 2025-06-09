import { Injectable } from '@nestjs/common';
import { TopicExtractionAgent } from '../agents/topic-extraction.agent';
import { ActionItemAgent } from '../agents/action-item.agent';
import { SentimentAnalysisAgent } from '../agents/sentiment-analysis.agent';
import { SummaryAgent } from '../agents/summary.agent';
import { ParticipationAgent } from '../agents/participation.agent';
import { ContextIntegrationAgent } from '../agents/context-integration.agent';
// RAG agents for meeting analysis
import { RagMeetingAnalysisAgent } from '../agents/rag-agents/rag-meeting-agent';
import { RagTopicExtractionAgent } from '../agents/rag-agents/rag-topic-extraction-agent';
import { RagSentimentAnalysisAgent } from '../agents/rag-agents/rag-sentiment-analysis-agent';

/**
 * MeetingAnalysisAgentFactory
 * 
 * Factory for meeting analysis workflow specific agents.
 * This provides access to all agents used in meeting analysis workflows
 * without circular dependencies.
 */
@Injectable()
export class MeetingAnalysisAgentFactory {
  constructor(
    // Core meeting analysis agents
    private readonly topicExtractionAgent: TopicExtractionAgent,
    private readonly actionItemAgent: ActionItemAgent,
    private readonly sentimentAnalysisAgent: SentimentAnalysisAgent,
    private readonly summaryAgent: SummaryAgent,
    private readonly participationAgent: ParticipationAgent,
    private readonly contextIntegrationAgent: ContextIntegrationAgent,
    
    // RAG-enhanced meeting analysis agents
    private readonly ragMeetingAnalysisAgent: RagMeetingAnalysisAgent,
    private readonly ragTopicExtractionAgent: RagTopicExtractionAgent,
    private readonly ragSentimentAnalysisAgent: RagSentimentAnalysisAgent,
  ) {}

  /**
   * Get the topic extraction agent
   */
  getTopicExtractionAgent(): TopicExtractionAgent {
    return this.topicExtractionAgent;
  }

  /**
   * Get the action item extraction agent
   */
  getActionItemAgent(): ActionItemAgent {
    return this.actionItemAgent;
  }

  /**
   * Get the sentiment analysis agent
   */
  getSentimentAnalysisAgent(): SentimentAnalysisAgent {
    return this.sentimentAnalysisAgent;
  }

  /**
   * Get the summary generation agent
   */
  getSummaryAgent(): SummaryAgent {
    return this.summaryAgent;
  }

  /**
   * Get the participation analysis agent
   */
  getParticipationAgent(): ParticipationAgent {
    return this.participationAgent;
  }

  /**
   * Get the context integration agent
   */
  getContextIntegrationAgent(): ContextIntegrationAgent {
    return this.contextIntegrationAgent;
  }

  /**
   * Get the RAG-enhanced meeting analysis agent
   */
  getRagMeetingAnalysisAgent(): RagMeetingAnalysisAgent {
    return this.ragMeetingAnalysisAgent;
  }

  /**
   * Get the RAG-enhanced topic extraction agent
   */
  getRagTopicExtractionAgent(): RagTopicExtractionAgent {
    return this.ragTopicExtractionAgent;
  }

  /**
   * Get the RAG-enhanced sentiment analysis agent
   */
  getRagSentimentAnalysisAgent(): RagSentimentAnalysisAgent {
    return this.ragSentimentAnalysisAgent;
  }

  /**
   * Get all basic meeting analysis agents
   */
  getAllBasicAgents() {
    return {
      topicExtraction: this.topicExtractionAgent,
      actionItem: this.actionItemAgent,
      sentimentAnalysis: this.sentimentAnalysisAgent,
      summary: this.summaryAgent,
      participation: this.participationAgent,
      contextIntegration: this.contextIntegrationAgent,
    };
  }

  /**
   * Get all RAG-enhanced agents
   */
  getAllRagAgents() {
    return {
      ragMeetingAnalysis: this.ragMeetingAnalysisAgent,
      ragTopicExtraction: this.ragTopicExtractionAgent,
      ragSentimentAnalysis: this.ragSentimentAnalysisAgent,
    };
  }

  /**
   * Get all meeting analysis agents
   */
  getAllAgents() {
    return {
      ...this.getAllBasicAgents(),
      ...this.getAllRagAgents(),
    };
  }
} 