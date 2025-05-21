import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { BaseAgent, AgentConfig } from './base-agent';
import { TopicExtractionAgent } from './topic-extraction.agent';
import { ActionItemAgent } from './action-item.agent';
import { SentimentAnalysisAgent } from './sentiment-analysis.agent';
import { SummaryAgent } from './summary.agent';
import { ParticipationAgent } from './participation.agent';
import { ContextIntegrationAgent } from './context-integration.agent';

/**
 * Factory for creating different types of agents
 */
@Injectable()
export class AgentFactory {
  constructor(
    private readonly llmService: LlmService,
    private readonly topicExtractionAgent: TopicExtractionAgent,
    private readonly actionItemAgent: ActionItemAgent,
    private readonly sentimentAnalysisAgent: SentimentAnalysisAgent,
    private readonly summaryAgent: SummaryAgent,
    private readonly participationAgent: ParticipationAgent,
    private readonly contextIntegrationAgent: ContextIntegrationAgent,
  ) {}

  /**
   * Create a base agent instance
   */
  createBaseAgent(config: AgentConfig): BaseAgent {
    return new BaseAgent(this.llmService, config);
  }

  /**
   * Get the topic extraction agent
   */
  getTopicExtractionAgent(): TopicExtractionAgent {
    return this.topicExtractionAgent;
  }

  /**
   * Get the action item agent
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
   * Get the summary agent
   */
  getSummaryAgent(): SummaryAgent {
    return this.summaryAgent;
  }

  /**
   * Get the participation agent
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
   * Get all analysis agents
   */
  getAllAnalysisAgents(): BaseAgent[] {
    return [
      this.topicExtractionAgent,
      this.actionItemAgent,
      this.sentimentAnalysisAgent,
      this.summaryAgent,
      this.participationAgent,
      this.contextIntegrationAgent,
    ];
  }

  /**
   * Create a specialized agent for topic extraction
   */
  createTopicExtractionAgent(customConfig?: Partial<AgentConfig>): BaseAgent {
    const defaultConfig: AgentConfig = {
      name: 'TopicExtractor',
      systemPrompt:
        'You are a specialized agent for extracting key topics from meeting transcripts. Identify main themes, discussions, and subject areas covered in the transcript.',
      llmOptions: {
        temperature: 0.3,
        model: 'gpt-4o',
      },
    };

    const config = { ...defaultConfig, ...customConfig };
    return this.createBaseAgent(config);
  }

  /**
   * Create a specialized agent for action item extraction
   */
  createActionItemAgent(customConfig?: Partial<AgentConfig>): BaseAgent {
    const defaultConfig: AgentConfig = {
      name: 'ActionItemExtractor',
      systemPrompt:
        'You are a specialized agent for identifying action items from meeting transcripts. Extract tasks, responsibilities, deadlines, and assignees from the discussion.',
      llmOptions: {
        temperature: 0.2,
        model: 'gpt-4o',
      },
    };

    const config = { ...defaultConfig, ...customConfig };
    return this.createBaseAgent(config);
  }

  /**
   * Create a specialized agent for sentiment analysis
   */
  createSentimentAnalysisAgent(customConfig?: Partial<AgentConfig>): BaseAgent {
    const defaultConfig: AgentConfig = {
      name: 'SentimentAnalyzer',
      systemPrompt:
        'You are a specialized agent for analyzing sentiment in meeting transcripts. Identify emotions, tone, and overall sentiment of participants throughout the discussion.',
      llmOptions: {
        temperature: 0.3,
        model: 'gpt-4o',
      },
    };

    const config = { ...defaultConfig, ...customConfig };
    return this.createBaseAgent(config);
  }

  /**
   * Create a meeting summary agent
   */
  createSummaryAgent(customConfig?: Partial<AgentConfig>): BaseAgent {
    const defaultConfig: AgentConfig = {
      name: 'SummaryAgent',
      systemPrompt:
        'You are a specialized agent for creating concise summaries of meetings. Synthesize the key points, decisions, action items, and overall purpose of the meeting.',
      llmOptions: {
        temperature: 0.4,
        model: 'gpt-4o',
      },
    };

    const config = { ...defaultConfig, ...customConfig };
    return this.createBaseAgent(config);
  }

  /**
   * Create a coordinator/supervisor agent
   */
  createCoordinatorAgent(customConfig?: Partial<AgentConfig>): BaseAgent {
    const defaultConfig: AgentConfig = {
      name: 'Coordinator',
      systemPrompt:
        'You are a coordination agent responsible for orchestrating the analysis of meeting transcripts. You delegate tasks to specialized agents and synthesize their results.',
      llmOptions: {
        temperature: 0.4,
        model: 'gpt-4o',
      },
    };

    const config = { ...defaultConfig, ...customConfig };
    return this.createBaseAgent(config);
  }
}
