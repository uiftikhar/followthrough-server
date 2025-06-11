import { Injectable, Logger } from "@nestjs/common";
import { StateStorageService } from "../persistence/state-storage.service";
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

/**
 * Supervisor state interface for the master supervisor graph
 */
export interface SupervisorState {
  messages: BaseMessage[];
  input: {
    type?: "meeting" | "email" | "calendar";
    // Meeting fields
    transcript?: string;
    meetingId?: string;
    // Email fields
    emailData?: any;
    from?: string;
    to?: string[];
    subject?: string;
    body?: string;
    // Calendar fields
    calendarEvent?: any;
    eventId?: string;
    // Common fields
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, any>;
  };
  routing?: {
    team: "meeting_analysis" | "email_triage" | "calendar_workflow" | "__end__";
    confidence: number;
    reasoning: string;
    inputType?: string;
    teamMetadata?: Record<string, any>;
  };
  result?: any;
  startTime?: string;
  endTime?: string;
  error?: string;
  errors?: any[];
  metadata?: Record<string, any>;
  sessionId?: string;
  userId?: string;
  progress?: number;
  status?: "pending" | "routing" | "processing" | "completed" | "failed";
}

/**
 * Generic state management service for LangGraph
 */
@Injectable()
export class StateService {
  private readonly logger = new Logger(StateService.name);

  constructor(private readonly stateStorage: StateStorageService) {}

  /**
   * Create an annotation for a base message array
   */
  createMessagesAnnotation() {
    return Annotation<BaseMessage[]>({
      reducer: (x, y) => [...x, ...y],
      default: () => [],
    });
  }

