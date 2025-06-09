export interface ParticipantHistory {
  email: string;
  displayName: string;
  totalMeetings: number;
  recentMeetings: Array<{
    id: string;
    title: string;
    date: string;
    duration: number;
    role: 'organizer' | 'attendee';
  }>;
  commonTopics: string[];
  preferredMeetingTimes: Array<{
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startHour: number; // 0-23
    endHour: number;
  }>;
  responsePatterns: {
    averageResponseTime: number; // minutes
    acceptanceRate: number; // 0-1
    lastInteraction: string;
  };
  meetingBehavior: {
    punctuality: 'early' | 'ontime' | 'late' | 'unknown';
    participation: 'high' | 'medium' | 'low' | 'unknown';
    preparedness: 'well-prepared' | 'average' | 'unprepared' | 'unknown';
  };
}

export interface PreviousMeetingContext {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  summary?: string;
  actionItems?: Array<{
    task: string;
    assignee: string;
    status: 'open' | 'in_progress' | 'completed';
    dueDate?: string;
  }>;
  topics: string[];
  decisions: string[];
  nextSteps: string[];
  relatedMeetings: string[];
  relevanceScore: number; // 0-1
}

export interface TopicPrediction {
  topic: string;
  confidence: number; // 0-1
  reasoning: string;
  basedOn: Array<{
    type: 'participant_history' | 'meeting_pattern' | 'agenda_keywords' | 'project_context';
    source: string;
    relevance: number;
  }>;
  suggestedMaterials?: Array<{
    title: string;
    type: 'document' | 'previous_meeting' | 'reference';
    url?: string;
    description: string;
  }>;
}

export interface MeetingContext {
  meetingId: string;
  upcomingMeeting: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
    participants: string[];
    organizer: string;
    location?: string;
    meetingLink?: string;
  };
  participantHistories: ParticipantHistory[];
  previousMeetingContext: PreviousMeetingContext[];
  topicPredictions: TopicPrediction[];
  contextSummary: {
    totalRelevantMeetings: number;
    keyParticipants: string[];
    primaryTopics: string[];
    ongoingActionItems: number;
    meetingFrequency: {
      similar: number; // meetings per month with similar participants/topics
      withOrganizer: number;
      withParticipants: number;
    };
  };
  recommendations: Array<{
    type: 'preparation' | 'agenda' | 'follow_up' | 'scheduling';
    priority: 'high' | 'medium' | 'low';
    message: string;
    actionable: boolean;
  }>;
  retrievalMetadata: {
    retrievedAt: string;
    sources: string[];
    ragEnhanced: boolean;
    confidence: number;
  };
}

export interface MeetingContextOptions {
  lookbackDays?: number; // How far back to look for context (default: 90)
  maxPreviousMeetings?: number; // Max previous meetings to include (default: 10)
  minRelevanceScore?: number; // Minimum relevance for inclusion (default: 0.3)
  includeParticipantHistory?: boolean; // Include detailed participant history (default: true)
  includeTopicPredictions?: boolean; // Generate topic predictions (default: true)
  includeRecommendations?: boolean; // Generate meeting recommendations (default: true)
  useRAG?: boolean; // Use RAG for enhanced context (default: true)
} 