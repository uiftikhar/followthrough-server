/**
 * Represents the state for meeting analysis
 */
export interface MeetingAnalysisState {
  /**
   * ID of the meeting being analyzed
   */
  meetingId: string;

  /**
   * Transcript of the meeting
   */
  transcript: string;

  /**
   * Extracted topics from the meeting
   */
  topics?: Array<{
    name: string;
    subtopics?: string[];
    participants?: string[];
    relevance?: number;
    duration?: number;
  }>;

  /**
   * Extracted action items from the meeting
   */
  actionItems?: Array<{
    description: string;
    assignee?: string;
    dueDate?: string;
    status?: "pending" | "completed";
  }>;

  /**
   * Sentiment analysis of the meeting
   */
  sentiment?: {
    overall: number;
    segments?: Array<{
      text: string;
      score: number;
    }>;
  };

  /**
   * Summary of the meeting
   */
  summary?: {
    meetingTitle: string;
    summary: string;
    decisions: Array<{
      title: string;
      content: string;
    }>;
    next_steps?: string[];
  };

  /**
   * Additional context or metadata for the meeting
   */
  context?: Record<string, any>;

  /**
   * Additional metadata, including RAG context
   */
  metadata?: Record<string, any>;

  /**
   * Current processing stage
   */
  stage?:
    | "initialization"
    | "topic_extraction"
    | "action_item_extraction"
    | "sentiment_analysis"
    | "summary_generation"
    | "completed";

  /**
   * Error information, if any
   */
  error?: {
    message: string;
    stage: string;
    timestamp: string;
  };
}
