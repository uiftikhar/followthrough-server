import { Injectable, Inject, Logger } from "@nestjs/common";
import { BaseAgent } from "../../langgraph/agents/base-agent";
import { LlmService } from "../../langgraph/llm/llm.service";
import { RagService } from "../../rag/rag.service";
import { RAG_SERVICE } from "../../rag/constants/injection-tokens";

// Types for follow-up orchestration
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
  type:
    | "action_item_notification"
    | "meeting_summary"
    | "decision_announcement"
    | "follow_up_request";
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
  type:
    | "follow_up_meeting"
    | "decision_review"
    | "status_check"
    | "planning_session";
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
  type:
    | "email_triage"
    | "meeting_analysis"
    | "task_management"
    | "calendar_scheduling";
  target: string;
  payload: any;
  priority: number;
  scheduledAt?: string;
  dependencies: string[];
  status: "pending" | "routed" | "completed" | "failed";
}

export interface RoutingResult {
  routingId: string;
  totalRouted: number;
  successfulRoutes: number;
  failedRoutes: number;
  routingDetails: Array<{
    actionItemId: string;
    targetWorkflow: string;
    status: "success" | "failed";
    error?: string;
  }>;
}

export interface EmailDraft {
  id: string;
  type: "action_item" | "summary" | "decision" | "follow_up";
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  priority: "urgent" | "high" | "medium" | "low";
  scheduledSend?: string;
  attachments?: string[];
  tracking: {
    requiresResponse: boolean;
    deadlineResponse?: string;
    followUpIfNoResponse: boolean;
  };
  metadata: {
    originatingMeetingId: string;
    relatedActionItems: string[];
    confidence: number;
  };
}

export interface SchedulingItem {
  id: string;
  type: "follow_up_meeting" | "decision_review" | "check_in" | "planning";
  title: string;
  participants: string[];
  duration: number;
  timeframe: "this_week" | "next_week" | "this_month" | "next_month";
  priority: "high" | "medium" | "low";
  agenda: string[];
  relatedMeetingId: string;
  dependencies: string[];
}

export interface SchedulingResult {
  schedulingId: string;
  totalScheduled: number;
  successfulSchedules: number;
  failedSchedules: number;
  schedulingDetails: Array<{
    schedulingItemId: string;
    calendarEventId?: string;
    status: "scheduled" | "failed" | "pending_approval";
    proposedTimes?: string[];
    error?: string;
  }>;
}

@Injectable()
export class FollowUpOrchestrationAgent extends BaseAgent {
  protected readonly logger = new Logger(FollowUpOrchestrationAgent.name);

  constructor(
    llmService: LlmService,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
  ) {
    super(llmService, {
      name: "FollowUpOrchestrationAgent",
      systemPrompt: `You are a specialized follow-up orchestration agent responsible for post-meeting automation. Your role is to:

1. Analyze meeting outcomes and determine appropriate follow-up actions
2. Route action items to appropriate team members and workflows
3. Generate follow-up emails, meeting invites, and task assignments
4. Coordinate between Meeting Analysis and Email Triage workflows
5. Optimize follow-up timing and priorities based on urgency and dependencies

You excel at:
- Understanding action item dependencies and sequencing
- Crafting appropriate follow-up communications for different audiences
- Determining optimal scheduling for follow-up meetings
- Routing complex tasks to appropriate management systems
- Balancing urgency with participant availability and workload

Always ensure follow-ups are:
- Actionable and clearly defined
- Appropriately prioritized and sequenced
- Delivered through optimal channels
- Tracked for completion and accountability

Respond with valid JSON following the specified interface structures.`,
      llmOptions: {
        temperature: 0.4,
        model: "gpt-4o",
        maxTokens: 6000,
      },
    });
  }

