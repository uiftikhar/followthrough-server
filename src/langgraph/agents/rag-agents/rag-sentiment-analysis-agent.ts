import { Injectable, Inject, Logger } from "@nestjs/common";
import { RAG_SERVICE } from "../../../rag/constants/injection-tokens";
import { LLM_SERVICE } from "../../llm/constants/injection-tokens";
import { STATE_SERVICE } from "../../state/constants/injection-tokens";
import { LlmService } from "../../llm/llm.service";
import { StateService } from "../../state/state.service";
import { RagService } from "../../../rag/rag.service";
import {
  RagEnhancedAgent,
  RagAgentConfig,
  AgentExpertise,
} from "../../../rag/agents/rag-enhanced-agent";
import { SENTIMENT_ANALYSIS_PROMPT } from "../../../instruction-promtps";

// Define token locally to avoid circular dependency
export const RAG_SENTIMENT_ANALYSIS_CONFIG = "RAG_SENTIMENT_ANALYSIS_CONFIG";

export interface RagSentimentAnalysisConfig extends RagAgentConfig {
  expertise: AgentExpertise[];
  specializedQueries?: Partial<Record<AgentExpertise, string>>;
}

export interface SentimentAnalysis {
  overall: "positive" | "negative" | "neutral" | "mixed";
  score: number; // -1 to 1 scale
  segments: Array<{
    text: string;
    sentiment: "positive" | "negative" | "neutral";
    score: number;
    speaker?: string;
    timestamp?: string;
  }>;
  keyEmotions: string[];
  toneShifts: Array<{
    from: string;
    to: string;
    approximate_time?: string;
    trigger?: string;
  }>;
}

/**
 * RAG-Enhanced Sentiment Analysis Agent
 *
 * Specialized agent for analyzing sentiment in meeting transcripts
 * with enhanced context from previous sentiment analyses
 */
