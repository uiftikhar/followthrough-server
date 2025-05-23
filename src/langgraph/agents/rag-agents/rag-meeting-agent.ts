import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RagEnhancedAgent,
  RagAgentConfig,
  RagAgentOptions,
  AgentExpertise
} from '../../../rag/agents/rag-enhanced-agent';
import { IRagService } from '../../../rag/interfaces/rag-service.interface';
import { RetrievalOptions } from '../../../rag/retrieval.service';
import { RAG_SERVICE } from '../../../rag/constants/injection-tokens';
import { LLM_SERVICE } from '../../llm/constants/injection-tokens';
import { STATE_SERVICE } from '../../state/constants/injection-tokens';
import { LlmService } from '../../llm/llm.service';
import { StateService } from '../../state/state.service';
import {
  EXTRACT_ACTION_ITEMS_PROMPT,
  ANALYZE_PARTICIPATION_PROMPT,
  FINAL_MEETING_SUMMARY_PROMPT,
  MEETING_CHUNK_ANALYSIS_PROMPT,
  MEETING_EFFECTIVENESS_PROMPT,
  CONTEXT_INTEGRATION_PROMPT,
  COORDINATION_PROMPT,
  MANAGEMENT_PROMPT,
  SENTIMENT_ANALYSIS_PROMPT
} from '../../../instruction-promtps';
import { RagService } from 'src/rag';

// Define token locally to avoid circular dependency
export const RAG_MEETING_ANALYSIS_CONFIG = 'RAG_MEETING_ANALYSIS_CONFIG';

export interface RagMeetingAnalysisConfig extends RagAgentConfig {
  expertise?: AgentExpertise[];
  specializationPrompt?: string;
  specializedQueries?: Record<string, string>;
  /**
   * Whether to include transcripts in the state as is or process them for RAG
   */
  processTranscriptsForRag?: boolean;
}

/**
 * RAG-enhanced agent specialized for meeting analysis
 */
