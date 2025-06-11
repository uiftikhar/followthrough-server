import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// Base workflow state that all workflows inherit from
export const BaseWorkflowState = {
  // Message history for agent communication
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),

  // Session and tracking
  sessionId: Annotation<string>({
    reducer: (existing, update) => update ?? existing,
    default: () => `session-${Date.now()}`,
  }),

  // Input data
  input: Annotation<any>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),

  // Processing stage
  stage: Annotation<string>({
    reducer: (existing, update) => update ?? existing,
    default: () => "initialization",
  }),

  // Results accumulator
  results: Annotation<Record<string, any>>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),

  // Error handling
  error: Annotation<string | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),

  // Metadata
  metadata: Annotation<Record<string, any>>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),
};

// Meeting-specific state extension
export const MeetingAnalysisState = {
  ...BaseWorkflowState,

  // Meeting-specific data
  transcript: Annotation<string>({
    reducer: (existing, update) => update ?? existing,
    default: () => "",
  }),

  meetingMetadata: Annotation<{
    title?: string;
    participants?: string[];
    duration?: number;
    date?: string;
  }>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),

  // Analysis results
  topics: Annotation<
    Array<{
      name: string;
      relevance: number;
      keyPoints: string[];
    }>
  >({
    reducer: (existing, update) => update ?? existing,
    default: () => [],
  }),

  actionItems: Annotation<
    Array<{
      description: string;
      assignee?: string;
      dueDate?: string;
      priority: "high" | "medium" | "low";
    }>
  >({
    reducer: (existing, update) => update ?? existing,
    default: () => [],
  }),

  summary: Annotation<{
    brief: string;
    keyDecisions: string[];
    nextSteps: string[];
  } | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),

  sentiment: Annotation<{
    overall: "positive" | "neutral" | "negative";
    confidence: number;
    details: string[];
  } | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),
};

// Email-specific state extension
export const EmailTriageState = {
  ...BaseWorkflowState,

  emailData: Annotation<{
    id: string;
    from: string;
    to: string[];
    subject: string;
    body: string;
    receivedAt: string;
    attachments?: Array<{ name: string; size: number }>;
  }>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({
      id: "",
      from: "",
      to: [],
      subject: "",
      body: "",
      receivedAt: "",
    }),
  }),

  classification: Annotation<{
    category: string;
    priority: "critical" | "high" | "medium" | "low";
    confidence: number;
    requiresReply: boolean;
  } | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),

  replyDraft: Annotation<{
    subject: string;
    body: string;
    tone: "formal" | "casual" | "professional";
    confidence: number;
  } | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),
};

// Calendar Workflow State
const CalendarWorkflowStateAnnotation = Annotation.Root({
  // Core identifiers
  sessionId: Annotation<string>(),
  userId: Annotation<string>(),
  eventId: Annotation<string>(),
  
  // Event data
  eventData: Annotation<{
    id: string;
    title: string;
    description?: string;
    start: {
      dateTime: string;
      timeZone: string;
    };
    end: {
      dateTime: string;
      timeZone: string;
    };
    attendees?: Array<{
      email: string;
      name?: string;
      responseStatus?: string;
    }>;
    location?: string;
    metadata?: Record<string, any>;
  }>(),

  // Analysis results
  meetingBrief: Annotation<{
    agenda: string[];
    keyTopics: string[];
    attendeeProfiles: Array<{
      email: string;
      role?: string;
      previousInteractions?: number;
    }>;
    preparationItems: string[];
    contextSummary: string;
  } | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),

  meetingContext: Annotation<{
    relatedEvents: Array<{
      id: string;
      title: string;
      relationship: string;
    }>;
    relevantDocuments: string[];
    historicalContext: string;
    organizationalContext: string;
  } | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),

  followUpPlan: Annotation<{
    immediateActions: Array<{
      action: string;
      assignee?: string;
      dueDate?: string;
    }>;
    scheduledFollowUps: Array<{
      type: string;
      scheduledFor: string;
      participants: string[];
    }>;
    documentationTasks: string[];
  } | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),

  // Workflow control
  stage: Annotation<string>({
    reducer: (existing, update) => update ?? existing,
    default: () => "initialized",
  }),
  currentStep: Annotation<string>({
    reducer: (existing, update) => update ?? existing,
    default: () => "start",
  }),
  progress: Annotation<number>({
    reducer: (existing, update) => Math.max(existing, update),
    default: () => 0,
  }),
  error: Annotation<string | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),
  
  // Context and metadata
  context: Annotation<Record<string, any>>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),
  metadata: Annotation<Record<string, any>>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),
  processingMetadata: Annotation<{
    agentsUsed: string[];
    performanceMetrics: Record<string, number>;
    startTime: string;
    endTime?: string;
  }>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({
      agentsUsed: [],
      performanceMetrics: {},
      startTime: new Date().toISOString(),
    }),
  }),
  
  // Workflow configuration
  workflowType: Annotation<"pre_meeting" | "post_meeting" | "context_analysis">({
    reducer: (existing, update) => update ?? existing,
    default: () => "pre_meeting",
  }),
  automationLevel: Annotation<"manual" | "semi_automated" | "fully_automated">({
    reducer: (existing, update) => update ?? existing,
    default: () => "semi_automated",
  }),
});

export type CalendarWorkflowState = typeof CalendarWorkflowStateAnnotation.State;
export type CalendarWorkflowStateType = typeof CalendarWorkflowStateAnnotation;
export { CalendarWorkflowStateAnnotation };

// Master supervisor state for routing between teams
export const SupervisorState = {
  // Input to the supervisor
  input: Annotation<any>({
    reducer: (existing, update) => ({ ...existing, ...update }),
    default: () => ({}),
  }),

  // Routing decision
  routing: Annotation<{
    team: string;
    confidence: number;
    reasoning?: string;
  } | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),

  // Results from the delegated team
  result: Annotation<any>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),

  // Session tracking
  sessionId: Annotation<string>({
    reducer: (existing, update) => update ?? existing,
    default: () => `supervisor-${Date.now()}`,
  }),

  // Error tracking
  error: Annotation<string | null>({
    reducer: (existing, update) => update ?? existing,
    default: () => null,
  }),
};

// Type helpers for working with state
export type BaseWorkflowStateType = typeof BaseWorkflowState;
export type MeetingAnalysisStateType = typeof MeetingAnalysisState;
export type EmailTriageStateType = typeof EmailTriageState;
export type SupervisorStateType = typeof SupervisorState;