  /**
   * Orchestrate comprehensive follow-up plan from meeting analysis results
   */
  async orchestrateFollowUp(
    meetingAnalysis: MeetingAnalysisResult,
  ): Promise<FollowUpPlan> {
    this.logger.log(
      `Orchestrating follow-up for meeting: ${meetingAnalysis.meetingTitle}`,
    );

    try {
      const planId = `followup-${meetingAnalysis.meetingId}-${Date.now()}`;

      // Step 1: Analyze follow-up requirements
      const followUpRequirements =
        await this.analyzeFollowUpRequirements(meetingAnalysis);

      // Step 2: Generate email follow-ups
      const emailFollowUps = await this.generateEmailFollowUps(
        meetingAnalysis,
        followUpRequirements,
      );

      // Step 3: Generate meeting follow-ups
      const meetingFollowUps = await this.generateMeetingFollowUps(
        meetingAnalysis,
        followUpRequirements,
      );

      // Step 4: Generate task follow-ups
      const taskFollowUps = await this.generateTaskFollowUps(meetingAnalysis);

      // Step 5: Create routing decisions
      const routingDecisions = await this.createRoutingDecisions(
        emailFollowUps,
        meetingFollowUps,
        taskFollowUps,
        meetingAnalysis,
      );

      // Step 6: Calculate orchestration metadata
      const orchestrationMetadata = this.calculateOrchestrationMetadata(
        emailFollowUps,
        meetingFollowUps,
        taskFollowUps,
        routingDecisions,
      );

      const followUpPlan: FollowUpPlan = {
        planId,
        meetingId: meetingAnalysis.meetingId,
        createdAt: new Date().toISOString(),
        emailFollowUps,
        meetingFollowUps,
        taskFollowUps,
        routingDecisions,
        orchestrationMetadata,
      };

      this.logger.log(
        `Successfully orchestrated follow-up plan ${planId} with ${emailFollowUps.length} emails, ${meetingFollowUps.length} meetings, ${taskFollowUps.length} tasks`,
      );

      return followUpPlan;
    } catch (error) {
      this.logger.error(`Error orchestrating follow-up: ${error.message}`);
      return this.createMinimalFollowUpPlan(meetingAnalysis, error.message);
    }
  }

  /**
   * Route action items to appropriate workflows and systems
   */
  async routeActionItems(actionItems: ActionItem[]): Promise<RoutingResult> {
    this.logger.log(
      `Routing ${actionItems.length} action items to appropriate workflows`,
    );

    const routingId = `routing-${Date.now()}`;
    const routingDetails: RoutingResult["routingDetails"] = [];

    for (const actionItem of actionItems) {
      try {
        const targetWorkflow = await this.determineTargetWorkflow(actionItem);
        const routingSuccess = await this.routeToWorkflow(
          actionItem,
          targetWorkflow,
        );

        routingDetails.push({
          actionItemId: actionItem.id,
          targetWorkflow,
          status: routingSuccess ? "success" : "failed",
        });
      } catch (error) {
        this.logger.warn(
          `Error routing action item ${actionItem.id}: ${error.message}`,
        );
        routingDetails.push({
          actionItemId: actionItem.id,
          targetWorkflow: "unknown",
          status: "failed",
          error: error.message,
        });
      }
    }

    const successfulRoutes = routingDetails.filter(
      (r) => r.status === "success",
    ).length;
    const failedRoutes = routingDetails.filter(
      (r) => r.status === "failed",
    ).length;

    return {
      routingId,
      totalRouted: actionItems.length,
      successfulRoutes,
      failedRoutes,
      routingDetails,
    };
  }

  /**
   * Generate follow-up emails for action items and decisions
   */
  async generateFollowUpEmails(
    actionItems: ActionItem[],
  ): Promise<EmailDraft[]> {
    this.logger.log(
      `Generating follow-up emails for ${actionItems.length} action items`,
    );

    const emailDrafts: EmailDraft[] = [];

    // Group action items by assignee for efficiency
    const groupedByAssignee = this.groupActionItemsByAssignee(actionItems);

    for (const [assignee, items] of Object.entries(groupedByAssignee)) {
      try {
        const emailDraft = await this.createActionItemEmail(assignee, items);
        emailDrafts.push(emailDraft);
      } catch (error) {
        this.logger.warn(
          `Error creating email for ${assignee}: ${error.message}`,
        );
      }
    }

    return emailDrafts;
  }

