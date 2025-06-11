import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { LlmService } from "../llm/llm.service";
import { MeetingAnalysisAgentFactory } from "../meeting-analysis/meeting-analysis-agent.factory";

// Use the existing state interface pattern
export interface MeetingAnalysisState {
  meetingId: string;
  transcript: string;
  topics?: Array<{
    name: string;
    relevance: number;
    keyPoints: string[];
  }>;
  actionItems?: Array<{
    description: string;
    assignee?: string;
    dueDate?: string;
    priority: "high" | "medium" | "low";
  }>;
  summary?: {
    brief: string;
    keyDecisions: string[];
    nextSteps: string[];
  };
  sentiment?: {
    overall: "positive" | "neutral" | "negative";
    confidence: number;
    details: string[];
  };
  stage?: string;
  error?: string;
  metadata?: Record<string, any>;
  results?: Record<string, any>;
  // Additional fields for workflow integration
  sessionId?: string;
  userId?: string;
}

export class MeetingAnalysisNodes {
  constructor(
    private readonly llmService: LlmService,
    private readonly meetingAnalysisAgentFactory: MeetingAnalysisAgentFactory,
  ) {}

  // Initialize the meeting analysis workflow
  initializeMeetingAnalysis = async (
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> => {
    return {
      ...state,
      stage: "initialized",
      metadata: {
        ...state.metadata,
        startTime: new Date().toISOString(),
        transcriptLength: state.transcript.length,
      },
    };
  };

  // Topic extraction node - now using specialized TopicExtractionAgent
  extractTopics = async (
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> => {
    try {
      const agent = this.meetingAnalysisAgentFactory.getTopicExtractionAgent();

      // Use the agent's extractTopics method which has sophisticated logic
      const topics = await agent.extractTopics(state.transcript);

      return {
        ...state,
        topics: topics.map(topic => ({
          name: topic.name,
          relevance: topic.relevance || 0.5,
          keyPoints: topic.subtopics || []
        })),
        stage: "topics_extracted",
        results: {
          ...state.results,
          topicsCount: topics.length,
        },
      };
    } catch (error) {
      return {
        ...state,
        error: `Topic extraction failed: ${error.message}`,
        stage: "topics_extraction_failed",
      };
    }
  };

  // Action items extraction node - now using specialized ActionItemAgent
  extractActionItems = async (
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> => {
    try {
      const agent = this.meetingAnalysisAgentFactory.getActionItemAgent();

      // Use the agent's extractActionItems method which has sophisticated logic
      const actionItems = await agent.extractActionItems(state.transcript);

      return {
        ...state,
        actionItems: actionItems.map(item => ({
          description: item.description,
          assignee: item.assignee,
          dueDate: item.deadline,
          priority: item.priority || "medium"
        })),
        stage: "action_items_extracted",
        results: {
          ...state.results,
          actionItemsCount: actionItems.length,
        },
      };
    } catch (error) {
      return {
        ...state,
        error: `Action item extraction failed: ${error.message}`,
        stage: "action_items_extraction_failed",
      };
    }
  };

  // Summary generation node - now using specialized SummaryAgent
  generateSummary = async (
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> => {
    try {
      const agent = this.meetingAnalysisAgentFactory.getSummaryAgent();

      // Use the agent's generateSummary method which has sophisticated logic
      const summary = await agent.generateSummary(
        state.transcript,
        state.topics,
        state.actionItems,
        state.sentiment
      );

      return {
        ...state,
        summary: {
          brief: summary.summary,
          keyDecisions: summary.decisions?.map(d => d.content) || [],
          nextSteps: summary.next_steps || []
        },
        stage: "summary_generated",
        results: {
          ...state.results,
          summaryGenerated: true,
        },
      };
    } catch (error) {
      return {
        ...state,
        error: `Summary generation failed: ${error.message}`,
        stage: "summary_generation_failed",
      };
    }
  };

  // Sentiment analysis node - now using specialized SentimentAnalysisAgent
  analyzeSentiment = async (
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> => {
    try {
      const agent = this.meetingAnalysisAgentFactory.getSentimentAnalysisAgent();

      // Use the agent's analyzeSentiment method which has sophisticated logic
      const sentimentAnalysis = await agent.analyzeSentiment(state.transcript);

      return {
        ...state,
        sentiment: {
          overall: sentimentAnalysis.overall === "mixed" ? "neutral" : sentimentAnalysis.overall,
          confidence: sentimentAnalysis.score,
          details: sentimentAnalysis.keyEmotions || []
        },
        stage: "sentiment_analyzed",
        results: {
          ...state.results,
          sentimentAnalyzed: true,
        },
      };
    } catch (error) {
      return {
        ...state,
        error: `Sentiment analysis failed: ${error.message}`,
        stage: "sentiment_analysis_failed",
      };
    }
  };

  // Finalization node
  finalizeMeetingAnalysis = async (
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> => {
    return {
      ...state,
      stage: "completed",
      metadata: {
        ...state.metadata,
        endTime: new Date().toISOString(),
        processingTime: state.metadata?.startTime
          ? Date.now() - Date.parse(state.metadata.startTime)
          : 0,
      },
      results: {
        ...state.results,
        completed: true,
        hasTopics: (state.topics?.length || 0) > 0,
        hasActionItems: (state.actionItems?.length || 0) > 0,
        hasSummary: !!state.summary,
        hasSentiment: !!state.sentiment,
      },
    };
  };
}