@Injectable()
export class RagMeetingAnalysisAgent extends RagEnhancedAgent {
  protected readonly expertise: AgentExpertise[];
  protected readonly specializationPrompt: string;
  protected readonly specializedQueries: Record<string, string>;
  protected readonly processTranscriptsForRag: boolean;
  private readonly ragConfiguration: RagAgentOptions;
  protected readonly logger = new Logger(RagMeetingAnalysisAgent.name);

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: RagService,
    @Inject(RAG_MEETING_ANALYSIS_CONFIG) config: RagMeetingAnalysisConfig,
  ) {
    // Keep a copy of the configuration for later use
    const ragConfig = config.ragOptions || {
      includeRetrievedContext: true,
      retrievalOptions: {
        indexName: 'meeting-analysis',
        namespace: 'transcripts',
        topK: 5,
        minScore: 0.7,
      },
    };

    super(llmService, stateService, ragService, {
      name: config.name || 'Meeting Analysis Agent',
      systemPrompt:
        config.systemPrompt ||
        'You are an AI assistant specialized in analyzing meeting transcripts.',
      llmOptions: config.llmOptions,
      ragOptions: ragConfig,
    });

    this.expertise = config.expertise || [AgentExpertise.TOPIC_ANALYSIS];
    this.specializationPrompt = config.specializationPrompt || '';
    this.processTranscriptsForRag = config.processTranscriptsForRag !== false;
    this.ragConfiguration = ragConfig;

    // Create a local expertisePrompts object to override the base class property
    // Need to cast to any to override the read-only property
    (this as any).expertisePrompts = {
      [AgentExpertise.TOPIC_ANALYSIS]: MEETING_CHUNK_ANALYSIS_PROMPT,
      [AgentExpertise.ACTION_ITEM_EXTRACTION]: EXTRACT_ACTION_ITEMS_PROMPT,
      [AgentExpertise.PARTICIPANT_DYNAMICS]: ANALYZE_PARTICIPATION_PROMPT,
      [AgentExpertise.SUMMARY_GENERATION]: FINAL_MEETING_SUMMARY_PROMPT,
      [AgentExpertise.DECISION_TRACKING]: MEETING_EFFECTIVENESS_PROMPT,
      [AgentExpertise.SENTIMENT_ANALYSIS]: SENTIMENT_ANALYSIS_PROMPT,
      [AgentExpertise.CONTEXT_INTEGRATION]: CONTEXT_INTEGRATION_PROMPT,
      [AgentExpertise.COORDINATION]: COORDINATION_PROMPT,
      [AgentExpertise.MANAGEMENT]: MANAGEMENT_PROMPT,
    };

    // Set up specialized query templates based on expertise
    this.specializedQueries = {
      [AgentExpertise.TOPIC_ANALYSIS]:
        'What are the main topics discussed in this meeting?',
      [AgentExpertise.ACTION_ITEM_EXTRACTION]:
        'What action items were assigned in this meeting?',
      [AgentExpertise.DECISION_TRACKING]:
        'What key decisions were made in this meeting?',
      [AgentExpertise.SUMMARY_GENERATION]:
        'Provide a comprehensive summary of this meeting',
      [AgentExpertise.SENTIMENT_ANALYSIS]:
        'What was the sentiment and emotional tone of this meeting?',
      [AgentExpertise.PARTICIPANT_DYNAMICS]:
        'How did participants interact during this meeting?',
      ...(config.specializedQueries || {}),
    };
  }

  /**
   * Extract a relevant query from the state based on expertise
   */
  protected extractQueryFromState(state: any): string {
    // If transcript is available, use it as the base query
    let query = '';

    if (typeof state === 'object') {
      if (state.transcript) {
        // Start with a shorter version of the transcript to avoid token limits
        const transcript =
          typeof state.transcript === 'string'
            ? state.transcript.substring(0, 500)
            : JSON.stringify(state.transcript).substring(0, 500);

        query = transcript;

        // If we have topics, add them to focus the query
        if (
          state.topics &&
          Array.isArray(state.topics) &&
          state.topics.length > 0
        ) {
          const topicStr = state.topics.map((t: any) => t.name || t).join(', ');
          query = `Topics: ${topicStr}\n\n${query}`;
        }
      } else {
        // No transcript, use the expertise to guide the query
        query = JSON.stringify(state);
      }
    } else {
      query = String(state);
    }

    // Enhance with specialized queries based on expertise
    const expertiseQuery = this.getSpecializedQuery();
    if (expertiseQuery) {
      query = `${expertiseQuery}\n\n${query}`;
    }

    return query;
  }

  /**
   * Get a specialized query based on agent expertise
   */
  protected getSpecializedQuery(): string {
    if (!this.expertise || this.expertise.length === 0) {
      return '';
    }

    // Use the first expertise for query specialization
    const primaryExpertise = this.expertise[0];
    return this.specializedQueries[primaryExpertise] || '';
  }

  /**
   * Override to enhance the system prompt with expertise-specific instructions
   */
  protected getSystemPrompt(): string {
    // Get the primary expertise
    const primaryExpertise = this.expertise[0];
    
    // Try to get a specialized prompt for this expertise
    let expertisePrompt = this.expertisePrompts[primaryExpertise];
    
    // If no specialized prompt is available, use a default
    if (!expertisePrompt) {
      // Get the system prompt from constructor config instead of super.systemPrompt
      let enhancedPrompt = 'You are an AI agent specialized in meeting analysis.';

      // Add specialization based on expertise
      if (this.expertise && this.expertise.length > 0) {
        enhancedPrompt += `\n\nYou specialize in: ${this.expertise.join(', ')}.`;
      }

      // Add custom specialization prompt if provided
      if (this.specializationPrompt) {
        enhancedPrompt += `\n\n${this.specializationPrompt}`;
      }

      return enhancedPrompt;
    }
    
    return expertisePrompt;
  }

  /**
   * Enhanced formatting for meeting-specific contexts
   */
  protected formatRetrievedContext(context: any): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return `
NO RELEVANT CONTEXT FOUND
No previous meeting data found that matches your query. 
Please focus on analyzing the current transcript content only.
Remember to structure your response according to the instructions.
`;
    }

    // Enhanced formatting specific to meeting analysis
    return `
RELEVANT MEETING CONTEXT:
------------------------
${context.documents
  .map((doc: any, index: number) => {
    const metadata = doc.metadata || {};
    const meetingId = metadata.meetingId || metadata.meeting_id || 'unknown';
    const date = metadata.date || 'unknown';
    const relevance = doc.score
      ? ` (Relevance: ${(doc.score * 100).toFixed(1)}%)`
      : '';

    return `[Meeting ${meetingId} - ${date}]${relevance}\n${doc.content}`;
  })
  .join('\n\n')}
------------------------
`;
  }

  /**
   * Execute an LLM request with the given prompt and state
   */
  protected async executeLlmRequest(prompt: string, state: any): Promise<any> {
    try {
      this.logger.log('Executing LLM request with prompt');
      
      // Get the system prompt
      const systemPrompt = this.getSystemPrompt();
      
      // Set up LLM options
      const llmOptions = {
        model: 'gpt-4o',
        temperature: 0.7,
        // If ragConfiguration.llmOptions exists, use it
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

      // Add format instructions if they exist in the state
      if (state.formatInstructions) {
        promptWithContext += `\n\n${state.formatInstructions}`;
      } else {
        // Otherwise add JSON response formatting instructions based on expertise
        const formattingInstructions = this.getFormattingInstructions(state.expertise);
        if (formattingInstructions) {
          promptWithContext = `${promptWithContext}\n\n${formattingInstructions}`;
        }
      }
      
      // Invoke the LLM
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptWithContext }
      ];
      
      const response = await llm.invoke(messages);
      
      // Parse and return the result
      const content = response.content.toString();
      this.logger.log('LLM request completed');
      
      return this.processLlmResponse(content, state.expertise);
    } catch (error) {
      this.logger.error(`Error executing LLM request: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process LLM response to extract structured data
   */
  private processLlmResponse(content: string, expertise: AgentExpertise): any {
    this.logger.log(`Processing LLM response for expertise: ${expertise}`);
    this.logger.log(`Response content preview: ${content.substring(0, 200)}...`);
    
    // Try to find and parse JSON in the response
    try {
      // First try to parse the entire content as JSON
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        const parsed = JSON.parse(content);
        this.logger.log(`Successfully parsed entire response as JSON for ${expertise}`);
        return parsed;
      }
      
      // Try to extract JSON from markdown code blocks
      const jsonCodeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonCodeBlockMatch) {
        try {
          const jsonContent = jsonCodeBlockMatch[1].trim();
          const parsed = JSON.parse(jsonContent);
          this.logger.log(`Successfully parsed JSON from code block for ${expertise}`);
          return parsed;
        } catch (e) {
          this.logger.warn(`Failed to parse JSON from code block: ${e.message}`);
        }
      }
      
      // Try to extract JSON objects or arrays from the content
      const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          const jsonContent = jsonMatch[1].trim();
          const parsed = JSON.parse(jsonContent);
          this.logger.log(`Successfully parsed JSON from content match for ${expertise}`);
          return parsed;
        } catch (e) {
          this.logger.warn(`Failed to parse JSON from content match: ${e.message}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse JSON response for ${expertise}: ${error.message}`);
    }
    
    // If we couldn't parse as JSON, format based on expertise
    this.logger.warn(`Converting unstructured response to structured format for ${expertise}`);
    return this.formatUnstructuredResponse(content, expertise);
  }
  
  /**
   * Format unstructured text response based on expertise
   */
  private formatUnstructuredResponse(content: string, expertise: AgentExpertise): any {
    this.logger.log(`Formatting unstructured response for expertise: ${expertise}`);
    
    // Create appropriate shaped output based on expertise
    switch (expertise) {
      case AgentExpertise.TOPIC_ANALYSIS:
        // Try to extract topics from text manually
        const topicPatterns = [
          /(?:topic|subject|discussion about|talking about|regarding):\s*([^\n]+)/gi,
          /(?:^|\n)\s*[-•*]\s*([^\n]+)/g,
          /(?:^|\n)\s*\d+\.\s*([^\n]+)/g
        ];
        
        const extractedTopics: string[] = [];
        for (const pattern of topicPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            extractedTopics.push(match[1].trim());
          }
        }
        
        if (extractedTopics.length > 0) {
          return extractedTopics.map(topic => ({
            name: topic.length > 50 ? topic.substring(0, 47) + '...' : topic,
            description: `Extracted from unstructured response: ${topic}`,
            relevance: 4
          }));
        }
        
        return [{
          name: 'General Discussion',
          description: content.substring(0, 200),
          relevance: 3
        }];
        
      case AgentExpertise.ACTION_ITEM_EXTRACTION:
        // Extract action items from text using patterns
        const actionItemPatterns = [
          /(?:action item|task|todo|assign|responsible):\s*([^\n]+)/gi,
          /(?:^|\n)\s*[-•*]\s*([^\n]+)/g,
          /(?:will|should|need to|must)\s+([^\.]+)/gi
        ];
        
        const extractedItems: string[] = [];
        for (const pattern of actionItemPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            extractedItems.push(match[1].trim());
          }
        }
        
        if (extractedItems.length > 0) {
          return extractedItems.map(item => {
            const assigneeMatch = item.match(/\b(assigned to|for|by):\s*([^,\.]+)/i);
            return {
              description: item.replace(/\b(assigned to|for|by):\s*[^,\.]+/i, '').trim(),
              assignee: assigneeMatch ? assigneeMatch[2].trim() : undefined,
              status: 'pending'
            };
          });
        }
        
        return [{ 
          description: 'Review the meeting content for specific action items',
          status: 'pending'
        }];
        
      case AgentExpertise.SENTIMENT_ANALYSIS:
        // Try to extract sentiment scores from text
        const sentimentMatch = content.match(/(?:sentiment|score|rating):\s*([+-]?\d*\.?\d+)/i);
        const overallScore = sentimentMatch ? parseFloat(sentimentMatch[1]) : 0;
        
        return {
          overall: Math.max(-1, Math.min(1, overallScore)), // Clamp between -1 and 1
          segments: null
        };
        
      case AgentExpertise.SUMMARY_GENERATION:
        // Extract title and summary from content
        const titleMatch = content.match(/(?:title|meeting title):\s*([^\n]+)/i);
        const summaryMatch = content.match(/(?:summary|overview):\s*([\s\S]+?)(?:\n\n|$)/i);
        
        return {
          meetingTitle: titleMatch ? titleMatch[1].trim() : 'Meeting Summary',
          summary: summaryMatch ? summaryMatch[1].trim() : content.substring(0, 300),
          decisions: [
            {
              title: 'Extracted from unstructured response',
              content: 'Please review the original content for accurate decisions'
            }
          ]
        };
        
      default:
        this.logger.warn(`No specific formatting for expertise: ${expertise}`);
        return content;
    }
  }
  
  /**
   * Get formatting instructions based on expertise
   */
  private getFormattingInstructions(expertise: AgentExpertise): string {
    switch (expertise) {
      case AgentExpertise.TOPIC_ANALYSIS:
        return `
RESPONSE FORMAT:
Respond with a JSON array of topic objects:
[
  {
    "name": "Topic Name",
    "description": "Detailed description",
    "relevance": 5, // 1-5 rating of importance
    "subtopics": ["Subtopic 1", "Subtopic 2"]
  },
  // additional topics...
]
`;

      case AgentExpertise.ACTION_ITEM_EXTRACTION:
        return `
RESPONSE FORMAT:
Respond with a JSON array of action item objects:
[
  {
    "description": "Full description of the action item",
    "assignee": "Person responsible", // optional
    "dueDate": "YYYY-MM-DD", // optional
    "status": "pending" // or "completed"
  },
  // additional action items...
]
`;

      case AgentExpertise.SENTIMENT_ANALYSIS:
        return `
RESPONSE FORMAT:
Respond with a JSON object:
{
  "overall": 0.5, // number between -1 (negative) and 1 (positive)
  "segments": [
    {
      "text": "Excerpt from transcript", 
      "score": 0.8 // sentiment score for this segment
    }
    // additional segments...
  ]
}
`;

      case AgentExpertise.SUMMARY_GENERATION:
        return `
RESPONSE FORMAT:
Respond with a JSON object:
{
  "meetingTitle": "Concise title summarizing the meeting",
  "summary": "Comprehensive summary of the discussion",
  "decisions": [
    {
      "title": "Decision name",
      "content": "Details about the decision"
    }
    // additional decisions...
  ],
  "next_steps": ["Step 1", "Step 2"] // optional
}
`;

      default:
        return '';
    }
  }

  /**
   * Process a transcript with RAG capabilities
   */
  async analyzeTranscript(
    transcript: string,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      expertise?: AgentExpertise;
      retrievalOptions?: RetrievalOptions;
      state?: any; // Allow passing a pre-enhanced state
    },
  ): Promise<any> {
    try {
      const expertise = options?.expertise || this.expertise[0];
      const meetingId = options?.meetingId || `meeting-${Date.now()}`;

      // If a pre-enhanced state is provided, use it
      let enhancedState = options?.state;
      
      // Otherwise create and enhance a new state
      if (!enhancedState) {
        // Create a state object with the transcript
        const state = {
          transcript,
          meetingId,
          expertise,
          participantNames: options?.participantNames || [],
        };

        this.logger.log(`Analyzing transcript with expertise: ${expertise}`);

        // Create retrieval options by merging defaults with provided options
        const retrievalOptions: RetrievalOptions = {
          ...this.ragConfiguration.retrievalOptions,
          ...options?.retrievalOptions,
        };

        // Enhance the state with RAG context
        enhancedState = await this.enhanceStateWithRagContext(
          state,
          retrievalOptions,
        );
      }

      // Generate a prompt based on the expertise and enhanced state
      const prompt = this.generatePromptFromExpertise(
        expertise,
        enhancedState,
      );

      // Call the LLM
      const result = await this.executeLlmRequest(prompt, enhancedState);

      this.logger.log(`Analysis completed for expertise: ${expertise}`);
      return result;
    } catch (error) {
      this.logger.error(`Error analyzing transcript: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Enhance state with RAG context
   */
  private async enhanceStateWithRagContext(
    state: any,
    retrievalOptions: RetrievalOptions,
  ): Promise<any> {
    if (!this.ragConfiguration.includeRetrievedContext) {
      return state;
    }

    try {
      // Use the transcript as the query for RAG
      const query = this.extractQueryFromState(state);

      // Retrieve relevant context
      const enhancedState = await this.ragService.enhanceStateWithContext(
        state,
        query,
        retrievalOptions,
      );

      return enhancedState;
    } catch (error) {
      this.logger.warn(
        `Error enhancing state with RAG context: ${error.message}. Continuing without RAG.`,
      );
      return state;
    }
  }
} 