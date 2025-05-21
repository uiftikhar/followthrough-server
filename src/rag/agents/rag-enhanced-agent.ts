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
 * Base class for agents enhanced with RAG capabilities
 */
export abstract class RagEnhancedAgent extends BaseAgent {
  protected readonly logger: Logger;
  private readonly ragOptions: RagAgentOptions;

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
