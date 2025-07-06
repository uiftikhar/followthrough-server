import { CalendarEvent } from "../../../calendar/interfaces/calendar-event.interface";
import { MeetingBrief } from "../../../calendar/interfaces/meeting-brief.interface";
import { MeetingContext } from "../../../calendar/interfaces/meeting-context.interface";

// Import types from other workflows for integration
export interface MeetingAnalysisResult {
  meetingId: string;
  meetingTitle: string;
  participants: string[];
  actionItems: ActionItem[];
  decisions: Decision[];
  summary: MeetingSummary;
  topics: Topic[];
  nextSteps: string[];
  followUpRequired: boolean;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "completed";
  context: string;
  relatedMeetingId: string;
  dependencies?: string[];
  estimatedHours?: number;
}

export interface Decision {
  id: string;
  description: string;
  decisionMaker: string;
  rationale: string;
  status: "proposed" | "decided" | "implemented" | "reversed";
  implementationDate?: string;
  relatedDecisions: string[];
  tags: string[];
  impact: "high" | "medium" | "low";
}

export interface MeetingSummary {
  meetingTitle: string;
  summary: string;
  keyDecisions: string[];
  participants: string[];
  duration?: string;
  nextSteps?: string[];
}

export interface Topic {
  name: string;
  relevance: number;
  keyPoints: string[];
  participants: string[];
}

export interface FollowUpPlan {
  planId: string;
  meetingId: string;
  createdAt: string;
  emailFollowUps: EmailFollowUp[];
  meetingFollowUps: MeetingFollowUp[];
  taskFollowUps: TaskFollowUp[];
  routingDecisions: RoutingDecision[];
  orchestrationMetadata: {
    totalActions: number;
    estimatedCompletionTime: number;
    requiresApproval: boolean;
    autonomyLevel: "manual" | "assisted" | "automated";
  };
}

export interface EmailFollowUp {
  id: string;
  type: "action_item_notification" | "meeting_summary" | "decision_announcement" | "follow_up_request";
  priority: "urgent" | "high" | "medium" | "low";
  recipients: string[];
  subject: string;
  content: string;
  scheduledDelivery?: string;
  attachments?: string[];
  trackingRequired: boolean;
  relatedActionItems: string[];
}

export interface MeetingFollowUp {
  id: string;
  type: "follow_up_meeting" | "decision_review" | "status_check" | "planning_session";
  title: string;
  participants: string[];
  suggestedDuration: number;
  suggestedTimeframe: string;
  agenda: string[];
  relatedDecisions: string[];
  relatedActionItems: string[];
  priority: "high" | "medium" | "low";
}

export interface TaskFollowUp {
  id: string;
  actionItemId: string;
  assignee: string;
  title: string;
  description: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  dependencies: string[];
  subtasks?: SubTask[];
  estimatedHours?: number;
  projectId?: string;
  tags: string[];
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
}

export interface RoutingDecision {
  id: string;
  type: "email_triage" | "meeting_analysis" | "task_management" | "calendar_scheduling";
  target: string;
  payload: any;
  priority: number;
  scheduledAt?: string;
  dependencies: string[];
  status: "pending" | "routed" | "completed" | "failed";
}

export interface PreMeetingContext {
  contextId: string;
  meetingId: string;
  participantAnalysis: ParticipantAnalysis[];
  historicalContext: HistoricalMeetingContext[];
  topicPredictions: TopicPrediction[];
  riskAssessment: RiskAssessment;
  preparationRecommendations: PreparationRecommendation[];
  confidence: number;
}

export interface ParticipantAnalysis {
  email: string;
  displayName: string;
  role: "organizer" | "presenter" | "attendee" | "optional";
  meetingHistory: MeetingHistoryEntry[];
  behaviorPatterns: BehaviorPattern[];
  expertiseAreas: string[];
  preferredMeetingStyles: string[];
  preparednessScore: number;
}

export interface MeetingHistoryEntry {
  meetingId: string;
  title: string;
  date: string;
  role: string;
  participation: "high" | "medium" | "low";
  outcomes: string[];
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  context: string[];
  confidence: number;
}

export interface HistoricalMeetingContext {
  meetingId: string;
  title: string;
  date: string;
  relevanceScore: number;
  sharedParticipants: string[];
  sharedTopics: string[];
  outcomes: string[];
  lessonsLearned: string[];
}

export interface TopicPrediction {
  topic: string;
  confidence: number;
  reasoning: string;
  expectedDuration: number;
  requiredPreparation: string[];
  potentialChallenges: string[];
}

export interface RiskAssessment {
  overallRisk: "low" | "medium" | "high";
  identifiedRisks: Risk[];
  mitigationStrategies: MitigationStrategy[];
}

export interface Risk {
  type: string;
  description: string;
  impact: "low" | "medium" | "high";
  probability: number;
  mitigation: string;
}

export interface MitigationStrategy {
  riskType: string;
  strategy: string;
  implementationTime: number;
  effectiveness: number;
}

export interface PreparationRecommendation {
  type: "agenda" | "materials" | "logistics" | "participants";
  priority: "high" | "medium" | "low";
  recommendation: string;
  timeRequired: number;
  responsibility: string;
}

