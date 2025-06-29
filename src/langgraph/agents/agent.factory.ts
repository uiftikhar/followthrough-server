import { Injectable } from "@nestjs/common";
import { LlmService } from "../llm/llm.service";
import { BaseAgent, AgentConfig } from "./base-agent";
import { MasterSupervisorAgent } from "./master-supervisor.agent";

/**
 * Factory for creating shared/core agents
 * Domain-specific agents (calendar, email, meeting analysis) are handled by their own factories:
 * - MeetingAnalysisAgentFactory for meeting analysis agents (topic extraction, action items, sentiment, summary, etc.)
 * - CalendarAgentFactory for calendar agents (meeting context, brief, follow-up orchestration)
 * - EmailAgentFactory for email agents (classification, summarization, reply drafts, etc.)
 */
@Injectable()
export class AgentFactory {
  constructor(
    private readonly llmService: LlmService,
    // Only truly shared agents
    private readonly masterSupervisorAgent: MasterSupervisorAgent,
  ) {}

  /**
   * Create a base agent instance with custom configuration
   */
  createBaseAgent(config: AgentConfig): BaseAgent {
    return new BaseAgent(this.llmService, config);
  }

  /**
   * Get the master supervisor agent - the main coordination agent
   */
  getMasterSupervisorAgent(): MasterSupervisorAgent {
    return this.masterSupervisorAgent;
  }

  /**
   * MIGRATION NOTE:
   *
   * All domain-specific agent methods have been moved to their respective factories:
   *
   * Meeting Analysis Agents:
   * - Use MeetingAnalysisAgentFactory.getTopicExtractionAgent()
   * - Use MeetingAnalysisAgentFactory.getActionItemAgent()
   * - Use MeetingAnalysisAgentFactory.getSentimentAnalysisAgent()
   * - Use MeetingAnalysisAgentFactory.getSummaryAgent()
   * - Use MeetingAnalysisAgentFactory.getParticipationAgent()
   * - Use MeetingAnalysisAgentFactory.getContextIntegrationAgent()
   *
   * Email Agents:
   * - Use EmailAgentFactory.getEmailClassificationAgent()
   * - Use EmailAgentFactory.getEmailSummarizationAgent()
   * - Use EmailAgentFactory.getEmailReplyDraftAgent()
   *
   * Calendar Agents:
   * - Use CalendarAgentFactory.getMeetingContextAgent()
   * - Use CalendarAgentFactory.getMeetingBriefAgent()
   *
   * RAG-Enhanced Agents:
   * - Use MeetingAnalysisAgentFactory.getRagTopicExtractionAgent()
   * - Use EmailAgentFactory.getRagEmailReplyDraftAgent()
   *
   * This ensures:
   * 1. No duplication between factory creation methods and specialized agents
   * 2. Proper use of sophisticated agents with specialized logic
   * 3. Clean domain separation
   * 4. No circular dependencies
   */
}
