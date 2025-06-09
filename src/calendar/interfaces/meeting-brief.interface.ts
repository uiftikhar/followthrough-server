export interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  duration: number; // minutes
  priority: 'high' | 'medium' | 'low';
  presenter?: string;
  materials?: Array<{
    title: string;
    type: 'document' | 'presentation' | 'reference' | 'previous_meeting';
    url?: string;
    description: string;
  }>;
  preparationRequired?: string[];
  expectedOutcomes: string[];
  relatedTopics: string[];
}

export interface ParticipantPreparation {
  participantEmail: string;
  participantName: string;
  role: 'organizer' | 'presenter' | 'attendee' | 'optional';
  preparationTasks: Array<{
    task: string;
    priority: 'high' | 'medium' | 'low';
    estimatedTime: number; // minutes
    dueBy?: string; // ISO date string
    materials?: string[];
  }>;
  relevantHistory: Array<{
    meetingId: string;
    meetingTitle: string;
    date: string;
    relevantOutcomes: string[];
    actionItemsFromMeeting: string[];
  }>;
  suggestedQuestions: string[];
  keyResponsibilities: string[];
  expertiseAreas: string[];
}

export interface MeetingObjectives {
  primary: string;
  secondary: string[];
  successMetrics: Array<{
    metric: string;
    measurement: string;
    target?: string;
  }>;
  expectedDecisions: string[];
  potentialRisks: Array<{
    risk: string;
    impact: 'high' | 'medium' | 'low';
    mitigation: string;
  }>;
}

export interface TimeManagement {
  totalDuration: number; // minutes
  suggestedSchedule: Array<{
    startTime: string; // relative time like "+0", "+15", "+30"
    endTime: string;
    activity: string;
    agendaItemId?: string;
    buffer: boolean; // if this is a buffer/break time
  }>;
  criticalTimings: Array<{
    item: string;
    importance: string;
    timeAllocation: number;
  }>;
  fallbackPlan?: {
    shortenedVersion: AgendaItem[];
    essentialOnly: AgendaItem[];
  };
}

export interface MeetingBrief {
  meetingId: string;
  briefId: string;
  meetingDetails: {
    title: string;
    startTime: string;
    endTime: string;
    location?: string;
    meetingLink?: string;
    organizer: string;
    participants: string[];
    description?: string;
  };
  executiveSummary: {
    purpose: string;
    keyOutcomes: string[];
    preparation: string;
    duration: number;
    complexity: 'low' | 'medium' | 'high';
  };
  objectives: MeetingObjectives;
  enhancedAgenda: AgendaItem[];
  participantPreparations: ParticipantPreparation[];
  timeManagement: TimeManagement;
  contextualInsights: {
    relevantHistory: string[];
    ongoingProjects: string[];
    stakeholderInterests: Array<{
      stakeholder: string;
      interests: string[];
      concerns: string[];
    }>;
    decisionDependencies: string[];
  };
  recommendations: Array<{
    category: 'preparation' | 'agenda' | 'facilitation' | 'follow_up';
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    rationale: string;
    implementationTime: number; // minutes
  }>;
  deliveryOptions: {
    email: {
      subject: string;
      body: string;
      attachments?: string[];
    };
    slack: {
      channel?: string;
      message: string;
      threadMessage?: string;
    };
    calendar: {
      description: string;
      agendaUpdate: string;
    };
  };
  generationMetadata: {
    generatedAt: string;
    baseContext: {
      previousMeetings: number;
      participantHistories: number;
      topicPredictions: number;
    };
    confidence: number; // 0-1
    ragEnhanced: boolean;
    customizations: string[];
  };
}

export interface BriefGenerationOptions {
  includeDetailedAgenda?: boolean; // Enhance the existing agenda (default: true)
  includeParticipantPrep?: boolean; // Generate participant-specific preparation (default: true)
  includeTimeManagement?: boolean; // Add time management suggestions (default: true)
  includeDeliveryFormats?: boolean; // Generate delivery formats (default: true)
  customizeForOrganizer?: boolean; // Customize brief for meeting organizer (default: true)
  complexity?: 'basic' | 'standard' | 'comprehensive'; // Brief complexity level (default: standard)
  focusAreas?: Array<'agenda' | 'preparation' | 'objectives' | 'context' | 'logistics'>; // Areas to emphasize
  deliveryFormat?: Array<'email' | 'slack' | 'calendar' | 'dashboard'>; // Preferred delivery methods
  useRAG?: boolean; // Use RAG for enhanced context (default: true)
  maxBriefLength?: number; // Maximum length in words (default: 2000)
  prioritizeActionItems?: boolean; // Focus on action items and decisions (default: true)
}

export interface BriefDeliveryResult {
  briefId: string;
  deliveryMethod: 'email' | 'slack' | 'calendar' | 'dashboard';
  status: 'sent' | 'scheduled' | 'failed';
  deliveredAt?: string;
  recipients: string[];
  deliveryDetails: {
    messageId?: string;
    threadId?: string;
    eventId?: string;
    errorMessage?: string;
  };
  readReceipts?: Array<{
    recipient: string;
    readAt: string;
    engaged: boolean; // clicked links, opened attachments, etc.
  }>;
}

export interface BriefTemplate {
  id: string;
  name: string;
  description: string;
  applicableFor: Array<'recurring' | 'one_time' | 'project_review' | 'standup' | 'planning' | 'retrospective'>;
  agendaStructure: Array<{
    section: string;
    defaultDuration: number;
    required: boolean;
    suggestions: string[];
  }>;
  preparationGuidelines: Array<{
    role: 'organizer' | 'presenter' | 'attendee';
    tasks: string[];
    timeRequirement: number;
  }>;
  customPrompts: {
    objectiveGeneration: string;
    agendaEnhancement: string;
    preparationSuggestions: string;
  };
} 