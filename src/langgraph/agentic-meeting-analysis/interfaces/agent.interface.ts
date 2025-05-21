/**
 * Agent interface for meeting analysis
 *
 * Defines agent expertise types and common interfaces for meeting analysis agents.
 */

export enum AgentExpertise {
  TOPIC_ANALYSIS = 'topic_analysis',
  ACTION_ITEM_EXTRACTION = 'action_item_extraction',
  DECISION_TRACKING = 'decision_tracking',
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  PARTICIPANT_DYNAMICS = 'participant_dynamics',
  SUMMARY_GENERATION = 'summary_generation',
  CONTEXT_INTEGRATION = 'context_integration',
  COORDINATION = 'coordination',
  MANAGEMENT = 'management',
}

export interface MeetingAnalysisAgentConfig {
  id?: string;
  name?: string;
  systemPrompt?: string;
  expertise?: AgentExpertise[];
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Interface for a meeting analysis agent
 */
export interface IMeetingAnalysisAgent {
  /**
   * Identifies what tasks the agent can perform
   */
  getExpertise(): AgentExpertise[];

  /**
   * Process a state object and return the enhanced state
   */
  processState(state: any): Promise<any>;

  /**
   * Analyze a specific part of a meeting
   */
  analyze(transcript: string, options?: Record<string, any>): Promise<any>;
}
