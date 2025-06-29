import { Injectable } from "@nestjs/common";
import { BaseAgent, AgentConfig } from "./base-agent";
import { LlmService } from "../llm/llm.service";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  TOPIC_EXTRACTION_PROMPT,
  TOPIC_EXTRACTION_SYSTEM_PROMPT,
} from "../../instruction-promtps";

export interface Topic {
  name: string;
  description?: string;
  subtopics?: string[];
  keywords?: string[];
  duration?: string;
  participants?: string[];
  relevance?: number;
}

@Injectable()
export class TopicExtractionAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: "TopicExtractor",
      systemPrompt: TOPIC_EXTRACTION_SYSTEM_PROMPT,
      llmOptions: {
        temperature: 0.3,
        model: "gpt-4o",
      },
    };
    super(llmService, config);
  }

  /**
   * Extract topics from a transcript
   */
  async extractTopics(transcript: string): Promise<Topic[]> {
    const model = this.getChatModel();

    const messages = [
      new SystemMessage(this.systemPrompt),
      new HumanMessage(
        `${TOPIC_EXTRACTION_PROMPT}\n\nTranscript:\n${transcript}`,
      ),
    ];

    const response = await model.invoke(messages);

    try {
      // Extract JSON from the response
      const content = response.content.toString();
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) ||
        content.match(/(\[\s*\{[\s\S]*\}\s*\])/);

      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr) as Topic[];
    } catch (error) {
      this.logger.error(
        `Failed to parse topics from response: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Process a state object for topic extraction
   */
  async processState(state: any): Promise<any> {
    this.logger.debug("Processing state for topic extraction");

    if (!state.transcript) {
      this.logger.warn("No transcript found in state");
      return state;
    }

    const topics = await this.extractTopics(state.transcript);

    return {
      ...state,
      topics,
    };
  }
}
