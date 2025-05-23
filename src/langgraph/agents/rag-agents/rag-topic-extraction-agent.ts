import { Injectable, Inject, Logger } from '@nestjs/common';
import { IRagService } from '../../../rag/interfaces/rag-service.interface';
import { RAG_SERVICE } from '../../../rag/constants/injection-tokens';
import { LLM_SERVICE } from '../../llm/constants/injection-tokens';
import { STATE_SERVICE } from '../../state/constants/injection-tokens';
import { LlmService } from '../../llm/llm.service';
import { StateService } from '../../state/state.service';
import { 
  RagEnhancedAgent, 
  RagAgentConfig, 
  AgentExpertise 
} from '../../../rag/agents/rag-enhanced-agent';
import { Topic } from './interfaces/state.interface';
import { MEETING_CHUNK_ANALYSIS_PROMPT } from '../../../instruction-promtps';
import { RagService } from 'src/rag';

// Define the token here to avoid circular import
export const RAG_TOPIC_EXTRACTION_CONFIG = 'RAG_TOPIC_EXTRACTION_CONFIG';

export interface RagTopicExtractionConfig extends RagAgentConfig {
  expertise?: AgentExpertise[];
  specializationPrompt?: string;
  specializedQueries?: Record<string, string>;
}

/**
 * RAG-Enhanced Topic Extraction Agent
 *
 * Specialized agent for extracting topics from meeting transcripts
 * with enhanced context from previous meetings
 */
