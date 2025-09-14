import { Injectable } from "@nestjs/common";
import { BaseAgent, AgentConfig } from "./base-agent";
import { LlmService } from "../llm/llm.service";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { EXTRACT_ACTION_ITEMS_PROMPT } from "../../instruction-promtps";

export interface ActionItem {
  description: string;
  assignee?: string;
  deadline?: string;
  status?: "pending" | "in_progress" | "completed";
  priority?: "low" | "medium" | "high";
  context?: string;
}

@Injectable()
export class ActionItemAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: "ActionItemExtractor",
      systemPrompt: EXTRACT_ACTION_ITEMS_PROMPT,
      llmOptions: {
        temperature: 0.2,
        model: "gpt-4o",
      },
    };
    super(llmService, config);
  }

  /**
   * Extract action items from a transcript
   */
  async extractActionItems(transcript: string): Promise<ActionItem[]> {
    const model = this.getChatModel();

    const messages = [
      new SystemMessage(this.systemPrompt),
      new HumanMessage(`Transcript:\n${transcript}`),
    ];

    this.logger.debug(`Sending transcript of length ${transcript.length} to LLM`);

    const response = await model.invoke(messages);
    const content = response.content.toString();
    
    this.logger.debug(`LLM response content: ${content.substring(0, 500)}...`);

    try {
      // Try multiple parsing strategies
      let jsonStr = content;
      
      // Strategy 1: Look for JSON code blocks
      const jsonBlockMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1];
        this.logger.debug('Found JSON in code block');
      } else {
        // Strategy 2: Look for any code block
        const codeBlockMatch = content.match(/```\s*\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1];
          this.logger.debug('Found JSON in generic code block');
        } else {
          // Strategy 3: Look for JSON array pattern
          const arrayMatch = content.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
          if (arrayMatch) {
            jsonStr = arrayMatch[1];
            this.logger.debug('Found JSON array pattern');
          } else {
            // Strategy 4: Try to extract JSON from anywhere in the content
            const objectMatch = content.match(/\{[\s\S]*\}/);
            if (objectMatch) {
              // If we find a single object, wrap it in an array
              const singleObj = JSON.parse(objectMatch[0]);
              if (singleObj && typeof singleObj === 'object' && !Array.isArray(singleObj)) {
                this.logger.debug('Found single JSON object, wrapping in array');
                return [singleObj as ActionItem];
              }
            }
          }
        }
      }

      // Clean up the JSON string
      jsonStr = jsonStr.trim();
      
      this.logger.debug(`Attempting to parse JSON: ${jsonStr.substring(0, 200)}...`);
      
      const parsed = JSON.parse(jsonStr);
      
      // Ensure we return an array
      if (Array.isArray(parsed)) {
        this.logger.debug(`Successfully parsed ${parsed.length} action items`);
        return parsed as ActionItem[];
      } else if (parsed && typeof parsed === 'object') {
        this.logger.debug('Parsed single object, wrapping in array');
        return [parsed as ActionItem];
      } else {
        this.logger.warn('Parsed result is not an object or array');
        return [];
      }
    } catch (error) {
      this.logger.error(
        `Failed to parse action items from response: ${error.message}`,
        `Content: ${content}`,
      );
      return [];
    }
  }

  /**
   * Process a state object for action item extraction
   */
  async processState(state: any): Promise<any> {
    this.logger.debug("Processing state for action item extraction");

    if (!state.transcript) {
      this.logger.warn("No transcript found in state");
      return state;
    }

    const actionItems = await this.extractActionItems(state.transcript);

    return {
      ...state,
      actionItems,
    };
  }
}