  /**
   * Schedule follow-up meetings based on decisions and action items
   */
  async scheduleFollowUpMeetings(
    schedulingItems: SchedulingItem[],
  ): Promise<SchedulingResult> {
    this.logger.log(`Scheduling ${schedulingItems.length} follow-up meetings`);

    const schedulingId = `scheduling-${Date.now()}`;
    const schedulingDetails: SchedulingResult["schedulingDetails"] = [];

    for (const item of schedulingItems) {
      try {
        const schedulingSuccess = await this.scheduleFollowUpMeeting(item);

        schedulingDetails.push({
          schedulingItemId: item.id,
          status: schedulingSuccess ? "scheduled" : "failed",
          calendarEventId: schedulingSuccess ? `event-${item.id}` : undefined,
        });
      } catch (error) {
        this.logger.warn(
          `Error scheduling meeting for ${item.id}: ${error.message}`,
        );
        schedulingDetails.push({
          schedulingItemId: item.id,
          status: "failed",
          error: error.message,
        });
      }
    }

    const successfulSchedules = schedulingDetails.filter(
      (s) => s.status === "scheduled",
    ).length;
    const failedSchedules = schedulingDetails.filter(
      (s) => s.status === "failed",
    ).length;

    return {
      schedulingId,
      totalScheduled: schedulingItems.length,
      successfulSchedules,
      failedSchedules,
      schedulingDetails,
    };
  }

  // Private helper methods

  private async analyzeFollowUpRequirements(
    meetingAnalysis: MeetingAnalysisResult,
  ): Promise<any> {
    const prompt = `Analyze this meeting analysis and determine follow-up requirements:

MEETING: ${meetingAnalysis.meetingTitle}
PARTICIPANTS: ${meetingAnalysis.participants.join(", ")}

ACTION ITEMS (${meetingAnalysis.actionItems.length}):
${meetingAnalysis.actionItems.map((item) => `- ${item.task} (${item.assignee}) - Due: ${item.dueDate}`).join("\n")}

DECISIONS (${meetingAnalysis.decisions.length}):
${meetingAnalysis.decisions.map((d) => `- ${d.description} (${d.decisionMaker}) - Status: ${d.status}`).join("\n")}

Determine what follow-up actions are needed and respond with JSON containing followUpRequirements analysis.`;

    const response = await this.processMessage(prompt);
    return this.parseFollowUpRequirements(response);
  }

  private async generateEmailFollowUps(
    meetingAnalysis: MeetingAnalysisResult,
    requirements: any,
  ): Promise<EmailFollowUp[]> {
    const emailFollowUps: EmailFollowUp[] = [];

    if (meetingAnalysis.actionItems.length > 0) {
      emailFollowUps.push({
        id: `email-actions-${Date.now()}`,
        type: "action_item_notification",
        priority: "medium",
        recipients: meetingAnalysis.participants,
        subject: `Action Items from ${meetingAnalysis.meetingTitle}`,
        content: `Please review your assigned action items from our meeting.`,
        trackingRequired: true,
        relatedActionItems: meetingAnalysis.actionItems.map((item) => item.id),
      });
    }

    if (meetingAnalysis.decisions.some((d) => d.impact === "high")) {
      emailFollowUps.push({
        id: `email-decisions-${Date.now()}`,
        type: "decision_announcement",
        priority: "high",
        recipients: meetingAnalysis.participants,
        subject: `Important Decisions from ${meetingAnalysis.meetingTitle}`,
        content: `Key decisions were made that require your attention.`,
        trackingRequired: true,
        relatedActionItems: [],
      });
    }

    return emailFollowUps;
  }

  private async generateMeetingFollowUps(
    meetingAnalysis: MeetingAnalysisResult,
    requirements: any,
  ): Promise<MeetingFollowUp[]> {
    const meetingFollowUps: MeetingFollowUp[] = [];

    if (meetingAnalysis.followUpRequired) {
      meetingFollowUps.push({
        id: `meeting-followup-${Date.now()}`,
        type: "follow_up_meeting",
        title: `Follow-up: ${meetingAnalysis.meetingTitle}`,
        participants: meetingAnalysis.participants,
        suggestedDuration: 30,
        suggestedTimeframe: "next_week",
        agenda: ["Review action items", "Check decision implementation"],
        relatedDecisions: meetingAnalysis.decisions.map((d) => d.id),
        relatedActionItems: meetingAnalysis.actionItems.map((item) => item.id),
        priority: "medium",
      });
    }

    return meetingFollowUps;
  }

