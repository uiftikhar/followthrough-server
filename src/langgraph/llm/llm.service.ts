import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: LLMProvider;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly defaultModel: string;
  private readonly defaultProvider: LLMProvider;
  private readonly openaiApiKey: string;
  private readonly anthropicApiKey: string;
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor(private readonly configService: ConfigService) {
    this.defaultModel =
      this.configService.get<string>('llm.defaultModel') || 'gpt-4o';
    this.defaultProvider = (this.configService.get<string>('llm.provider') ||
      'openai') as LLMProvider;
    this.openaiApiKey =
      this.configService.get<string>('llm.apiKey') ||
      this.configService.get<string>('OPENAI_API_KEY') ||
      '';
    this.anthropicApiKey =
      this.configService.get<string>('llm.anthropicApiKey') ||
      this.configService.get<string>('ANTHROPIC_API_KEY') ||
      '';

    // Initialize the clients
    if (this.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: this.openaiApiKey,
      });
    }

    if (this.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: this.anthropicApiKey,
      });
    }
  }

  /**
   * Get a chat model instance based on the provided options
   */
  getChatModel(options: LLMOptions = {}): BaseChatModel {
    const provider = options.provider || this.defaultProvider;

    switch (provider) {
      case 'openai':
        return this.getOpenAIModel(options);
      case 'anthropic':
        // Use type assertion as BaseChatModel for compatibility
        // TODO Check if this type assertion is necessary or should strong type the getAnthropicModel properly
        return this.getAnthropicModel(options) as unknown as BaseChatModel;
      default:
        this.logger.warn(
          `Unknown provider: ${provider}, falling back to OpenAI`,
        );
        return this.getOpenAIModel(options);
    }
  }

  /**
   * Get an OpenAI chat model instance
   */
  private getOpenAIModel(options: LLMOptions): ChatOpenAI {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    return new ChatOpenAI({
      openAIApiKey: this.openaiApiKey,
      modelName: options.model || this.defaultModel,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens,
    });
  }

  /**
   * Get an Anthropic chat model instance
   */
  private getAnthropicModel(options: LLMOptions): ChatAnthropic {
    if (!this.anthropicApiKey) {
      throw new Error('Anthropic API key is not configured');
    }

    return new ChatAnthropic({
      anthropicApiKey: this.anthropicApiKey,
      modelName: options.model || 'claude-3-opus-20240229',
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens,
    });
  }

  /**
   * Generate embeddings using OpenAI
   */
  async generateOpenAIEmbedding(
    text: string,
    model: string = 'text-embedding-3-large',
  ): Promise<number[]> {
    if (!this.openai) {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key is not configured');
      }

      this.openai = new OpenAI({
        apiKey: this.openaiApiKey,
      });
    }

    try {
      const response = await this.openai.embeddings.create({
        model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Error generating OpenAI embedding: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embeddings using Anthropic
   * Note: As of early 2024, Anthropic's embedding API is in preview
   */
  async generateAnthropicEmbedding(text: string): Promise<number[]> {
    if (!this.anthropic) {
      if (!this.anthropicApiKey) {
        throw new Error('Anthropic API key is not configured');
      }

      this.anthropic = new Anthropic({
        apiKey: this.anthropicApiKey,
      });
    }

    try {
      // Note: The Anthropic API interface may have changed.
      // This implementation needs to be updated based on their latest SDK
      this.logger.warn(
        'Anthropic embedding API may have changed, this method needs updating',
      );

      // Fallback to OpenAI embedding
      return this.generateOpenAIEmbedding(text);
    } catch (error) {
      this.logger.error(
        `Error generating Anthropic embedding: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Generate embeddings using Llama
   * This is just a placeholder method
   */
  async generateLlamaEmbedding(text: string): Promise<number[]> {
    // Implementation depends on how you're accessing Llama models
    throw new Error('Llama embedding not implemented');
  }
}
