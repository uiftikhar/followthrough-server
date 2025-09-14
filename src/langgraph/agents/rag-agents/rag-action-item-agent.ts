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
import { EXTRACT_ACTION_ITEMS_PROMPT } from "../../../instruction-promtps";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Define token locally to avoid circular dependency
export const RAG_ACTION_ITEM_CONFIG = "RAG_ACTION_ITEM_CONFIG";

export interface RagActionItemConfig extends RagAgentConfig {
  expertise: AgentExpertise[];
  specializedQueries?: Partial<Record<AgentExpertise, string>>;
}

export interface ActionItem {
  description: string;
  assignee: string;
  deadline?: string;
  status: "pending" | "in_progress" | "completed";
  priority?: "low" | "medium" | "high";
  context?: string;
  confidence?: number;
}

/**
 * RAG-Enhanced Action Item Extraction Agent
 *
 * Specialized agent for extracting action items from meeting transcripts
 * with enhanced context from previous action item extractions and patterns
 */
@Injectable()
export class RagActionItemAgent extends RagEnhancedAgent {
  protected readonly logger = new Logger(RagActionItemAgent.name);

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: RagService,
    @Inject(RAG_ACTION_ITEM_CONFIG) config: RagActionItemConfig,
  ) {
    // Configure RAG options for action item extraction
    const ragConfig = config.ragOptions || {
      includeRetrievedContext: true,
      retrievalOptions: {
        indexName: "meeting-analysis",
        namespace: "action-items",
        topK: 5,
        minScore: 0.7,
      },
    };

    super(llmService, stateService, ragService, {
      name: config.name || "Action Item Extraction Agent",
      systemPrompt: EXTRACT_ACTION_ITEMS_PROMPT,
      llmOptions: config.llmOptions,
      ragOptions: ragConfig,
    });

    // Override expertisePrompts with action item specific prompts
    (this as any).expertisePrompts = {
      [AgentExpertise.ACTION_ITEM_EXTRACTION]: EXTRACT_ACTION_ITEMS_PROMPT,
    };
  }

  /**
   * Extract query from state for RAG retrieval
   */
  protected extractQueryFromState(state: any): string {
    if (state.transcript) {
      return `Action item extraction for meeting: ${state.transcript.substring(0, 100)}...`;
    }
    return "Action item extraction";
  }

  /**
   * Extract action items from a meeting transcript with RAG enhancement
   */
  async extractActionItems(
    transcript: string,
    options: {
      meetingId?: string;
      retrievalOptions?: {
        topK?: number;
        minScore?: number;
      };
    } = {},
  ): Promise<ActionItem[]> {
    try {
      this.logger.log("Starting RAG-enhanced action item extraction");

      // Create state for this request
      const state = {
        transcript,
        meetingId: options?.meetingId || `action-item-${Date.now()}`,
        sessionId: options?.meetingId || `action-item-session-${Date.now()}`,
      };

      this.logger.log("Enhancing state with RAG context for query:", this.extractQueryFromState(state));

      // Enhance with RAG context using similar action item extractions
      const query = this.extractQueryFromState(state);

      // Prepare retrieval options
      const retrievalOptions = {
        indexName: "meeting-analysis",
        namespace: "action-items",
        topK: options.retrievalOptions?.topK || 5,
        minScore: options.retrievalOptions?.minScore || 0.7,
      };

      const enhancedState = await this.ragService.enhanceStateWithContext(
        state,
        query,
        retrievalOptions,
      );

      this.logger.log("Starting action item extraction with enhanced context");

      // Execute the LLM request with enhanced context
      const result = await this.executeWithRagContext(enhancedState, transcript);

      this.logger.log("Action item extraction LLM request completed");

      // Process and validate the result
      const actionItems = this.processActionItemResult(result);

      this.logger.log(`Action item extraction completed - Found ${actionItems.length} action items`);

      if (actionItems.length > 0) {
        this.logger.log(`Final action items:`, JSON.stringify(actionItems, null, 2));
      }

      return actionItems;
    } catch (error) {
      this.logger.error(`Error in RAG-enhanced action item extraction: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Execute LLM request with RAG context
   */
  private async executeWithRagContext(enhancedState: any, transcript: string): Promise<any> {
    // Build contextual prompt
    let contextualPrompt = this.systemPrompt;

    if (enhancedState.retrievedContext && enhancedState.retrievedContext.length > 0) {
      const contextSection = `

### CONTEXTUAL EXAMPLES FROM PREVIOUS MEETINGS:

The following are examples of action items extracted from similar meetings:

${enhancedState.retrievedContext
  .map(
    (context: any, index: number) => `
Example ${index + 1}:
${context.content || context.text || "No content available"}
---`,
  )
  .join("\n")}

Use these examples as guidance for identifying similar patterns in the current transcript.

`;
      contextualPrompt += contextSection;
    }

    contextualPrompt += `

### CURRENT MEETING TRANSCRIPT TO ANALYZE:

${transcript}

### INSTRUCTIONS:
Extract action items following the format and criteria specified above. Focus on explicit commitments, assignments, and tasks with clear ownership.`;

    // Execute LLM request
    const model = this.getChatModel();
    const messages = [
      new SystemMessage(contextualPrompt),
      new HumanMessage(`Please extract action items from the provided transcript.`),
    ];

    const response = await model.invoke(messages);
    return response.content;
  }


  /**
   * Process and validate action item extraction result
   */
  private processActionItemResult(result: any): ActionItem[] {
    this.logger.debug("Processing action item result from LLM");
    this.logger.debug(`Result type: ${typeof result}, preview: ${JSON.stringify(result).substring(0, 100)}...`);

    try {
      let actionItems: any[] = [];

      if (typeof result === "string") {
        this.logger.debug("Result is string, cleaning and parsing");
        const cleanedResult = this.cleanJsonString(result);
        this.logger.debug("Successfully parsed cleaned JSON string");
        actionItems = JSON.parse(cleanedResult);
      } else if (Array.isArray(result)) {
        this.logger.debug("Result is array, using directly");
        actionItems = result;
      } else if (result && typeof result === "object") {
        this.logger.debug("Result is object, wrapping in array");
        actionItems = [result];
      } else {
        this.logger.warn("Unexpected result type, returning empty array");
        return [];
      }

      // Validate and transform action items
      if (Array.isArray(actionItems)) {
        this.logger.debug("Result is array, validating action items");
        const validActionItems = actionItems
          .filter((item) => this.isValidActionItem(item))
          .map((item) => this.normalizeActionItem(item));

        this.logger.debug(`Validated ${validActionItems.length} action items out of ${actionItems.length}`);
        return validActionItems;
      } else {
        this.logger.warn("Parsed result is not an array");
        return [];
      }
    } catch (error) {
      this.logger.error(`Failed to process action item result: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean JSON string from LLM response
   */
  private cleanJsonString(jsonString: string): string {
    // Remove markdown code blocks
    let cleaned = jsonString.replace(/```json\s*\n?/g, "").replace(/```\s*\n?/g, "");
    
    // Remove any leading/trailing text that's not JSON
    const arrayMatch = cleaned.match(/(\[[\s\S]*\])/);
    if (arrayMatch) {
      cleaned = arrayMatch[1];
    }

    return cleaned.trim();
  }

  /**
   * Validate if an item is a valid action item
   */
  private isValidActionItem(item: any): boolean {
    return (
      item &&
      typeof item === "object" &&
      typeof item.description === "string" &&
      item.description.trim().length > 0 &&
      typeof item.assignee === "string" &&
      item.assignee.trim().length > 0
    );
  }

  /**
   * Normalize action item to standard format
   */
  private normalizeActionItem(item: any): ActionItem {
    return {
      description: item.description?.trim() || "No description",
      assignee: item.assignee?.trim() || "Unassigned",
      deadline: item.deadline?.trim() || undefined,
      status: this.normalizeStatus(item.status) || "pending",
      priority: this.normalizePriority(item.priority),
      context: item.context?.trim() || undefined,
      confidence: typeof item.confidence === "number" ? item.confidence : undefined,
    };
  }

  /**
   * Normalize status to valid values
   */
  private normalizeStatus(status: any): "pending" | "in_progress" | "completed" {
    if (typeof status === "string") {
      const normalized = status.toLowerCase().trim();
      if (["pending", "in_progress", "completed"].includes(normalized)) {
        return normalized as "pending" | "in_progress" | "completed";
      }
    }
    return "pending";
  }

  /**
   * Normalize priority to valid values
   */
  private normalizePriority(priority: any): "low" | "medium" | "high" | undefined {
    if (typeof priority === "string") {
      const normalized = priority.toLowerCase().trim();
      if (["low", "medium", "high"].includes(normalized)) {
        return normalized as "low" | "medium" | "high";
      }
    }
    return undefined;
  }

  /**
   * Process a state object for action item extraction
   */
  async processState(state: any): Promise<any> {
    this.logger.debug("Processing state for RAG-enhanced action item extraction");

    if (!state.transcript) {
      this.logger.warn("No transcript found in state");
      return state;
    }

    const actionItems = await this.extractActionItems(state.transcript, {
      meetingId: state.meetingId,
      retrievalOptions: {
        topK: 5,
        minScore: 0.7,
      },
    });

    return {
      ...state,
      actionItems,
    };
  }
}
