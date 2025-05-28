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
 * RAG-enhanced agent specialized for sentiment analysis of meeting transcripts
 * Uses historical sentiment patterns and context to improve analysis accuracy
 */
@Injectable()
export class RagSentimentAnalysisAgent extends RagEnhancedAgent {
  protected readonly logger = new Logger(RagSentimentAnalysisAgent.name);
  protected readonly config: RagSentimentAnalysisConfig;

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: RagService,
    @Inject(RAG_SENTIMENT_ANALYSIS_CONFIG) config: RagSentimentAnalysisConfig,
  ) {
    super(llmService, stateService, ragService, {
      name: config.name || "RAG Sentiment Analysis Agent",
      systemPrompt: config.systemPrompt || SENTIMENT_ANALYSIS_PROMPT,
      llmOptions: config.llmOptions,
      ragOptions: config.ragOptions,
    });

    this.config = config;
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
      const enhancedState = await this.ragService.enhanceStateWithContext(
        state,
        query,
        options?.retrievalOptions || this.config.ragOptions?.retrievalOptions,
      );

      // Generate prompt for sentiment analysis
      const prompt = `${SENTIMENT_ANALYSIS_PROMPT}

Meeting Transcript:
${transcript}

Please analyze the sentiment of this meeting transcript and provide a comprehensive sentiment analysis in the specified JSON format.`;

      // Execute LLM request with enhanced context
      const result = await this.executeLlmRequest(prompt, enhancedState);

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
   * Process the sentiment result from the LLM
   */
  private processSentimentResult(result: any): SentimentAnalysis {
    this.logger.log("Processing sentiment result from LLM");
    this.logger.log(
      `Result type: ${typeof result}, preview: ${JSON.stringify(result).substring(0, 200)}...`,
    );

    try {
      let cleanedResult = result;

      // If result is a string, clean it first
      if (typeof result === "string") {
        this.logger.log("Result is string, cleaning and parsing");

        // Try multiple JSON extraction patterns
        let jsonStr = result;

        // Remove markdown code blocks
        const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1];
          this.logger.log("Extracted JSON from code block");
        } else {
          // Try to find JSON object in text
          const jsonObjectMatch = result.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonStr = jsonObjectMatch[0];
            this.logger.log("Extracted JSON object from text");
          }
        }

        this.logger.log(
          `Attempting to parse JSON: ${jsonStr.substring(0, 200)}...`,
        );
        cleanedResult = JSON.parse(jsonStr);
      }

      // Validate and format the sentiment analysis
      return this.validateSentimentAnalysis(cleanedResult);
    } catch (error) {
      this.logger.warn(`Failed to parse sentiment result: ${error.message}`);
      this.logger.warn("Returning default neutral sentiment");
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
   * Validate and normalize sentiment analysis result
   */
  private validateSentimentAnalysis(result: any): SentimentAnalysis {
    this.logger.log("Validating sentiment analysis result");

    // Ensure overall sentiment is valid
    const validOverallSentiments = ["positive", "negative", "neutral", "mixed"];
    const overall = validOverallSentiments.includes(result.overall)
      ? result.overall
      : "neutral";

    // Ensure score is a valid number between -1 and 1
    let score = typeof result.score === "number" ? result.score : 0;
    score = Math.max(-1, Math.min(1, score));

    // Validate segments array
    const segments = Array.isArray(result.segments)
      ? result.segments.map((segment) => ({
          text: segment.text || "",
          sentiment: validOverallSentiments
            .slice(0, 3)
            .includes(segment.sentiment)
            ? segment.sentiment
            : "neutral", // only positive, negative, neutral for segments
          score:
            typeof segment.score === "number"
              ? Math.max(-1, Math.min(1, segment.score))
              : 0,
          speaker: segment.speaker || undefined,
          timestamp: segment.timestamp || undefined,
        }))
      : [];

    // Validate other arrays
    const keyEmotions = Array.isArray(result.keyEmotions)
      ? result.keyEmotions.filter(
          (emotion) => typeof emotion === "string" && emotion.trim().length > 0,
        )
      : [];

    const toneShifts = Array.isArray(result.toneShifts)
      ? result.toneShifts
          .filter(
            (shift) =>
              shift &&
              typeof shift.from === "string" &&
              typeof shift.to === "string",
          )
          .map((shift) => ({
            from: shift.from,
            to: shift.to,
            approximate_time: shift.approximate_time || undefined,
            trigger: shift.trigger || undefined,
          }))
      : [];

    this.logger.log(
      `Validated sentiment: overall=${overall}, score=${score}, segments=${segments.length}, emotions=${keyEmotions.length}, shifts=${toneShifts.length}`,
    );

    return {
      overall,
      score,
      segments,
      keyEmotions,
      toneShifts,
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
   * Execute LLM request with enhanced context
   */
  protected async executeLlmRequest(prompt: string, state: any): Promise<any> {
    try {
      // Set up LLM options for sentiment analysis
      const llmOptions = {
        model: "gpt-4o",
        temperature: 0.3,
      };

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
        {
          role: "system",
          content:
            "You are an expert at analyzing sentiment in meeting transcripts. Always respond with valid JSON in the exact format requested.",
        },
        { role: "user", content: promptWithContext },
      ];

      const response = await llm.invoke(messages);
      return response.content.toString();
    } catch (error) {
      this.logger.error(
        `Error executing LLM request: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