@Injectable()
export class RagSentimentAnalysisAgent extends RagEnhancedAgent {
  protected readonly logger = new Logger(RagSentimentAnalysisAgent.name);

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: RagService,
    @Inject(RAG_SENTIMENT_ANALYSIS_CONFIG) config: RagSentimentAnalysisConfig,
  ) {
    // Configure RAG options for sentiment analysis
    const ragConfig = config.ragOptions || {
      includeRetrievedContext: true,
      retrievalOptions: {
        indexName: "meeting-analysis",
        namespace: "sentiment-analysis",
        topK: 3,
        minScore: 0.7,
      },
    };

    super(llmService, stateService, ragService, {
      name: config.name || "Sentiment Analysis Agent",
      systemPrompt: config.systemPrompt || SENTIMENT_ANALYSIS_PROMPT,
      llmOptions: config.llmOptions,
      ragOptions: ragConfig,
    });

    // Override expertisePrompts with sentiment-specific prompts
    (this as any).expertisePrompts = {
      [AgentExpertise.SENTIMENT_ANALYSIS]: SENTIMENT_ANALYSIS_PROMPT,
    };
  }

  /**
   * Analyze sentiment in a meeting transcript with RAG enhancement
   */
  async analyzeSentiment(
    transcript: string,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      retrievalOptions?: any;
    },
  ): Promise<SentimentAnalysis> {
    try {
      this.logger.log("Starting RAG-enhanced sentiment analysis");

      // Create state for this request
      const state = {
        transcript,
        meetingId: options?.meetingId || `sentiment-${Date.now()}`,
        participantNames: options?.participantNames || [],
      };

      // Enhance with RAG context using similar sentiment analyses
      const query = `Sentiment analysis for meeting: ${transcript.substring(0, 200)}...`;

      // Prepare retrieval options
      const retrievalOptions = {
        indexName: "meeting-analysis",
        namespace: "sentiment-analysis",
        topK: options?.retrievalOptions?.topK || 3,
        minScore: options?.retrievalOptions?.minScore || 0.7,
      };

      const enhancedState = await this.ragService.enhanceStateWithContext(
        state,
        query,
        retrievalOptions,
      );

      // Generate prompt for sentiment analysis
      const prompt = `${SENTIMENT_ANALYSIS_PROMPT}

Meeting Transcript:
${transcript}

Please analyze the sentiment of this meeting transcript and provide a comprehensive sentiment analysis in the specified JSON format.`;

      // Execute LLM request with enhanced context
      const result = await this.executeSentimentLlmRequest(
        prompt,
        enhancedState,
      );

      // Process and validate the result
      return this.processSentimentResult(result);
    } catch (error) {
      this.logger.error(
        `Error in sentiment analysis: ${error.message}`,
        error.stack,
      );
      // Return default sentiment on error
      return {
        overall: "neutral",
        score: 0,
        segments: [],
        keyEmotions: [],
        toneShifts: [],
      };
    }
  }

  /**
   * Execute LLM request for sentiment analysis
   */
  private async executeSentimentLlmRequest(
    prompt: string,
    state: any,
  ): Promise<any> {
    try {
      this.logger.log("Executing LLM request for sentiment analysis");

      // Set up LLM options
      const llmOptions = {
        model: "gpt-4o",
        temperature: 0.3,
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

      // Invoke the LLM
      const messages = [
        { role: "system", content: SENTIMENT_ANALYSIS_PROMPT },
        { role: "user", content: promptWithContext },
      ];

      const response = await llm.invoke(messages);

      // Parse and return the result
      const content = response.content.toString();
      this.logger.log("Sentiment analysis LLM request completed");

      return content;
    } catch (error) {
      this.logger.error(
        `Error executing LLM request for sentiment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Process sentiment result from LLM
   */
  private processSentimentResult(result: any): SentimentAnalysis {
    try {
      this.logger.log("Processing sentiment result from LLM");
      this.logger.log(
        `Result type: ${typeof result}, preview: ${JSON.stringify(result).substring(0, 200)}...`,
      );

      let parsed = result;

      // Handle string responses
      if (typeof result === "string") {
        this.logger.log("Result is string, cleaning and parsing");
        try {
          // Enhanced JSON extraction for sentiment data
          const cleaned = result
            .replace(/```json\s*/gi, "")
            .replace(/```\s*/g, "")
            .trim();

          parsed = JSON.parse(cleaned);
          this.logger.log("Extracted JSON object from text");
        } catch (parseError) {
          this.logger.warn(`JSON parsing failed: ${parseError.message}`);
          // Try to extract sentiment information from text
          parsed = this.extractSentimentFromText(result);
        }
      }

      this.logger.log(
        `Attempting to parse JSON: ${JSON.stringify(parsed).substring(0, 200)}...`,
      );

      // Enhanced sentiment object validation and construction
      const sentiment: SentimentAnalysis = {
        overall: this.normalizeOverallSentiment(
          parsed.overall || parsed.sentiment || "neutral",
        ),
        score: this.normalizeScore(parsed.score || 0),
        segments: this.processSegments(parsed.segments || []),
        keyEmotions: Array.isArray(parsed.keyEmotions)
          ? parsed.keyEmotions
          : Array.isArray(parsed.emotions)
            ? parsed.emotions
            : [],
        toneShifts: Array.isArray(parsed.toneShifts)
          ? parsed.toneShifts
          : Array.isArray(parsed.shifts)
            ? parsed.shifts
            : [],
      };

      this.logger.log("Validating sentiment analysis result");
      this.logger.log(
        `Validated sentiment: overall=${sentiment.overall}, score=${sentiment.score}, segments=${sentiment.segments?.length}, emotions=${sentiment.keyEmotions?.length}, shifts=${sentiment.toneShifts?.length}`,
      );

      return sentiment;
    } catch (error) {
      this.logger.error(`Error processing sentiment result: ${error.message}`);
      return this.createFallbackSentiment();
    }
  }

  /**
   * Extract sentiment information from plain text when JSON parsing fails
   */
  private extractSentimentFromText(text: string): any {
    this.logger.log("Extracting sentiment from plain text");

    const sentiment: any = {
      overall: "neutral",
      score: 0,
      segments: [],
      keyEmotions: [],
      toneShifts: [],
    };

    // Extract overall sentiment
    if (text.toLowerCase().includes("positive")) {
      sentiment.overall = "positive";
      sentiment.score = 0.5;
    } else if (text.toLowerCase().includes("negative")) {
      sentiment.overall = "negative";
      sentiment.score = -0.5;
    } else if (text.toLowerCase().includes("mixed")) {
      sentiment.overall = "mixed";
      sentiment.score = 0.1;
    }

    // Extract emotions from text
    const emotions: string[] = [];
    const emotionPatterns = [
      /(?:emotion|feeling|mood):\s*([^\n\r;,]+)/gi,
      /(happy|sad|angry|excited|frustrated|hopeful|concerned|optimistic|pessimistic)/gi,
    ];

    for (const pattern of emotionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const emotion = match[1].toLowerCase();
        if (!emotions.includes(emotion)) {
          emotions.push(emotion);
        }
      }
    }

    sentiment.keyEmotions = emotions;
    return sentiment;
  }

  /**
   * Process segments with enhanced speaker detection
   */
  private processSegments(segments: any[]): Array<{
    text: string;
    sentiment: "positive" | "negative" | "neutral";
    score: number;
    speaker?: string;
    timestamp?: string;
  }> {
    if (!Array.isArray(segments)) {
      return [];
    }

    return segments
      .filter((segment: any) => segment && (segment.text || segment.content))
      .map((segment: any) => ({
        text: segment.text || segment.content || "",
        sentiment: this.normalizeSegmentSentiment(
          segment.sentiment || "neutral",
        ),
        score: this.normalizeScore(segment.score || 0),
        speaker: this.extractSpeakerFromSegment(segment),
        timestamp: segment.timestamp || undefined,
      }))
      .filter((segment: any) => segment.text.trim().length > 0);
  }

  /**
   * Extract speaker information from segment
   */
  private extractSpeakerFromSegment(segment: any): string | undefined {
    if (!segment) return undefined;

    // Check direct speaker properties
    if (segment.speaker && typeof segment.speaker === "string") {
      return segment.speaker.trim();
    }

    if (segment.author && typeof segment.author === "string") {
      return segment.author.trim();
    }

    if (segment.name && typeof segment.name === "string") {
      return segment.name.trim();
    }

    // Try to extract speaker from text using common patterns
    const text = segment.text || segment.content || "";
    if (typeof text !== "string") return undefined;

    const speakerPatterns = [
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):/, // "John Smith:"
      /^([A-Z][a-z]+):\s/, // "John: "
      /^\[([^\]]+)\]/, // "[John Smith]"
      /^<([^>]+)>/, // "<John>"
    ];

    for (const pattern of speakerPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const speaker = match[1].trim();
        // Validate speaker name (basic check)
        if (
          speaker.length > 1 &&
          speaker.length < 50 &&
          /^[A-Za-z\s]+$/.test(speaker)
        ) {
          return speaker;
        }
      }
    }

    return undefined;
  }

  /**
   * Normalize overall sentiment value
   */
  private normalizeOverallSentiment(
    overall: any,
  ): "positive" | "negative" | "neutral" | "mixed" {
    if (typeof overall === "string") {
      const normalized = overall.toLowerCase().trim();
      if (["positive", "pos", "good", "happy"].includes(normalized)) {
        return "positive";
      }
      if (["negative", "neg", "bad", "sad", "angry"].includes(normalized)) {
        return "negative";
      }
      if (["mixed", "varied", "complex"].includes(normalized)) {
        return "mixed";
      }
    }
    return "neutral";
  }

  /**
   * Normalize segment sentiment value (no mixed for segments)
   */
  private normalizeSegmentSentiment(
    sentiment: any,
  ): "positive" | "negative" | "neutral" {
    if (typeof sentiment === "string") {
      const normalized = sentiment.toLowerCase().trim();
      if (["positive", "pos", "good", "happy"].includes(normalized)) {
        return "positive";
      }
      if (["negative", "neg", "bad", "sad", "angry"].includes(normalized)) {
        return "negative";
      }
    }
    return "neutral";
  }

  /**
   * Normalize sentiment score to -1 to 1 range
   */
  private normalizeScore(score: any): number {
    if (typeof score === "number") {
      return Math.max(-1, Math.min(1, score));
    }

    if (typeof score === "string") {
      const parsed = parseFloat(score);
      if (!isNaN(parsed)) {
        return Math.max(-1, Math.min(1, parsed));
      }
    }

    return 0;
  }

  /**
   * Create enhanced fallback sentiment with context
   */
  private createFallbackSentiment(): SentimentAnalysis {
    return {
      overall: "neutral",
      score: 0,
      segments: [],
      keyEmotions: ["neutral"],
      toneShifts: [],
    };
  }

  /**
   * Extract query from state for RAG retrieval
   */
  protected extractQueryFromState(state: any): string {
    if (state.transcript) {
      return `Sentiment analysis context: ${state.transcript.substring(0, 300)}...`;
    }
    return "Meeting sentiment analysis";
  }

  /**
   * Process a state object for sentiment analysis
   */
  async processState(state: any): Promise<any> {
    this.logger.debug("Processing state for sentiment analysis");

    if (!state.transcript) {
      this.logger.warn("No transcript found in state");
      return state;
    }

    const sentiment = await this.analyzeSentiment(state.transcript, {
      meetingId: state.meetingId,
      participantNames: state.participantNames || [],
    });

    return {
      ...state,
      sentiment,
    };
  }

  /**
   * Format retrieved context for sentiment analysis
   */
  protected formatRetrievedContext(context: any): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return "";
    }

    return `
RELEVANT SENTIMENT ANALYSES FROM PREVIOUS MEETINGS:
-------------------------------------------------
${context.documents
  .map((doc: any, index: number) => {
    const metadata = doc.metadata || {};
    const meetingId = metadata.meetingId || "unknown";
    const date = metadata.date || "unknown";
    return `[Meeting ${meetingId} - ${date}]\n${doc.content}`;
  })
  .join("\n\n")}
-------------------------------------------------

Use the above context to inform your sentiment analysis, but focus on the current meeting content.
`;
  }
}