@Injectable()
export class RagTopicExtractionAgent extends RagEnhancedAgent {
  protected readonly logger = new Logger(RagTopicExtractionAgent.name);

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: RagService,
    @Inject(RAG_TOPIC_EXTRACTION_CONFIG) config: RagTopicExtractionConfig,
  ) {
    // Keep a copy of the configuration for later use
    const ragConfig = config.ragOptions || {
      includeRetrievedContext: true,
      retrievalOptions: {
        indexName: 'meeting-analysis',
        namespace: 'topics',
        topK: 5,
        minScore: 0.7,
      },
    };

    super(llmService, stateService, ragService, {
      name: config.name || 'Topic Extraction Agent',
      systemPrompt: config.systemPrompt || MEETING_CHUNK_ANALYSIS_PROMPT,
      llmOptions: config.llmOptions,
      ragOptions: ragConfig,
    });
    
    // Override expertisePrompts with topic-specific prompts
    (this as any).expertisePrompts = {
      [AgentExpertise.TOPIC_ANALYSIS]: MEETING_CHUNK_ANALYSIS_PROMPT,
    };
  }

  /**
   * Extract query from state to use for RAG retrieval
   */
  protected extractQueryFromState(state: any): string {
    // Extract a query focused on topic extraction
    let query = '';

    if (typeof state === 'object') {
      if (state.transcript) {
        // Use a shorter version of the transcript focused on topics
        const transcript = typeof state.transcript === 'string'
          ? state.transcript.substring(0, 500)
          : JSON.stringify(state.transcript).substring(0, 500);

        query = `Extract topics from the following meeting transcript: ${transcript}`;

        // If we have existing topics, add them to focus the query
        if (state.topics && Array.isArray(state.topics) && state.topics.length > 0) {
          const topicStr = state.topics.map((t: any) => t.name || t).join(', ');
          query = `Previous topics: ${topicStr}\n\n${query}`;
        }
      } else {
        query = JSON.stringify(state);
      }
    } else {
      query = String(state);
    }

    return query;
  }

  /**
   * Extract topics from a meeting transcript
   */
  async extractTopics(
    transcript: string,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      retrievalOptions?: {
        includeHistoricalTopics?: boolean;
        topK?: number;
        minScore?: number;
      };
    },
  ): Promise<Topic[]> {
    try {
      // Create a base state for RAG enhancement
      const baseState = { 
        transcript,
        meetingId: options?.meetingId || `meeting-${Date.now()}`,
        participantNames: options?.participantNames || []
      };

      // Prepare retrieval options
      const retrievalOptions = {
        indexName: 'meeting-analysis',
        namespace: 'topics',
        topK: options?.retrievalOptions?.topK || 5,
        minScore: options?.retrievalOptions?.minScore || 0.7,
      };

      // Extract a more specific query for topic retrieval
      const query = `Extract topics from the following meeting transcript: ${transcript.substring(0, 300)}...`;

      // Enhance state with RAG context before proceeding
      const enhancedState = await this.ragService.enhanceStateWithContext(
        baseState,
        query,
        retrievalOptions,
      );

      // Add format instructions to the enhanced state using type assertion
      const stateWithFormat = {
        ...enhancedState,
        formatInstructions: `
YOUR RESPONSE FORMAT:
Your output MUST be a valid JSON array of topic objects with this exact structure:
[
  {
    "name": "Topic Name",
    "description": "Detailed description of topic",
    "relevance": 5, // number from 1-5
    "subtopics": ["Subtopic 1", "Subtopic 2"],
    "keywords": ["keyword1", "keyword2"] 
  },
  ...
]
If you cannot extract proper topics, return an array with at least one valid topic object.
`
      };

      // Generate prompt using the base class method
      const prompt = this.generatePromptFromExpertise(AgentExpertise.TOPIC_ANALYSIS, stateWithFormat);

      // Execute LLM request
      const result = await this.executeLlmRequest(prompt, stateWithFormat);

      // Process the result to ensure we get properly structured topics
      return this.processTopicsResult(result);
    } catch (error) {
      this.logger.error(`Error extracting topics with RAG: ${error.message}`, error.stack);
      // Return a fallback topic rather than throwing an error
      return [
        {
          name: 'Error Processing Topics',
          description: 'There was an error processing the meeting topics. Please try again.',
          relevance: 1,
        },
      ];
    }
  }

  /**
   * Execute LLM request for topic extraction
   */
  private async executeLlmRequest(prompt: string, state: any): Promise<any> {
    try {
      this.logger.log('Executing LLM request for topic extraction');
      
      // Set up LLM options
      const llmOptions = {
        model: 'gpt-4o',
        temperature: 0.7,
      };
      
      // Get the LLM chat model
      const llm = this.llmService.getChatModel(llmOptions);
      
      // Add retrieved context if available
      let promptWithContext = prompt;
      if (state.retrievedContext) {
        const formattedContext = this.formatRetrievedContext(state.retrievedContext);
        if (formattedContext) {
          promptWithContext = `${formattedContext}\n\n${prompt}`;
        }
      }

      // Add format instructions
      if (state.formatInstructions) {
        promptWithContext += `\n\n${state.formatInstructions}`;
      }
      
      // Invoke the LLM
      const messages = [
        { role: 'system', content: MEETING_CHUNK_ANALYSIS_PROMPT },
        { role: 'user', content: promptWithContext }
      ];
      
      const response = await llm.invoke(messages);
      
      // Parse and return the result
      const content = response.content.toString();
      this.logger.log('Topic extraction LLM request completed');
      
      return content;
    } catch (error) {
      this.logger.error(`Error executing LLM request for topics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process the result from the LLM to ensure proper topic structure
   */
  private processTopicsResult(result: any): Topic[] {
    this.logger.log('Processing topics result from LLM');
    this.logger.log(`Result type: ${typeof result}, preview: ${JSON.stringify(result).substring(0, 200)}...`);
    
    try {
      // If result is already an array of topics, validate it
      if (Array.isArray(result)) {
        this.logger.log('Result is already an array, validating topics');
        const validatedTopics = this.validateTopics(result);
        if (validatedTopics.length > 0) {
          this.logger.log(`Successfully validated ${validatedTopics.length} topics from array`);
          return validatedTopics;
        }
      }

      // If result is an object with a topics property
      if (result && result.topics && Array.isArray(result.topics)) {
        this.logger.log('Found topics array in result object');
        const validatedTopics = this.validateTopics(result.topics);
        if (validatedTopics.length > 0) {
          this.logger.log(`Successfully validated ${validatedTopics.length} topics from object`);
          return validatedTopics;
        }
      }

      // If result is a string, try to extract and parse JSON
      if (typeof result === 'string') {
        this.logger.log('Result is string, attempting to parse JSON');
        
        // Try to find JSON array in the string first
        const arrayMatch = result.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          try {
            const parsedArray = JSON.parse(arrayMatch[0]);
            this.logger.log('Successfully parsed JSON array from string');
            const validatedTopics = this.validateTopics(parsedArray);
            if (validatedTopics.length > 0) {
              return validatedTopics;
            }
          } catch (e) {
            this.logger.warn(`Failed to parse array JSON: ${e.message}`);
          }
        }

        // Try to find JSON object in the string
        const objectMatch = result.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          try {
            const parsedObj = JSON.parse(objectMatch[0]);
            this.logger.log('Successfully parsed JSON object from string');
            
            // If the object has a topics array, use that
            if (parsedObj.topics && Array.isArray(parsedObj.topics)) {
              const validatedTopics = this.validateTopics(parsedObj.topics);
              if (validatedTopics.length > 0) {
                return validatedTopics;
              }
            }
            // Otherwise wrap the object itself as a topic
            const validatedTopics = this.validateTopics([parsedObj]);
            if (validatedTopics.length > 0) {
              return validatedTopics;
            }
          } catch (e) {
            this.logger.warn(`Failed to parse object JSON: ${e.message}`);
          }
        }

        // If JSON parsing fails, try to extract topics from text
        this.logger.log('JSON parsing failed, extracting topics from text');
        const extractedTopics = this.extractTopicsFromText(result);
        if (extractedTopics.length > 0) {
          return extractedTopics;
        }
      }

      // If result is an object but not an array, try to convert it to a topic
      if (typeof result === 'object' && result !== null) {
        this.logger.log('Converting object result to topic');
        const validatedTopics = this.validateTopics([result]);
        if (validatedTopics.length > 0) {
          return validatedTopics;
        }
      }

      // Final fallback
      this.logger.warn('All parsing attempts failed, creating fallback topic');
      return [
        {
          name: 'Meeting Discussion',
          description: 'Topics were discussed but could not be parsed from the response',
          relevance: 3,
        },
      ];
    } catch (error) {
      this.logger.error(`Error processing topics result: ${error.message}`);
      return [
        {
          name: 'Processing Error',
          description: 'Error occurred while processing topics',
          relevance: 1,
        },
      ];
    }
  }

  /**
   * Extract topics from unstructured text
   */
  private extractTopicsFromText(text: string): Topic[] {
    this.logger.log('Extracting topics from unstructured text');
    
    const topics: Topic[] = [];
    
    // Common patterns for topic identification in text
    const topicPatterns = [
      /(?:topic|subject|discussion about|talking about|regarding|discussed):\s*([^\n\.]+)/gi,
      /(?:^|\n)\s*[-•*]\s*([^\n]+)/g, // Bullet points
      /(?:^|\n)\s*\d+\.\s*([^\n]+)/g, // Numbered lists
      /(?:we|they|team|group)\s+(?:talked about|discussed|covered|addressed)\s+([^\n\.]+)/gi
    ];
    
    for (const pattern of topicPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const topicText = match[1].trim();
        if (topicText.length > 3 && topicText.length < 100) { // Reasonable topic length
          topics.push({
            name: topicText.length > 50 ? topicText.substring(0, 47) + '...' : topicText,
            description: `Extracted from discussion: ${topicText}`,
            relevance: 4,
          });
        }
      }
    }
    
    // If no patterns matched, try to create a general topic
    if (topics.length === 0) {
      const sentences = text.split(/[\.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length > 0) {
        const firstSentence = sentences[0].trim();
        topics.push({
          name: firstSentence.length > 50 ? firstSentence.substring(0, 47) + '...' : firstSentence,
          description: 'General discussion topic extracted from content',
          relevance: 3,
        });
      }
    }
    
    this.logger.log(`Extracted ${topics.length} topics from text`);
    return topics.slice(0, 5); // Limit to 5 topics
  }

  /**
   * Validate and normalize topics
   */
  private validateTopics(topics: any[]): Topic[] {
    if (!Array.isArray(topics)) {
      return [];
    }

    return topics
      .filter(
        (topic) =>
          topic &&
          (topic.name || topic.title) &&
          typeof (topic.name || topic.title) === 'string' &&
          (topic.name || topic.title).trim() !== '',
      )
      .map((topic) => {
        // Ensure all required properties are present
        return {
          name: topic.name || topic.title || 'Unnamed Topic',
          description: topic.description || topic.content || '',
          relevance: typeof topic.relevance === 'number' ? topic.relevance : 5,
          subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [],
          keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
          participants: Array.isArray(topic.participants)
            ? topic.participants
            : [],
          duration:
            typeof topic.duration === 'number' ? topic.duration : undefined,
        };
      });
  }

  /**
   * Format context specifically for topic extraction
   */
  protected formatRetrievedContext(context: any): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return `
No relevant context found from previous meetings.
Please focus on extracting topics directly from the current transcript.
Remember to return your response as a properly formatted JSON array of topic objects.
`;
    }

    // Enhanced formatting specific to topic extraction
    return `
TOPICS FROM RELATED MEETINGS:
---------------------------
${context.documents
  .map((doc: any, index: number) => {
    const metadata = doc.metadata || {};
    const meetingId = metadata.meetingId || metadata.meeting_id || 'unknown';
    const date = metadata.date || 'unknown';
    const relevance = doc.score
      ? ` (Relevance: ${(doc.score * 100).toFixed(1)}%)`
      : '';

    return `Meeting ${meetingId} (${date})${relevance}:\n${doc.content}`;
  })
  .join('\n\n')}
---------------------------

Use the above topics from previous related meetings as context.
If a topic continues from a previous meeting, note that continuity.
However, your primary task is to extract topics from the CURRENT transcript.

IMPORTANT: Return your response as a valid JSON array of topic objects with the exact structure shown.
`;
  }
} 