export interface MeetingRecording {
  recordingId: string;
  meetingId: string;
  url: string;
  duration: number;
  transcriptAvailable: boolean;
  participants: string[];
  recordingStart: string;
  recordingEnd: string;
  fileSize: number;
  format: string;
}

// Main state interface
export interface CalendarWorkflowState {
  sessionId: string;
  userId: string;
  eventId: string;
  
  // Event data
  calendarEvent: CalendarEvent;
  meetingStatus: 'scheduled' | 'started' | 'ended';
  
  // Analysis results
  preContext: PreMeetingContext | null;
  meetingBrief: MeetingBrief | null;
  meetingTranscript: string | null; // From real meeting
  meetingRecording: MeetingRecording | null;
  analysisResult: MeetingAnalysisResult | null;
  followUpPlan: FollowUpPlan | null;
  
  // Workflow control
  stage: string;
  currentStep: string;
  progress: number;
  error: string | null;
  
  // Context and metadata
  context: Record<string, any>;
  metadata: Record<string, any>;
  processingMetadata: {
    agentsUsed: string[];
    ragEnhanced: boolean;
    performanceMetrics: Record<string, number>;
    startTime: string;
    endTime?: string;
  };
  
  // Workflow-specific state
  briefDeliveryStatus?: {
    delivered: boolean;
    deliveryMethods: string[];
    deliveryTime?: string;
    recipients: string[];
  };
  
  followUpStatus?: {
    emailsGenerated: number;
    meetingsScheduled: number;
    tasksCreated: number;
    routingComplete: boolean;
  };
  
  autonomyLevel?: "manual" | "assisted" | "automated";
  approvalRequired?: boolean;
  userInteractions?: UserInteraction[];
}

export interface UserInteraction {
  timestamp: string;
  type: "approval" | "modification" | "cancellation" | "feedback";
  details: Record<string, any>;
  result: "approved" | "rejected" | "modified";
}

// Workflow step definitions
export enum CalendarWorkflowStage {
  INITIALIZED = "initialized",
  PRE_MEETING_CONTEXT = "pre_meeting_context",
  BRIEF_GENERATION = "brief_generation", 
  BRIEF_DELIVERY = "brief_delivery",
  MEETING_MONITORING = "meeting_monitoring",
  POST_MEETING_ANALYSIS = "post_meeting_analysis",
  FOLLOW_UP_ORCHESTRATION = "follow_up_orchestration",
  COMPLETED = "completed",
  ERROR = "error"
}

export enum CalendarWorkflowStep {
  // Pre-meeting steps
  START = "start",
  GATHER_CONTEXT = "gather_context",
  ANALYZE_PARTICIPANTS = "analyze_participants",
  PREDICT_TOPICS = "predict_topics",
  ASSESS_RISKS = "assess_risks",
  GENERATE_BRIEF = "generate_brief",
  DELIVER_BRIEF = "deliver_brief",
  
  // Meeting monitoring steps
  MONITOR_MEETING_START = "monitor_meeting_start",
  TRACK_MEETING_PROGRESS = "track_meeting_progress",
  DETECT_MEETING_END = "detect_meeting_end",
  
  // Post-meeting steps
  EXTRACT_RECORDING = "extract_recording",
  TRIGGER_ANALYSIS = "trigger_analysis",
  PROCESS_ANALYSIS_RESULTS = "process_analysis_results",
  GENERATE_FOLLOW_UP_PLAN = "generate_follow_up_plan",
  ROUTE_FOLLOW_UP_ACTIONS = "route_follow_up_actions",
  
  // Completion
  FINALIZE = "finalize",
  END = "end"
}

// Options for workflow configuration
export interface CalendarWorkflowOptions {
  useRAG?: boolean;
  generateBrief?: boolean;
  deliverBrief?: boolean;
  deliveryMethods?: string[];
  monitorMeeting?: boolean;
  processPostMeeting?: boolean;
  generateFollowUps?: boolean;
  autonomyLevel?: "manual" | "assisted" | "automated";
  maxWaitTimeMinutes?: number;
  retryAttempts?: number;
  webhookTimeout?: number;
}

// Event types for inter-workflow communication
export interface CalendarWorkflowEvents {
  'calendar.meeting.created': { sessionId: string; eventId: string; calendarEvent: CalendarEvent };
  'calendar.meeting.started': { sessionId: string; eventId: string };
  'calendar.meeting.ended': { sessionId: string; eventId: string; recordingData?: MeetingRecording };
  'calendar.brief.generated': { sessionId: string; brief: MeetingBrief };
  'calendar.brief.delivered': { sessionId: string; deliveryStatus: any };
  'calendar.analysis.triggered': { sessionId: string; transcript: string };
  'calendar.analysis.completed': { sessionId: string; result: MeetingAnalysisResult };
  'calendar.followup.generated': { sessionId: string; plan: FollowUpPlan };
  'calendar.workflow.completed': { sessionId: string; finalState: CalendarWorkflowState };
  'calendar.workflow.error': { sessionId: string; error: string; stage: string };
} 