import { Injectable, Logger } from '@nestjs/common';
import { AgentFactory } from '../agents/agent.factory';
import { SupervisorAgent } from '../agents/supervisor/supervisor.agent';
import { StateService } from '../state/state.service';
import { Topic } from '../agents/topic-extraction.agent';
import { ActionItem } from '../agents/action-item.agent';
import { SentimentAnalysis } from '../agents/sentiment-analysis.agent';
import { MeetingSummary } from '../agents/summary.agent';
import { GraphService } from './graph.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for meeting analysis results
 */
export interface MeetingAnalysisResult {
  transcript: string;
  topics: Topic[];
  actionItems: ActionItem[];
  sentiment?: SentimentAnalysis | null;
  summary?: MeetingSummary | null;
  errors?: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;
}

/**
 * Interface for session information
 */
export interface SessionInfo {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

/**
 * Service for handling meeting analysis workflows
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private readonly sessions: Map<string, SessionInfo> = new Map();

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly supervisorAgent: SupervisorAgent,
    private readonly stateService: StateService,
    private readonly graphService: GraphService,
  ) {}

  /**
   * Run a meeting analysis using the StateGraph implementation
   */
  async analyzeMeeting(
    transcript: string,
  ): Promise<{ sessionId: string; result: MeetingAnalysisResult }> {
    this.logger.log('Starting meeting analysis workflow');

    // Generate unique session ID
    const sessionId = uuidv4();

    // Register session
    this.sessions.set(sessionId, {
      id: sessionId,
      startTime: new Date(),
      status: 'in_progress',
    });

    try {
      // Use the StateGraph-based implementation
      const result = await this.graphService.analyzeMeeting(transcript);

      // Save analysis results
      await this.saveAnalysisResults(sessionId, result);

      // Update session status
      this.sessions.set(sessionId, {
        id: sessionId,
        startTime: this.sessions.get(sessionId)!.startTime,
        endTime: new Date(),
        status:
          result.errors && result.errors.length > 0 ? 'failed' : 'completed',
      });

      this.logger.log(`Completed analysis for session ${sessionId}`);

      return { sessionId, result };
    } catch (error) {
      this.logger.error(`Analysis failed: ${error.message}`, error.stack);

      // Update session status
      this.sessions.set(sessionId, {
        id: sessionId,
        startTime: this.sessions.get(sessionId)!.startTime,
        endTime: new Date(),
        status: 'failed',
      });

      // Return error result
      const errorResult: MeetingAnalysisResult = {
        transcript,
        topics: [],
        actionItems: [],
        errors: [
          {
            step: 'workflow',
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      // Save error result
      await this.saveAnalysisResults(sessionId, errorResult);

      return { sessionId, result: errorResult };
    }
  }

  /**
   * Run analysis with supervisor (alternative approach)
   */
  async runSupervisedAnalysis(
    transcript: string,
  ): Promise<MeetingAnalysisResult> {
    this.logger.log('Starting supervised meeting analysis');

    // Use supervisor agent to run the analysis
    const analysisState = await this.supervisorAgent.runAnalysis(transcript);

    // Return relevant analysis results
    return {
      transcript,
      topics: analysisState.topics || [],
      actionItems: analysisState.actionItems || [],
      sentiment: analysisState.sentiment,
      summary: analysisState.summary,
      errors: analysisState.errors,
    };
  }

  /**
   * Run a custom analysis pipeline with specific agents
   * This method uses the AgentFactory to create a custom analysis flow
   */
  async runCustomAnalysis(
    transcript: string,
    options: {
      includeTopics?: boolean;
      includeActionItems?: boolean;
      includeSentiment?: boolean;
      includeSummary?: boolean;
    } = {},
  ): Promise<MeetingAnalysisResult> {
    this.logger.log('Starting custom analysis pipeline');

    const result: MeetingAnalysisResult = {
      transcript,
      topics: [],
      actionItems: [],
    };

    const errors: Array<{ step: string; error: string; timestamp: string }> =
      [];

    try {
      // Run topic extraction if requested
      if (options.includeTopics !== false) {
        const topicAgent = this.agentFactory.getTopicExtractionAgent();
        result.topics = await topicAgent.extractTopics(transcript);
      }

      // Run action item extraction if requested
      if (options.includeActionItems !== false) {
        const actionItemAgent = this.agentFactory.getActionItemAgent();
        result.actionItems =
          await actionItemAgent.extractActionItems(transcript);
      }

      // Run sentiment analysis if requested
      if (options.includeSentiment) {
        try {
          const sentimentAgent = this.agentFactory.getSentimentAnalysisAgent();
          result.sentiment = await sentimentAgent.analyzeSentiment(transcript);
        } catch (error) {
          errors.push({
            step: 'sentiment_analysis',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Run summary generation if requested
      if (options.includeSummary) {
        try {
          const summaryAgent = this.agentFactory.getSummaryAgent();
          result.summary = await summaryAgent.generateSummary(
            transcript,
            result.topics,
            result.actionItems,
            result.sentiment || undefined,
          );
        } catch (error) {
          errors.push({
            step: 'summary_generation',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Add any errors to the result
      if (errors.length > 0) {
        result.errors = errors;
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Custom analysis failed: ${error.message}`,
        error.stack,
      );
      return {
        transcript,
        topics: [],
        actionItems: [],
        errors: [
          ...errors,
          {
            step: 'custom_analysis',
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }
  }

  /**
   * Save analysis results
   */
  async saveAnalysisResults(
    sessionId: string,
    results: MeetingAnalysisResult,
  ): Promise<void> {
    this.logger.log(`Saving analysis results for session ${sessionId}`);

    // Save state checkpoint
    await this.stateService.saveState(sessionId, results);
  }

  /**
   * Load analysis results
   */
  async loadAnalysisResults(
    sessionId: string,
  ): Promise<MeetingAnalysisResult | null> {
    this.logger.log(`Loading analysis results for session ${sessionId}`);

    // Load state checkpoint
    const state = await this.stateService.loadState(
      sessionId,
      'analysis_results',
    );

    return state as MeetingAnalysisResult;
  }

  /**
   * Get session information
   */
  getSessionInfo(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }
}
