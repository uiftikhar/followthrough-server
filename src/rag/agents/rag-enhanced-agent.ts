import { Logger, Inject } from '@nestjs/common';
import { BaseAgent, AgentConfig } from '../../langgraph/agents/base-agent';
import { IRetrievalService, IRagService } from '../index';
import { RetrievalOptions, RetrievedDocument } from '../retrieval.service';
import { RetrievedContext } from '../rag.service';
import { RAG_SERVICE } from '../constants/injection-tokens';
import { LLM_SERVICE } from '../../langgraph/llm/constants/injection-tokens';
import { STATE_SERVICE } from '../../langgraph/state/constants/injection-tokens';
import { LlmService } from '../../langgraph/llm/llm.service';
import { StateService } from '../../langgraph/state/state.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface RagAgentOptions {
  retrievalOptions?: RetrievalOptions;
  includeRetrievedContext?: boolean;
  useAdaptiveRetrieval?: boolean;
}

export interface RagAgentConfig extends AgentConfig {
  ragOptions?: RagAgentOptions;
}

/**
 * Type for agent expertise
 */
export enum AgentExpertise {
  TOPIC_ANALYSIS = 'topic_analysis',
  ACTION_ITEM_EXTRACTION = 'action_item_extraction',
  PARTICIPANT_DYNAMICS = 'participant_dynamics',
  SUMMARY_GENERATION = 'summary_generation',
  DECISION_TRACKING = 'decision_tracking',
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  CONTEXT_INTEGRATION = 'context_integration',
  COORDINATION = 'coordination',
  MANAGEMENT = 'management',
}

/**
 * Base class for agents enhanced with RAG capabilities
 */
export abstract class RagEnhancedAgent extends BaseAgent {
  protected readonly logger: Logger;
  private readonly ragOptions: RagAgentOptions;
  protected readonly expertisePrompts: Partial<Record<AgentExpertise, string>> = {};

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: IRagService,
    config: RagAgentConfig,
  ) {
    super(llmService, {
      name: config.name,
      systemPrompt: config.systemPrompt,
      llmOptions: config.llmOptions,
    });

    // Set up RAG options with defaults
    const defaultOptions: RagAgentOptions = {
      includeRetrievedContext: true,
      useAdaptiveRetrieval: true,
    };

    this.ragOptions = { ...defaultOptions, ...config.ragOptions };
    this.logger = new Logger(`RagAgent:${config.name}`);
  }

  /**
   * Generate a prompt based on expertise
   * This can be overridden by derived classes to provide more specific prompts
   */
  protected generatePromptFromExpertise(
    expertise: AgentExpertise,
    state: any,
  ): string {
    // Get the base prompt for this expertise
    let prompt = this.expertisePrompts[expertise] || '';

    if (!prompt) {
      // Use a default prompt based on the expertise
      switch (expertise) {
        case AgentExpertise.TOPIC_ANALYSIS:
          prompt = 'Extract the main topics discussed in this content.';
          break;
        case AgentExpertise.ACTION_ITEM_EXTRACTION:
          prompt =
            'Extract all action items assigned, including who they were assigned to and any deadlines.';
          break;
        case AgentExpertise.SENTIMENT_ANALYSIS:
          prompt =
            'Analyze the sentiment, providing an overall score and key sentiment indicators.';
          break;
        case AgentExpertise.SUMMARY_GENERATION:
          prompt =
            'Generate a comprehensive summary, including key points, decisions, and next steps.';
          break;
        default:
          prompt = `Analyze this content focusing on ${expertise}.`;
      }
    }

    // Add the content - for transcript-based agents, this would be the transcript
    const contentKey = typeof state === 'object' && 'transcript' in state ? 'transcript' : 'content';
    const content = typeof state === 'object' && state[contentKey] ? state[contentKey] : JSON.stringify(state);
    
    prompt += `\n\n${contentKey.charAt(0).toUpperCase() + contentKey.slice(1)}:\n${content}`;

    return prompt;
  }

  /**
   * Extract query from state to use for RAG retrieval
   */
  protected abstract extractQueryFromState(state: any): string;

  /**
   * Process retrieved context into a format suitable for the agent
   */
  protected formatRetrievedContext(context: RetrievedContext): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return '';
    }

    const formattedDocs = context.documents
      .map((doc, index) => {
        return `Document ${index + 1}: ${doc.content}`;
      })
      .join('\n\n');

    return `
RELEVANT CONTEXT:
----------------
${formattedDocs}
----------------
`;
  }

  /**
   * Enhanced version of processState that includes RAG context
   */
  async processState(state: any): Promise<any> {
    try {
      // Only proceed with RAG if configured
      if (!this.ragOptions.includeRetrievedContext) {
        return super.processState(state);
      }

      // Check if we already have retrieved context in the state
      let retrievedContext = state.retrievedContext as
        | RetrievedContext
        | undefined;

      // If no context or we need fresh context, retrieve it
      if (!retrievedContext) {
        const query = this.extractQueryFromState(state);

        if (query) {
          // Retrieve context
          const documents = await this.ragService.getContext(
            query,
            this.ragOptions.retrievalOptions,
          );

          retrievedContext = {
            query,
            documents,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Enhance the agent's processing with context
      if (retrievedContext && retrievedContext.documents.length > 0) {
        // Format the context for the agent
        const formattedContext = this.formatRetrievedContext(retrievedContext);

        // Enhance the agent's reasoning with this context
        return this.processWithContext(state, formattedContext);
      }

      // Fall back to standard processing if no context
      return super.processState(state);
    } catch (error) {
      this.logger.error(`Error in RAG-enhanced agent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process input with retrieved context
   */
  protected async processWithContext(
    state: any,
    context: string,
  ): Promise<any> {
    // Base implementation - override in specialized agents if needed
    const enhancedPrompt = `${this.systemPrompt}\n\n${context}`;

    // If state has a transcript, use it as the human message content
    const content =
      typeof state === 'object' && state.transcript
        ? state.transcript
        : JSON.stringify(state);

    const messages = [
      new SystemMessage(enhancedPrompt),
      new HumanMessage(content),
    ];

    const response = await this.getChatModel().invoke(messages);

    // Try to parse response as JSON if the state was JSON
    try {
      if (typeof state === 'object') {
        const result = JSON.parse(response.content.toString());
        return result;
      }
      return response.content.toString();
    } catch (error) {
      return response.content.toString();
    }
  }
}