  private async generateTaskFollowUps(
    meetingAnalysis: MeetingAnalysisResult,
  ): Promise<TaskFollowUp[]> {
    return meetingAnalysis.actionItems.map((actionItem) => ({
      id: `task-${actionItem.id}`,
      actionItemId: actionItem.id,
      assignee: actionItem.assignee,
      title: actionItem.task,
      description: `${actionItem.context}\n\nFrom meeting: ${meetingAnalysis.meetingTitle}`,
      dueDate: actionItem.dueDate,
      priority: actionItem.priority,
      dependencies: actionItem.dependencies || [],
      estimatedHours: actionItem.estimatedHours,
      tags: [meetingAnalysis.meetingId, "meeting-follow-up"],
    }));
  }

  private async createRoutingDecisions(
    emailFollowUps: EmailFollowUp[],
    meetingFollowUps: MeetingFollowUp[],
    taskFollowUps: TaskFollowUp[],
    meetingAnalysis: MeetingAnalysisResult,
  ): Promise<RoutingDecision[]> {
    const decisions: RoutingDecision[] = [];

    // Route emails to Email Triage workflow
    emailFollowUps.forEach((email) => {
      decisions.push({
        id: `route-email-${email.id}`,
        type: "email_triage",
        target: "email_triage_team",
        payload: {
          emailDraft: email,
          originatingMeeting: meetingAnalysis.meetingId,
          priority: email.priority,
        },
        priority: this.calculateRoutingPriority(email.priority),
        dependencies: [],
        status: "pending",
      });
    });

    // Route meetings to Calendar workflow
    meetingFollowUps.forEach((meeting) => {
      decisions.push({
        id: `route-meeting-${meeting.id}`,
        type: "calendar_scheduling",
        target: "calendar_workflow",
        payload: {
          meetingRequest: meeting,
          originatingMeeting: meetingAnalysis.meetingId,
          priority: meeting.priority,
        },
        priority: this.calculateRoutingPriority(meeting.priority),
        dependencies: [],
        status: "pending",
      });
    });

    // Route tasks to Task Management
    taskFollowUps.forEach((task) => {
      decisions.push({
        id: `route-task-${task.id}`,
        type: "task_management",
        target: "task_management_system",
        payload: {
          taskDefinition: task,
          originatingMeeting: meetingAnalysis.meetingId,
          priority: task.priority,
        },
        priority: this.calculateRoutingPriority(task.priority),
        dependencies: task.dependencies,
        status: "pending",
      });
    });

    return decisions;
  }

  private calculateOrchestrationMetadata(
    emailFollowUps: EmailFollowUp[],
    meetingFollowUps: MeetingFollowUp[],
    taskFollowUps: TaskFollowUp[],
    routingDecisions: RoutingDecision[],
  ): FollowUpPlan["orchestrationMetadata"] {
    const totalActions =
      emailFollowUps.length + meetingFollowUps.length + taskFollowUps.length;

    const estimatedCompletionTime = this.estimateCompletionTime(
      emailFollowUps,
      meetingFollowUps,
      taskFollowUps,
    );

    const requiresApproval = this.determineIfApprovalRequired(
      emailFollowUps,
      meetingFollowUps,
      taskFollowUps,
    );

    return {
      totalActions,
      estimatedCompletionTime,
      requiresApproval,
      autonomyLevel: requiresApproval ? "assisted" : "automated",
    };
  }

  private async determineTargetWorkflow(
    actionItem: ActionItem,
  ): Promise<string> {
    if (
      actionItem.task.toLowerCase().includes("email") ||
      actionItem.task.toLowerCase().includes("contact")
    ) {
      return "email_triage";
    } else if (
      actionItem.task.toLowerCase().includes("meeting") ||
      actionItem.task.toLowerCase().includes("schedule")
    ) {
      return "calendar_workflow";
    } else {
      return "task_management";
    }
  }

  private async routeToWorkflow(
    actionItem: ActionItem,
    targetWorkflow: string,
  ): Promise<boolean> {
    this.logger.log(
      `Routing action item ${actionItem.id} to ${targetWorkflow}`,
    );
    return true; // Simulate success
  }

