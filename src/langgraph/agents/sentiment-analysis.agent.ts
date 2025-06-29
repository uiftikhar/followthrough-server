import { Injectable } from "@nestjs/common";
import { BaseAgent, AgentConfig } from "./base-agent";
import { LlmService } from "../llm/llm.service";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { SENTIMENT_ANALYSIS_PROMPT } from "../../instruction-promtps";

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

@Injectable()
export class SentimentAnalysisAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: "SentimentAnalyzer",
      systemPrompt: SENTIMENT_ANALYSIS_PROMPT,
      llmOptions: {
        temperature: 0.3,
        model: "gpt-4o",
      },
    };
    super(llmService, config);
  }

  /**
   * Analyze sentiment in a transcript
   */
  async analyzeSentiment(transcript: string): Promise<SentimentAnalysis> {
    try {
      this.logger.log("Starting sentiment analysis");
      const model = this.getChatModel();

      const messages = [
        new SystemMessage(this.systemPrompt),
        new HumanMessage(
          `Analyze the sentiment in this meeting transcript:\n\nMeeting Transcript:\n${transcript}`,
        ),
      ];

      this.logger.log("Invoking LLM for sentiment analysis");
      const response = await model.invoke(messages);
      const content = response.content.toString();

      this.logger.log(`Raw LLM response length: ${content.length}`);
      this.logger.log(
        `Raw LLM response preview: ${content.substring(0, 300)}...`,
      );

      // Try multiple JSON extraction patterns
      let jsonStr = content;

      // Remove markdown code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
        this.logger.log("Extracted JSON from code block");
      } else {
        // Try to find JSON object in text
        const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonStr = jsonObjectMatch[0];
          this.logger.log("Extracted JSON object from text");
        }
      }

      this.logger.log(`Extracted JSON string: ${jsonStr.substring(0, 200)}...`);

      const result = JSON.parse(jsonStr) as SentimentAnalysis;

      // Validate and fix the result structure
      const validatedResult = this.validateSentimentResult(result);

      this.logger.log(
        `Sentiment analysis completed successfully. Overall: ${validatedResult.overall}, Score: ${validatedResult.score}`,
      );
      return validatedResult;
    } catch (error) {
      this.logger.error(
        `Failed to analyze sentiment: ${error.message}`,
        error.stack,
      );
      this.logger.warn("Returning default neutral sentiment due to error");
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
  private validateSentimentResult(result: any): SentimentAnalysis {
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
          sentiment: validOverallSentiments.includes(segment.sentiment)
            ? segment.sentiment
            : "neutral",
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
      ? result.keyEmotions
      : [];
    const toneShifts = Array.isArray(result.toneShifts)
      ? result.toneShifts.filter((shift) => shift && shift.from && shift.to)
      : [];

    return {
      overall,
      score,
      segments,
      keyEmotions,
      toneShifts,
    };
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

    const sentiment = await this.analyzeSentiment(state.transcript);

    return {
      ...state,
      sentiment,
    };
  }
}
