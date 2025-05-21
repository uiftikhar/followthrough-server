import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent, AgentConfig } from '../base-agent';
import { LlmService } from '../../llm/llm.service';
import { AgentFactory } from '../agent.factory';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Topic } from '../topic-extraction.agent';
import { ActionItem } from '../action-item.agent';
import { SentimentAnalysis } from '../sentiment-analysis.agent';
import { ParticipationAnalysis } from '../participation.agent';
import { MeetingSummary } from '../summary.agent';
import {
  EnrichedContext,
  RetrievedContext,
} from '../context-integration.agent';
import { COORDINATION_PROMPT, MANAGEMENT_PROMPT } from '../../../instruction-promtps';

export interface SupervisorDecision {
  next_action: string;
  reason: string;
  additional_instructions?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface AnalysisState {
  transcript: string;
  topics?: Topic[];
  actionItems?: ActionItem[];
  sentiment?: SentimentAnalysis;
  participation?: ParticipationAnalysis;
  enrichedContext?: EnrichedContext;
  retrievedContext?: RetrievedContext[];
  summary?: MeetingSummary;
  completed_steps: string[];
  in_progress_steps: string[];
  remaining_steps: string[];
  errors?: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;
}

@Injectable()
export class SupervisorAgent extends BaseAgent {
  protected readonly logger = new Logger(SupervisorAgent.name);

