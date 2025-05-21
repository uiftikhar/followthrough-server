import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { LlmService, LLMOptions } from '../llm/llm.service';

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  llmOptions?: LLMOptions;
}

export class BaseAgent {
  protected readonly logger: Logger;
  protected readonly name: string;
  protected readonly systemPrompt: string;
  protected readonly llmOptions: LLMOptions;

  constructor(
    protected readonly llmService: LlmService,
    config: AgentConfig,
  ) {
    this.name = config.name;
    this.systemPrompt = config.systemPrompt;
    this.llmOptions = config.llmOptions || {};
    this.logger = new Logger(`Agent:${this.name}`);
  }

  /**
   * Get a chat model instance for this agent
   */
  protected getChatModel(): BaseChatModel {
    return this.llmService.getChatModel(this.llmOptions);
  }

  /**
   * Process a user message
   */
  async processMessage(message: string): Promise<string> {
    const model = this.getChatModel();
    const messages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt),
      new HumanMessage(message),
    ];

    this.logger.debug(`Processing message with ${this.name} agent`);
    const response = await model.invoke(messages);
    return response.content.toString();
  }

  /**
   * Process multiple messages
   */
  async processMessages(messages: BaseMessage[]): Promise<BaseMessage> {
    const model = this.getChatModel();
    const fullMessages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt),
      ...messages,
    ];

    this.logger.debug(
      `Processing ${messages.length} messages with ${this.name} agent`,
    );
    return await model.invoke(fullMessages);
  }

  /**
   * Process a state object (for use in LangGraph nodes)
   */
  async processState(state: any): Promise<any> {
    // Base implementation - should be overridden by subclasses
    this.logger.warn(
      `BaseAgent.processState called on ${this.name} - should be overridden`,
    );

    if (!state.messages || !state.messages.length) {
      return state;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    const response = await this.processMessage(lastMessage.content);

    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: response,
          name: this.name,
        },
      ],
    };
  }
}
