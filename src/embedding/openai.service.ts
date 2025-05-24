import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

/**
 * Service for interacting with OpenAI APIs
 */
@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY not set in environment variables');
    }
    
    this.openai = new OpenAI({
      apiKey,
    });
  }

  /**
   * Generate text using OpenAI's chat completion API
   * @param options The options for text generation
   * @returns The generated text
   */
  async generateText(options: {
    messages: Array<ChatCompletionMessageParam>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'text' | 'json_object' };
  }): Promise<string> {
    try {
      const { messages, model = 'gpt-4o', temperature = 0.7, max_tokens = 1000, response_format } = options;
      
      this.logger.debug(`Generating text with model ${model}`);
      
      const completion = await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens,
        response_format,
      });
      
      const content = completion.choices[0]?.message?.content || '';
      return content;
    } catch (error) {
      this.logger.error(`Error generating text: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate embeddings for a text
   * @param text The text to generate embeddings for
   * @returns The generated embeddings
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    try {
      this.logger.debug('Generating embeddings');
      
      const response = await this.openai.embeddings.create({
        model: 'llama-text-embed-v2',
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Error generating embeddings: ${error.message}`, error.stack);
      throw error;
    }
  }
} 