  constructor(
    protected readonly llmService: LlmService,
    private readonly agentFactory: AgentFactory,
  ) {
    const config: AgentConfig = {
      name: 'SupervisorAgent',
      systemPrompt: COORDINATION_PROMPT,
      llmOptions: {
        temperature: 0.2,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  /**
   * Initialize a new analysis state
   */
  initializeState(transcript: string): AnalysisState {
    return {
      transcript,
      completed_steps: [],
      in_progress_steps: [],
      remaining_steps: [
        'topic_extraction',
        'action_item_extraction',
        'sentiment_analysis',
        'participation_analysis',
        'context_integration',
        'summary_generation',
      ],
    };
  }

  /**
   * Determine the next analysis step
   */
  async determineNextStep(state: AnalysisState): Promise<SupervisorDecision> {
    const model = this.getChatModel();

    const messages = [
      new SystemMessage(MANAGEMENT_PROMPT),
      new HumanMessage(`
      You are coordinating the analysis of a meeting transcript. Given the current state of the analysis, determine the next step to take.
      
      Current state:
      - Completed steps: ${state.completed_steps.join(', ') || 'None'}
      - In progress steps: ${state.in_progress_steps.join(', ') || 'None'}
      - Remaining steps: ${state.remaining_steps.join(', ') || 'None'}
      ${state.errors ? `- Errors: ${JSON.stringify(state.errors, null, 2)}` : ''}
      
      Available steps:
      - topic_extraction: Extract key topics from the transcript
      - action_item_extraction: Identify action items and assignments
      - sentiment_analysis: Analyze sentiment and emotional content
      - participation_analysis: Analyze participant engagement and dynamics
      - context_integration: Integrate relevant contextual information
      - summary_generation: Generate a comprehensive meeting summary
      
      Analysis state information:
      - Has transcript: ${Boolean(state.transcript)}
      - Has topics: ${Boolean(state.topics && state.topics.length > 0)}
      - Has action items: ${Boolean(state.actionItems && state.actionItems.length > 0)}
      - Has sentiment analysis: ${Boolean(state.sentiment)}
      - Has participation analysis: ${Boolean(state.participation)}
      - Has context integration: ${Boolean(state.enrichedContext)}
      - Has summary: ${Boolean(state.summary)}
      `),
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
      return JSON.parse(jsonStr) as SupervisorDecision;
    } catch (error) {
      this.logger.error(
        `Failed to parse supervisor decision from response: ${error.message}`,
      );

      // Default decision if parsing fails
      return {
        next_action:
          state.remaining_steps.length > 0
            ? state.remaining_steps[0]
            : 'complete',
        reason: 'Fallback decision due to parsing error',
        priority: 'medium',
      };
    }
  }

  /**
   * Execute a specific analysis step
   */
  async executeStep(
    step: string,
    state: AnalysisState,
  ): Promise<AnalysisState> {
    this.logger.debug(`Executing step: ${step}`);

    // Update state to mark step as in progress
    const updatedState = {
      ...state,
      in_progress_steps: [...state.in_progress_steps, step],
      remaining_steps: state.remaining_steps.filter((s) => s !== step),
    };

    try {
      // Execute the appropriate step
      switch (step) {
        case 'topic_extraction':
          const topicAgent = this.agentFactory.getTopicExtractionAgent();
          const topicResult = await topicAgent.extractTopics(state.transcript);
          return {
            ...updatedState,
            topics: topicResult,
            completed_steps: [...updatedState.completed_steps, step],
            in_progress_steps: updatedState.in_progress_steps.filter(
              (s) => s !== step,
            ),
          };

        case 'action_item_extraction':
          const actionItemAgent = this.agentFactory.getActionItemAgent();
          const actionItems = await actionItemAgent.extractActionItems(
            state.transcript,
          );
          return {
            ...updatedState,
            actionItems,
            completed_steps: [...updatedState.completed_steps, step],
            in_progress_steps: updatedState.in_progress_steps.filter(
              (s) => s !== step,
            ),
          };

        case 'sentiment_analysis':
          const sentimentAgent = this.agentFactory.getSentimentAnalysisAgent();
          const sentiment = await sentimentAgent.analyzeSentiment(
            state.transcript,
          );
          return {
            ...updatedState,
            sentiment,
            completed_steps: [...updatedState.completed_steps, step],
            in_progress_steps: updatedState.in_progress_steps.filter(
              (s) => s !== step,
            ),
          };

        case 'participation_analysis':
          const participationAgent = this.agentFactory.getParticipationAgent();
          const participation = await participationAgent.analyzeParticipation(
            state.transcript,
            state.topics,
          );
          return {
            ...updatedState,
            participation,
            completed_steps: [...updatedState.completed_steps, step],
            in_progress_steps: updatedState.in_progress_steps.filter(
              (s) => s !== step,
            ),
          };

        case 'context_integration':
          if (!state.retrievedContext) {
            // Skip if no retrieved context available
            return {
              ...updatedState,
              completed_steps: [...updatedState.completed_steps, step],
              in_progress_steps: updatedState.in_progress_steps.filter(
                (s) => s !== step,
              ),
              errors: [
                ...(updatedState.errors || []),
                {
                  step,
                  error: 'No retrieved context available for integration',
                  timestamp: new Date().toISOString(),
                },
              ],
            };
          }

          const contextAgent = this.agentFactory.getContextIntegrationAgent();
          const enrichedContext = await contextAgent.integrateContext(
            state.transcript,
            state.topics || [],
            state.retrievedContext,
          );
          return {
            ...updatedState,
            enrichedContext,
            completed_steps: [...updatedState.completed_steps, step],
            in_progress_steps: updatedState.in_progress_steps.filter(
              (s) => s !== step,
            ),
          };

        case 'summary_generation':
          const summaryAgent = this.agentFactory.getSummaryAgent();
          const summary = await summaryAgent.generateSummary(
            state.transcript,
            state.topics,
            state.actionItems,
            state.sentiment,
          );
          return {
            ...updatedState,
            summary,
            completed_steps: [...updatedState.completed_steps, step],
            in_progress_steps: updatedState.in_progress_steps.filter(
              (s) => s !== step,
            ),
          };

        default:
          this.logger.warn(`Unknown step: ${step}`);
          return {
            ...updatedState,
            in_progress_steps: updatedState.in_progress_steps.filter(
              (s) => s !== step,
            ),
            errors: [
              ...(updatedState.errors || []),
              {
                step,
                error: `Unknown analysis step: ${step}`,
                timestamp: new Date().toISOString(),
              },
            ],
          };
      }
    } catch (error) {
      this.logger.error(`Error executing step ${step}: ${error.message}`);
      return {
        ...updatedState,
        in_progress_steps: updatedState.in_progress_steps.filter(
          (s) => s !== step,
        ),
        errors: [
          ...(updatedState.errors || []),
          {
            step,
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }
  }

  /**
   * Run a complete analysis process on a transcript
   */
  async runAnalysis(
    transcript: string,
    retrievedContext?: RetrievedContext[],
  ): Promise<AnalysisState> {
    // Initialize analysis state
    let state = this.initializeState(transcript);

    // Add retrieved context if available
    if (retrievedContext) {
      state.retrievedContext = retrievedContext;
    }

    // Continue until all steps are completed or an error occurs
    while (state.remaining_steps.length > 0) {
      // Determine next step
      const decision = await this.determineNextStep(state);

      // Check if analysis is complete
      if (decision.next_action === 'complete') {
        break;
      }

      // Execute the next step
      state = await this.executeStep(decision.next_action, state);

      // If there are errors, log them
      if (state.errors && state.errors.length > 0) {
        this.logger.warn(
          `Errors encountered during analysis: ${JSON.stringify(state.errors)}`,
        );
      }
    }

    return state;
  }
}
