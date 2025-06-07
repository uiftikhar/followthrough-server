import { Injectable, Inject, Logger } from "@nestjs/common";
import { IRagService } from "../../../rag/interfaces/rag-service.interface";
import { RAG_SERVICE } from "../../../rag/constants/injection-tokens";
import { LLM_SERVICE } from "../../llm/constants/injection-tokens";
import { STATE_SERVICE } from "../../state/constants/injection-tokens";
import { LlmService } from "../../llm/llm.service";
import { StateService } from "../../state/state.service";
import {
  RagEnhancedAgent,
  RagAgentConfig,
  AgentExpertise,
} from "../../../rag/agents/rag-enhanced-agent";
import { Topic } from "./interfaces/state.interface";
import {
  TOPIC_EXTRACTION_PROMPT,
  TOPIC_EXTRACTION_SYSTEM_PROMPT,
} from "../../../instruction-promtps";
import { RagService } from "../../../rag/rag.service";

// Define the token here to avoid circular import
export const RAG_TOPIC_EXTRACTION_CONFIG = "RAG_TOPIC_EXTRACTION_CONFIG";

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
        indexName: "meeting-analysis",
        namespace: "topics",
        topK: 5,
        minScore: 0.7,
      },
    };

    super(llmService, stateService, ragService, {
      name: config.name || "Topic Extraction Agent",
      systemPrompt: config.systemPrompt || TOPIC_EXTRACTION_SYSTEM_PROMPT,
      llmOptions: config.llmOptions,
      ragOptions: ragConfig,
    });

    // Override expertisePrompts with topic-specific prompts
    (this as any).expertisePrompts = {
      [AgentExpertise.TOPIC_ANALYSIS]: TOPIC_EXTRACTION_PROMPT,
    };
  }

  /**
   * Extract query from state to use for RAG retrieval
   */
  protected extractQueryFromState(state: any): string {
    // Extract a query focused on topic extraction
    let query = "";

    this.logger.log("********* RAG TOPIC **********: extractQueryFromState");
    if (typeof state === "object") {
      if (state.transcript) {
        // Use a shorter version of the transcript focused on topics
        const transcript =
          typeof state.transcript === "string"
            ? state.transcript.substring(0, 500)
            : JSON.stringify(state.transcript).substring(0, 500);

        query = `Extract topics from the following meeting transcript: ${transcript}`;

        // If we have existing topics, add them to focus the query
        if (
          state.topics &&
          Array.isArray(state.topics) &&
          state.topics.length > 0
        ) {
          const topicStr = state.topics.map((t: any) => t.name || t).join(", ");
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
      this.logger.log("********* RAG TOPIC **********: extractTopics");
      // Create a base state for RAG enhancement
      const baseState = {
        transcript,
        meetingId: options?.meetingId || `meeting-${Date.now()}`,
        participantNames: options?.participantNames || [],
      };

      // Prepare retrieval options
      const retrievalOptions = {
        indexName: "meeting-analysis",
        namespace: "topics",
        topK: options?.retrievalOptions?.topK || 5,
        minScore: options?.retrievalOptions?.minScore || 0.7,
      };

      // Extract a more specific query for topic retrieval
      const query = `Extract topics from the following meeting transcript: ${transcript}...`;

      // Enhance state with RAG context before proceeding
      const enhancedState = await this.ragService.enhanceStateWithContext(
        baseState,
        query,
        retrievalOptions,
      );

      this.logger.log(
        "********* RAG TOPIC **********: extractTopics - enhancedState\n",
        enhancedState,
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
    "relevance": 5, // number from 1-10
    "subtopics": ["Subtopic 1", "Subtopic 2"],
    "keywords": ["keyword1", "keyword2"],
    "participants": ["Person 1", "Person 2"],
    "duration": "estimated time"
  },
  ...
]
If you cannot extract proper topics, return an array with at least one valid topic object.
DO NOT include markdown formatting or any text outside the JSON array.
`,
      };

      // Generate topic-specific prompt
      const prompt = `${TOPIC_EXTRACTION_PROMPT}

Transcript:
${transcript}

${stateWithFormat.formatInstructions}`;

      // Execute LLM request
      const result = await this.executeLlmRequest(prompt, stateWithFormat);

      // Process the result to ensure we get properly structured topics
      return this.processTopicsResult(result);
    } catch (error) {
      this.logger.error(
        `Error extracting topics with RAG: ${error.message}`,
        error.stack,
      );
      // Return a fallback topic rather than throwing an error
      return [
        {
          name: "Error Processing Topics",
          description:
            "There was an error processing the meeting topics. Please try again.",
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
      this.logger.log("Executing LLM request for topic extraction");

      // Set up LLM options
      const llmOptions = {
        model: "gpt-4o",
        temperature: 0.7,
      };

      // Get the LLM chat model
      const llm = this.llmService.getChatModel(llmOptions);

      // Add retrieved context if available
      let promptWithContext = prompt;
      if (state.retrievedContext) {
        const formattedContext = this.formatRetrievedContext(
          state.retrievedContext,
        );
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
        { role: "system", content: TOPIC_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: promptWithContext },
      ];

      const response = await llm.invoke(messages);

      // Parse and return the result
      const content = response.content.toString();
      this.logger.log("Topic extraction LLM request completed");

      return content;
    } catch (error) {
      this.logger.error(
        `Error executing LLM request for topics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process topics result from LLM
   */
  private processTopicsResult(result: any): Topic[] {
    try {
      this.logger.log("Processing topics result from LLM");
      this.logger.log(`Result type: ${typeof result}, preview: ${JSON.stringify(result).substring(0, 100)}...`);

      let parsed = result;

      // Handle string responses
      if (typeof result === "string") {
        this.logger.log("Result is string, cleaning and parsing");
        
        // FIXED: Enhanced JSON extraction and cleaning
        let cleaned = result
          .replace(/```json\s*/gi, "")
          .replace(/```\s*/g, "")
          .replace(/^\s*[\[\{]/, match => match.trim())
          .replace(/[\]\}]\s*$/, match => match.trim())
          .trim();

        // Try multiple parsing strategies
        try {
          parsed = JSON.parse(cleaned);
          this.logger.log("Successfully parsed cleaned JSON string");
        } catch (parseError) {
          // FIXED: Try extracting JSON from within text
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/) || cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              this.logger.log("Successfully extracted and parsed JSON from text");
            } catch (extractError) {
              this.logger.warn("JSON extraction failed, trying alternative parsing");
              // FIXED: Try parsing as individual topic objects
              parsed = this.parseTopicsFromText(cleaned);
            }
          } else {
            this.logger.warn("No JSON structure found, parsing as text");
            parsed = this.parseTopicsFromText(cleaned);
          }
        }
      }

      // FIXED: Handle different result structures
      if (Array.isArray(parsed)) {
        this.logger.log("Result is array, validating topics");
        return parsed
          .map((item: any) => this.convertToTopic(item))
          .filter((topic: Topic | null) => topic !== null) as Topic[];
      }

      // Handle single topic object
      if (parsed && typeof parsed === "object") {
        if (parsed.topics && Array.isArray(parsed.topics)) {
          this.logger.log("Found topics array in result object");
          return parsed.topics
            .map((item: any) => this.convertToTopic(item))
            .filter((topic: Topic | null) => topic !== null) as Topic[];
        } else {
          this.logger.log("Converting single object result to topic");
          const topic = this.convertToTopic(parsed);
          return topic ? [topic] : this.createFallbackTopics(result);
        }
      }

      // FIXED: Enhanced fallback with context analysis
      this.logger.warn("All parsing attempts failed, creating enhanced fallback topics");
      return this.createFallbackTopics(result);
    } catch (error) {
      this.logger.error(`Error processing topics result: ${error.message}`);
      return this.createFallbackTopics(result);
    }
  }

  /**
   * FIXED: Parse topics from plain text when JSON parsing fails
   */
  private parseTopicsFromText(text: string): any[] {
    try {
      const topics: any[] = [];
      
      // Look for topic patterns in text
      const topicPatterns = [
        /(?:topic|subject|theme):\s*([^\n\r;,]+)/gi,
        /(\d+)\.\s*([^\n\r;,]+)/g,
        /-\s*([^\n\r;,]+)/g,
        /\*\s*([^\n\r;,]+)/g,
      ];

      for (const pattern of topicPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const topicName = match[1] || match[2];
          if (topicName && topicName.trim().length > 2) {
            topics.push({
              name: topicName.trim(),
              relevance: 5,
              description: `Extracted from text analysis`,
            });
          }
        }
      }

      return topics.length > 0 ? topics : [];
    } catch (error) {
      this.logger.warn(`Failed to parse topics from text: ${error.message}`);
      return [];
    }
  }

  /**
   * FIXED: Enhanced fallback topic creation with context analysis
   */
  private createFallbackTopics(originalResult: any): Topic[] {
    this.logger.log("Creating enhanced fallback topics with context analysis");
    
    try {
      // Try to extract some context from the original result
      const resultText = typeof originalResult === 'string' 
        ? originalResult 
        : JSON.stringify(originalResult);
      
      // FIXED: Create multiple fallback topics based on common meeting patterns (no description for interface compatibility)
      const fallbackTopics: Topic[] = [
        {
          name: "General Discussion",
          relevance: 3,
          keywords: ["discussion", "meeting", "general"],
        }
      ];

      // FIXED: Try to identify additional topics from text patterns
      if (resultText.toLowerCase().includes('project')) {
        fallbackTopics.push({
          name: "Project Updates",
          relevance: 4,
          keywords: ["project", "updates", "progress"],
        });
      }

      if (resultText.toLowerCase().includes('budget') || resultText.toLowerCase().includes('cost')) {
        fallbackTopics.push({
          name: "Budget and Costs",
          relevance: 4,
          keywords: ["budget", "cost", "financial"],
        });
      }

      if (resultText.toLowerCase().includes('timeline') || resultText.toLowerCase().includes('schedule')) {
        fallbackTopics.push({
          name: "Timeline and Scheduling",
          relevance: 4,
          keywords: ["timeline", "schedule", "deadline"],
        });
      }

      return fallbackTopics;
    } catch (error) {
      this.logger.error(`Error creating fallback topics: ${error.message}`);
      return [{
        name: "Meeting Discussion",
        relevance: 2,
        keywords: ["meeting", "discussion"],
      }];
    }
  }

  /**
   * Convert object result to topic
   */
  private convertToTopic(item: any): Topic | null {
    if (!item || typeof item !== "object") {
      return null;
    }

    // FIXED: Enhanced topic object validation and construction matching interface
    const topic: Topic = {
      name: item.name || item.title || item.topic || "Unknown Topic",
    };

    // Only add optional properties if they exist and are valid
    if (item.description || item.summary) {
      topic.description = item.description || item.summary;
    }

    const relevance = this.validateRelevance(item.relevance || item.importance || item.score);
    if (relevance !== undefined) {
      topic.relevance = relevance;
    }

    if (Array.isArray(item.keywords)) {
      topic.keywords = item.keywords;
    } else if (Array.isArray(item.tags)) {
      topic.keywords = item.tags;
    } else if (item.keywords && typeof item.keywords === 'string') {
      topic.keywords = [item.keywords];
    }

    if (Array.isArray(item.subtopics)) {
      topic.subtopics = item.subtopics;
    }

    if (Array.isArray(item.participants)) {
      topic.participants = item.participants;
    }

    if (typeof item.duration === 'number' && item.duration > 0) {
      topic.duration = item.duration;
    }

    // FIXED: Validate that we have at least a meaningful name
    if (!topic.name || topic.name.trim().length < 2 || topic.name === "Unknown Topic") {
      return null;
    }

    return topic;
  }

  /**
   * FIXED: Validate relevance score
   */
  private validateRelevance(relevance: any): number | undefined {
    if (typeof relevance === 'number') {
      return Math.max(1, Math.min(10, Math.round(relevance)));
    }
    
    if (typeof relevance === 'string') {
      const parsed = parseInt(relevance, 10);
      if (!isNaN(parsed)) {
        return Math.max(1, Math.min(10, parsed));
      }
    }
    
    return undefined;
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
    const meetingId = metadata.meetingId || metadata.meeting_id || "unknown";
    const date = metadata.date || "unknown";
    const relevance = doc.score
      ? ` (Relevance: ${(doc.score * 100).toFixed(1)}%)`
      : "";

    return `Meeting ${meetingId} (${date})${relevance}:\n${doc.content}`;
  })
  .join("\n\n")}
---------------------------

Use the above topics from previous related meetings as context.
If a topic continues from a previous meeting, note that continuity.
However, your primary task is to extract topics from the CURRENT transcript.

IMPORTANT: Return your response as a valid JSON array of topic objects with the exact structure shown.
`;
  }
}