  /**
   * Create a complete state definition for meeting analysis
   */
  createMeetingAnalysisState() {
    return {
      // Core LangGraph fields
      messages: this.createMessagesAnnotation(),

      // Meeting analysis specific fields
      meetingId: this.createStringAnnotation(),
      transcript: this.createStringAnnotation(),
      sessionId: this.createStringAnnotation(),
      userId: this.createStringAnnotation(),

      // Analysis results
      topics: this.createArrayAnnotation(),
      actionItems: this.createArrayAnnotation(),
      sentiment: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
      }),
      summary: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
      }),

      // Workflow control
      stage: this.createStringAnnotation("initialization"),
      currentPhase: this.createStringAnnotation("initialization"),

      // Error handling
      error: this.createStringAnnotation(),
      errors: this.createArrayAnnotation(),

      // Metadata and results
      metadata: this.createRecordAnnotation(),
      results: this.createRecordAnnotation(),

      // Workflow metadata
      startTime: this.createStringAnnotation(),
      useRAG: Annotation<boolean>({
        reducer: (x, y) => y ?? x,
        default: () => false,
      }),
      initialized: Annotation<boolean>({
        reducer: (x, y) => y ?? x,
        default: () => false,
      }),
    };
  }

  /**
   * Create a complete state definition for email triage
   */
  createEmailTriageState() {
    return {
      // Core LangGraph fields
      messages: this.createMessagesAnnotation(),

      // Email triage specific fields
      sessionId: this.createStringAnnotation(),
      userId: this.createStringAnnotation(),

      // Email data
      emailData: Annotation<{
        id: string;
        from: string;
        to: string[];
        subject: string;
        body: string;
        receivedAt: string;
        attachments?: Array<{ name: string; size: number }>;
        metadata?: Record<string, any>;
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

      // Email analysis results
      classification: Annotation<{
        category: string;
        priority: "critical" | "high" | "medium" | "low";
        confidence: number;
        requiresReply: boolean;
        reasoning?: string;
        urgencyIndicators?: string[];
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      summary: Annotation<{
        briefSummary: string;
        keyPoints: string[];
        actionItems?: Array<{
          action: string;
          deadline?: string;
          priority: "high" | "medium" | "low";
        }>;
        sentiment: "positive" | "neutral" | "negative";
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      replyDraft: Annotation<{
        subject: string;
        body: string;
        tone: "formal" | "casual" | "professional" | "friendly";
        confidence: number;
        suggestedActions?: Array<{
          action: "send" | "review" | "customize" | "delay";
          reason: string;
        }>;
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      // Email processing metadata
      senderPatterns: Annotation<{
        communicationStyle?: string;
        preferredTone?: string;
        responseTimeExpectation?: string;
        frequentTopics?: string[];
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      delegationSuggestion: Annotation<{
        recommendedTeam?: string;
        recommendedAgent?: string;
        reasoning?: string;
        confidence?: number;
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      // Workflow control
      stage: this.createStringAnnotation("initialization"),
      currentStep: this.createStringAnnotation("initialization"),
      progress: Annotation<number>({
        reducer: (x, y) => Math.max(x, y),
        default: () => 0,
      }),

      // Error handling
      error: this.createStringAnnotation(),
      errors: this.createArrayAnnotation(),

      // Context and metadata
      context: this.createRecordAnnotation(),
      metadata: this.createRecordAnnotation(),
      results: this.createRecordAnnotation(),

      // Processing metadata
      processingMetadata: Annotation<{
        agentsUsed?: string[];
        performanceMetrics?: Record<string, number>;
        ragEnhanced?: boolean;
      }>({
        reducer: (existing, update) => ({ ...existing, ...update }),
        default: () => ({}),
      }),

      // Workflow metadata
      startTime: this.createStringAnnotation(),
      useRAG: Annotation<boolean>({
        reducer: (x, y) => y ?? x,
        default: () => false,
      }),
      initialized: Annotation<boolean>({
        reducer: (x, y) => y ?? x,
        default: () => false,
      }),
    };
  }

  /**
   * Create a complete state definition for calendar workflow
   */
  createCalendarWorkflowState() {
    return {
      // Core LangGraph fields
      messages: this.createMessagesAnnotation(),

      // Calendar workflow specific fields
      sessionId: this.createStringAnnotation(),
      userId: this.createStringAnnotation(),
      eventId: this.createStringAnnotation(),

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
      }>({
        reducer: (existing, update) => ({ ...existing, ...update }),
        default: () => ({
          id: "",
          title: "",
          start: { dateTime: "", timeZone: "" },
          end: { dateTime: "", timeZone: "" },
        }),
      }),

      // Calendar workflow results
      meetingBrief: Annotation<{
        agenda: string[];
        keyTopics: string[];
        attendeeProfiles: Array<{
          email: string;
          name?: string;
          role?: string;
          backgroundInfo?: string;
        }>;
        suggestedDuration?: string;
        preparationItems?: string[];
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      contextAnalysis: Annotation<{
        relatedMeetings?: Array<{
          id: string;
          title: string;
          date: string;
          relevance: number;
        }>;
        relevantDocuments?: Array<{
          title: string;
          url: string;
          lastModified: string;
        }>;
        recentCommunications?: Array<{
          from: string;
          subject: string;
          date: string;
          summary: string;
        }>;
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      followUpPlan: Annotation<{
        suggestedActions?: Array<{
          action: string;
          assignee?: string;
          dueDate?: string;
          priority: "high" | "medium" | "low";
        }>;
        nextMeetingRecommendation?: {
          suggestedDate: string;
          agenda: string[];
          participants: string[];
        };
        documentationNeeded?: string[];
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      // Workflow control
      stage: this.createStringAnnotation("initialization"),
      currentStep: this.createStringAnnotation("initialization"),
      workflowType: this.createStringAnnotation("pre_meeting"),
      automationLevel: this.createStringAnnotation("manual"),
      progress: Annotation<number>({
        reducer: (x, y) => Math.max(x, y),
        default: () => 0,
      }),

      // Error handling
      error: this.createStringAnnotation(),
      errors: this.createArrayAnnotation(),

      // Context and metadata
      context: this.createRecordAnnotation(),
      metadata: this.createRecordAnnotation(),
      results: this.createRecordAnnotation(),

      // Processing metadata
      processingMetadata: Annotation<{
        agentsUsed?: string[];
        performanceMetrics?: Record<string, number>;
        ragEnhanced?: boolean;
      }>({
        reducer: (existing, update) => ({ ...existing, ...update }),
        default: () => ({}),
      }),

      // Workflow metadata
      startTime: this.createStringAnnotation(),
      useRAG: Annotation<boolean>({
        reducer: (x, y) => y ?? x,
        default: () => false,
      }),
      initialized: Annotation<boolean>({
        reducer: (x, y) => y ?? x,
        default: () => false,
      }),
    };
  }

  /**
   * Get calendar workflow state definition
   */
  calendarWorkflowState() {
    return this.createCalendarWorkflowState();
  }

  /**
   * Create an annotation for a string
   */
  createStringAnnotation(defaultValue = "") {
    return Annotation<string>({
      reducer: (x, y) => y ?? x,
      default: () => defaultValue,
    });
  }

  /**
   * Create an annotation for an array of objects
   */
  createArrayAnnotation<T>() {
    return Annotation<T[]>({
      reducer: (x, y) => [...x, ...y],
      default: () => [],
    });
  }

  /**
   * Create an annotation for a record object
   */
  createRecordAnnotation<T>() {
    return Annotation<Record<string, T>>({
      reducer: (x, y) => ({ ...x, ...y }),
      default: () => ({}),
    });
  }

  /**
   * Create an annotation for a routing value
   */
  createRoutingAnnotation(defaultNode = "start") {
    return Annotation<string>({
      reducer: (x, y) => y ?? x,
      default: () => defaultNode,
    });
  }

  /**
   * Create initial state for graph execution
   */
  async createInitialState(options: {
    transcript: string;
    sessionId: string;
    userId: string;
    startTime: string;
    metadata?: Record<string, any>;
    useRAG?: boolean;
  }): Promise<any> {
    this.logger.log(
      `Creating initial state for graph execution for session ${options.sessionId}`,
    );

    return {
      transcript: options.transcript,
      sessionId: options.sessionId,
      userId: options.userId,
      startTime: options.startTime,
      metadata: options.metadata || {},
      useRAG: options.useRAG || false,
      initialized: false,
      topics: [],
      actionItems: [],
      summary: null,
      sentiment: null,
      errors: [],
    };
  }

  /**
   * Save state to persistent storage
   */
  async saveState(sessionId: string, state: any): Promise<void> {
    this.logger.log(`Saving state for session ${sessionId}`);
    // Implementation would typically save to a database
  }

  /**
   * Get saved state from persistent storage
   */
  async getState(sessionId: string): Promise<any | null> {
    this.logger.log(`Getting state for session ${sessionId}`);
    // Implementation would typically retrieve from a database
    return null;
  }

  /**
   * Save state checkpoint
   */
  async saveStateCheckpoint(
    sessionId: string,
    checkpointId: string,
    state: any,
  ): Promise<void> {
    try {
      await this.stateStorage.saveState(sessionId, checkpointId, state);
    } catch (error) {
      this.logger.error(`Failed to save state: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Load state checkpoint
   */
  async loadState(sessionId: string, checkpointId: string): Promise<any> {
    try {
      return await this.stateStorage.loadState(sessionId, checkpointId);
    } catch (error) {
      this.logger.error(`Failed to load state: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Delete state checkpoint
   */
  async deleteState(sessionId: string, checkpointId: string): Promise<void> {
    try {
      await this.stateStorage.deleteState(sessionId, checkpointId);
    } catch (error) {
      this.logger.error(
        `Failed to delete state: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * List checkpoints for a session
   */
  async listCheckpoints(sessionId: string): Promise<string[]> {
    try {
      return await this.stateStorage.listCheckpoints(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to list checkpoints: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Create state definition for master supervisor that routes between teams
   */
  createSupervisorState() {
    return {
      // Core LangGraph fields
      messages: this.createMessagesAnnotation(),

      // Original input data (can be meeting, email, or calendar)
      input: Annotation<{
        type?: "meeting" | "email" | "calendar";
        // Meeting fields
        transcript?: string;
        meetingId?: string;
        // Email fields
        emailData?: any;
        from?: string;
        to?: string[];
        subject?: string;
        body?: string;
        // Calendar fields
        calendarEvent?: any;
        eventId?: string;
        // Common fields
        sessionId?: string;
        userId?: string;
        metadata?: Record<string, any>;
      }>({
        reducer: (existing, update) => ({ ...existing, ...update }),
        default: () => ({}),
      }),

      // Routing decisions
      routing: Annotation<{
        team: "meeting_analysis" | "email_triage" | "calendar_workflow" | "__end__";
        confidence: number;
        reasoning: string;
        inputType?: string;
        teamMetadata?: Record<string, any>;
      } | null>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      // Results from the selected team
      result: Annotation<any>({
        reducer: (existing, update) => update ?? existing,
        default: () => null,
      }),

      // Processing metadata
      startTime: this.createStringAnnotation(),
      endTime: this.createStringAnnotation(),
      
      // Error handling
      error: this.createStringAnnotation(),
      errors: this.createArrayAnnotation(),

      // General metadata
      metadata: this.createRecordAnnotation(),
      
      // Session tracking
      sessionId: this.createStringAnnotation(),
      userId: this.createStringAnnotation(),

      // Progress tracking
      progress: Annotation<number>({
        reducer: (x, y) => Math.max(x, y),
        default: () => 0,
      }),

      // Processing status
      status: Annotation<"pending" | "routing" | "processing" | "completed" | "failed">({
        reducer: (x, y) => y ?? x,
        default: () => "pending",
      }),
    };
  }
}