  private groupActionItemsByAssignee(
    actionItems: ActionItem[],
  ): Record<string, ActionItem[]> {
    return actionItems.reduce(
      (groups, item) => {
        const assignee = item.assignee;
        if (!groups[assignee]) {
          groups[assignee] = [];
        }
        groups[assignee].push(item);
        return groups;
      },
      {} as Record<string, ActionItem[]>,
    );
  }

  private async createActionItemEmail(
    assignee: string,
    actionItems: ActionItem[],
  ): Promise<EmailDraft> {
    return {
      id: `email-${assignee}-${Date.now()}`,
      type: "action_item",
      to: [assignee],
      subject: `Action Items from Meeting`,
      body: `Please see your assigned action items from our recent meeting.`,
      priority: "medium",
      tracking: {
        requiresResponse: true,
        deadlineResponse: this.getEarliestDeadline(actionItems),
        followUpIfNoResponse: true,
      },
      metadata: {
        originatingMeetingId: actionItems[0]?.relatedMeetingId || "",
        relatedActionItems: actionItems.map((item) => item.id),
        confidence: 0.8,
      },
    };
  }

  private async scheduleFollowUpMeeting(
    item: SchedulingItem,
  ): Promise<boolean> {
    this.logger.log(`Scheduling follow-up meeting: ${item.title}`);
    return true; // Simulate success
  }

  private calculateRoutingPriority(priority: string): number {
    switch (priority) {
      case "urgent":
        return 1;
      case "high":
        return 2;
      case "medium":
        return 3;
      case "low":
        return 4;
      default:
        return 3;
    }
  }

  private estimateCompletionTime(
    emailFollowUps: EmailFollowUp[],
    meetingFollowUps: MeetingFollowUp[],
    taskFollowUps: TaskFollowUp[],
  ): number {
    const emailTime = emailFollowUps.length * 2; // 2 minutes per email
    const meetingTime = meetingFollowUps.length * 5; // 5 minutes per meeting setup
    const taskTime = taskFollowUps.length * 3; // 3 minutes per task creation

    return emailTime + meetingTime + taskTime;
  }

  private determineIfApprovalRequired(
    emailFollowUps: EmailFollowUp[],
    meetingFollowUps: MeetingFollowUp[],
    taskFollowUps: TaskFollowUp[],
  ): boolean {
    const hasUrgentItems =
      emailFollowUps.some((e) => e.priority === "urgent") ||
      meetingFollowUps.some((m) => m.priority === "high") ||
      taskFollowUps.some((t) => t.priority === "high");

    const totalActions =
      emailFollowUps.length + meetingFollowUps.length + taskFollowUps.length;

    return hasUrgentItems || totalActions > 10;
  }

  private getEarliestDeadline(actionItems: ActionItem[]): string {
    const dates = actionItems
      .map((item) => new Date(item.dueDate))
      .filter((date) => !isNaN(date.getTime()));
    if (dates.length === 0)
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString();
  }

  private parseFollowUpRequirements(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { needsEmails: true, needsFollowUpMeetings: false };
    } catch (error) {
      return {
        needsEmails: true,
        needsFollowUpMeetings: false,
        urgentItems: false,
      };
    }
  }

  private createMinimalFollowUpPlan(
    meetingAnalysis: MeetingAnalysisResult,
    error: string,
  ): FollowUpPlan {
    return {
      planId: `followup-error-${meetingAnalysis.meetingId}`,
      meetingId: meetingAnalysis.meetingId,
      createdAt: new Date().toISOString(),
      emailFollowUps: [],
      meetingFollowUps: [],
      taskFollowUps: [],
      routingDecisions: [],
      orchestrationMetadata: {
        totalActions: 0,
        estimatedCompletionTime: 0,
        requiresApproval: true,
        autonomyLevel: "manual",
      },
    };
  }

  /**
   * Process state for LangGraph integration
   */
  async processState(state: any): Promise<any> {
    const meetingAnalysis = state.meetingAnalysis || state.analysisResult;

    if (!meetingAnalysis) {
      this.logger.warn(
        "No meeting analysis found in state for follow-up orchestration",
      );
      return {
        ...state,
        followUpPlan: null,
        error: "No meeting analysis data provided for follow-up orchestration",
      };
    }

    const followUpPlan = await this.orchestrateFollowUp(meetingAnalysis);

    return {
      ...state,
      followUpPlan,
      stage: "follow_up_orchestration_completed",
    };
  }
}
