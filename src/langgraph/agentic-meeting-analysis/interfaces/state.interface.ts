/**
 * State interface for meeting analysis
 *
 * Defines the structure of the state for meeting analysis.
 */

/**
 * Represents a meeting transcript with segments and metadata
 */
export interface MeetingTranscript {
  id?: string;
  meetingId?: string;
  segments: Array<{
    id: string;
    speakerId: string;
    speakerName?: string;
    startTime: number;
    endTime: number;
    content: string;
    confidence?: number;
  }>;
  metadata?: {
    title?: string;
    date?: string;
    duration?: number;
    participants?: Array<{
      id: string;
      name: string;
      role?: string;
    }>;
    location?: string;
    format?: 'in-person' | 'virtual' | 'hybrid';
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * Represents a topic discussed in the meeting
 */
export interface Topic {
  name: string;
  description?: string;
  relevance?: number;
  subtopics?: string[];
  duration?: number;
  participants?: string[];
  keywords?: string[];
}

/**
 * Represents an action item from the meeting
 */
export interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'in_progress' | 'completed';
  relatedTopics?: string[];
}

/**
 * Represents a retrieved context from RAG
 */
export interface RetrievedContext {
  query: string;
  documents: Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    score: number;
  }>;
  timestamp: string;
}

/**
 * Full meeting analysis state
 */
export interface MeetingAnalysisState {
  meetingId: string;
  transcript: string | MeetingTranscript;
  topics?: Topic[];
  actionItems?: ActionItem[];
  sentiment?: {
    overall: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    segments?: Array<{
      text: string;
      sentiment: string;
      score: number;
    }>;
  };
  summary?: {
    brief: string;
    detailed?: string;
    keyPoints?: string[];
    decisions?: string[];
  };
  participants?: Array<{
    name: string;
    speakingTime?: number;
    contributions?: number;
    sentiment?: string;
  }>;
  retrievedContext?: RetrievedContext;
  errors?: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  currentStep?: string;
  completedSteps?: string[];
}
