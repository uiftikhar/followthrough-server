import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TeamHandler } from '../../langgraph/core/interfaces/team-handler.interface';
import { FollowUpOrchestrationAgent } from '../agents/follow-up-orchestration.agent';
import { CalendarAgentFactory } from '../agents/calendar-agent.factory';

export interface PostMeetingOrchestrationState {
  sessionId: string;
  type: 'post_meeting_orchestration';
  meetingAnalysisResult?: any;
  followUpPlan?: any;
  routingResults?: any[];
  emailDrafts?: any[];
  schedulingResults?: any[];
  stage: string;
  error?: string;
}

@Injectable()
export class PostMeetingOrchestrationService implements TeamHandler<any, PostMeetingOrchestrationState> {
  private readonly logger = new Logger(PostMeetingOrchestrationService.name);

  constructor(
    private readonly calendarAgentFactory: CalendarAgentFactory,
  ) {}

  /**
   * Get team name for handler registry
   */
  getTeamName(): string {
    return 'post_meeting_orchestration';
  }

  /**
   * Process post-meeting orchestration workflow
   */
  async process(input: any): Promise<PostMeetingOrchestrationState> {
    this.logger.log('Starting post-meeting orchestration workflow');

    const sessionId = input.sessionId || `orchestration-${Date.now()}`;
    
    const initialState: PostMeetingOrchestrationState = {
      sessionId,
      type: 'post_meeting_orchestration',
      stage: 'initialized'
    };

    try {
      // Step 1: Validate meeting analysis input
      const meetingAnalysisResult = this.extractMeetingAnalysisResult(input);
      if (!meetingAnalysisResult) {
        return {
          ...initialState,
          stage: 'failed',
          error: 'No meeting analysis result provided for orchestration'
        };
      }

      this.logger.log(`Processing orchestration for meeting: ${meetingAnalysisResult.meetingTitle}`);

      // Step 2: Generate follow-up plan
      const followUpAgent = this.calendarAgentFactory.getFollowUpOrchestrationAgent();
      const followUpPlan = await followUpAgent.orchestrateFollowUp(meetingAnalysisResult);

      // Step 3: Route action items to appropriate workflows
      const routingResults = await this.routeFollowUpActions(followUpPlan);

      // Step 4: Generate email drafts for Email Triage workflow
      const emailDrafts = await this.generateEmailDrafts(followUpPlan);

      // Step 5: Generate scheduling requests for Calendar workflow
      const schedulingResults = await this.generateSchedulingRequests(followUpPlan);

      const finalState: PostMeetingOrchestrationState = {
        sessionId,
        type: 'post_meeting_orchestration',
        meetingAnalysisResult,
        followUpPlan,
        routingResults,
        emailDrafts,
        schedulingResults,
        stage: 'completed'
      };

      this.logger.log(`Successfully completed post-meeting orchestration for session ${sessionId}`);
      return finalState;

    } catch (error) {
      this.logger.error(`Error in post-meeting orchestration: ${error.message}`);
      return {
        ...initialState,
        stage: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Extract meeting analysis result from input
   */
  private extractMeetingAnalysisResult(input: any): any | null {
    // Meeting analysis result can come from various sources
    if (input.meetingAnalysisResult) {
      return input.meetingAnalysisResult;
    }

    if (input.analysisResult) {
      return input.analysisResult;
    }

    if (input.meetingResult) {
      return input.meetingResult;
    }

    // Try to extract from nested structures
    if (input.result && input.result.meetingAnalysis) {
      return input.result.meetingAnalysis;
    }

    return null;
  }

  /**
   * Route follow-up actions to appropriate workflows
   */
  private async routeFollowUpActions(followUpPlan: any): Promise<any[]> {
    this.logger.log(`Routing ${followUpPlan.routingDecisions.length} follow-up actions`);

    const routingResults: any[] = [];

    for (const decision of followUpPlan.routingDecisions) {
      try {
        const result = await this.routeToWorkflow(decision);
        routingResults.push({
          decisionId: decision.id,
          targetWorkflow: decision.target,
          status: 'routed',
          result
        });
      } catch (error) {
        this.logger.warn(`Failed to route decision ${decision.id}: ${error.message}`);
        routingResults.push({
          decisionId: decision.id,
          targetWorkflow: decision.target,
          status: 'failed',
          error: error.message
        });
      }
    }

    return routingResults;
  }

  /**
   * Route individual decision to target workflow
   */
  private async routeToWorkflow(decision: any): Promise<any> {
    switch (decision.type) {
      case 'email_triage':
        return this.routeToEmailTriage(decision);
      
      case 'calendar_scheduling':
        return this.routeToCalendarWorkflow(decision);
      
      case 'task_management':
        return this.routeToTaskManagement(decision);
      
      default:
        throw new Error(`Unknown routing target: ${decision.type}`);
    }
  }

  /**
   * Route email actions to Email Triage workflow
   */
  private async routeToEmailTriage(decision: any): Promise<any> {
    this.logger.log(`Routing email action to Email Triage: ${decision.id}`);

    // In a real implementation, this would:
    // 1. Format the email draft for Email Triage workflow
    // 2. Send to Email Triage team handler via unified workflow service
    // 3. Track the routing status

    const emailTriagePayload = {
      type: 'follow_up_email',
      emailDraft: decision.payload.emailDraft,
      originatingMeeting: decision.payload.originatingMeeting,
      priority: decision.payload.priority,
      metadata: {
        routingDecisionId: decision.id,
        source: 'post_meeting_orchestration'
      }
    };

    // Simulate successful routing
    return {
      routedAt: new Date().toISOString(),
      targetTeam: 'email_triage_team',
      payload: emailTriagePayload,
      status: 'pending_processing'
    };
  }

  /**
   * Route calendar actions to Calendar workflow
   */
  private async routeToCalendarWorkflow(decision: any): Promise<any> {
    this.logger.log(`Routing calendar action to Calendar Workflow: ${decision.id}`);

    // In a real implementation, this would:
    // 1. Format the meeting request for Calendar workflow
    // 2. Send to Calendar team handler
    // 3. Handle scheduling conflicts and participant availability

    const calendarPayload = {
      type: 'follow_up_meeting',
      meetingRequest: decision.payload.meetingRequest,
      originatingMeeting: decision.payload.originatingMeeting,
      priority: decision.payload.priority,
      metadata: {
        routingDecisionId: decision.id,
        source: 'post_meeting_orchestration'
      }
    };

    // Simulate successful routing
    return {
      routedAt: new Date().toISOString(),
      targetTeam: 'calendar_workflow',
      payload: calendarPayload,
      status: 'pending_scheduling'
    };
  }

  /**
   * Route task actions to Task Management system
   */
  private async routeToTaskManagement(decision: any): Promise<any> {
    this.logger.log(`Routing task action to Task Management: ${decision.id}`);

    // In a real implementation, this would:
    // 1. Format the task for external task management systems (Jira, Asana, etc.)
    // 2. Create task via API integration
    // 3. Set up tracking and notifications

    const taskPayload = {
      type: 'follow_up_task',
      taskDefinition: decision.payload.taskDefinition,
      originatingMeeting: decision.payload.originatingMeeting,
      priority: decision.payload.priority,
      metadata: {
        routingDecisionId: decision.id,
        source: 'post_meeting_orchestration'
      }
    };

    // Simulate successful routing
    return {
      routedAt: new Date().toISOString(),
      targetSystem: 'task_management_system',
      payload: taskPayload,
      status: 'pending_creation'
    };
  }

  /**
   * Generate email drafts for Email Triage workflow
   */
  private async generateEmailDrafts(followUpPlan: any): Promise<any[]> {
    this.logger.log(`Generating ${followUpPlan.emailFollowUps.length} email drafts`);

    const emailDrafts: any[] = [];

    for (const emailFollowUp of followUpPlan.emailFollowUps) {
      try {
        const draft = await this.createEmailDraft(emailFollowUp, followUpPlan);
        emailDrafts.push(draft);
      } catch (error) {
        this.logger.warn(`Failed to create email draft for ${emailFollowUp.id}: ${error.message}`);
        emailDrafts.push({
          id: emailFollowUp.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return emailDrafts;
  }

  /**
   * Create individual email draft
   */
  private async createEmailDraft(emailFollowUp: any, followUpPlan: any): Promise<any> {
    return {
      id: `draft-${emailFollowUp.id}`,
      type: emailFollowUp.type,
      to: emailFollowUp.recipients,
      subject: emailFollowUp.subject,
      body: this.enhanceEmailContent(emailFollowUp.content, followUpPlan),
      priority: emailFollowUp.priority,
      scheduledDelivery: emailFollowUp.scheduledDelivery,
      tracking: {
        requiresResponse: emailFollowUp.trackingRequired,
        followUpRequired: true
      },
      metadata: {
        originatingMeeting: followUpPlan.meetingId,
        relatedActionItems: emailFollowUp.relatedActionItems,
        source: 'post_meeting_orchestration'
      },
      status: 'draft_ready'
    };
  }

  /**
   * Generate scheduling requests for Calendar workflow
   */
  private async generateSchedulingRequests(followUpPlan: any): Promise<any[]> {
    this.logger.log(`Generating ${followUpPlan.meetingFollowUps.length} scheduling requests`);

    const schedulingRequests: any[] = [];

    for (const meetingFollowUp of followUpPlan.meetingFollowUps) {
      try {
        const request = await this.createSchedulingRequest(meetingFollowUp, followUpPlan);
        schedulingRequests.push(request);
      } catch (error) {
        this.logger.warn(`Failed to create scheduling request for ${meetingFollowUp.id}: ${error.message}`);
        schedulingRequests.push({
          id: meetingFollowUp.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return schedulingRequests;
  }

  /**
   * Create individual scheduling request
   */
  private async createSchedulingRequest(meetingFollowUp: any, followUpPlan: any): Promise<any> {
    return {
      id: `schedule-${meetingFollowUp.id}`,
      type: meetingFollowUp.type,
      title: meetingFollowUp.title,
      participants: meetingFollowUp.participants,
      duration: meetingFollowUp.suggestedDuration,
      timeframe: meetingFollowUp.suggestedTimeframe,
      agenda: meetingFollowUp.agenda,
      priority: meetingFollowUp.priority,
      relatedMeeting: followUpPlan.meetingId,
      relatedDecisions: meetingFollowUp.relatedDecisions,
      relatedActionItems: meetingFollowUp.relatedActionItems,
      metadata: {
        source: 'post_meeting_orchestration',
        orchestrationPlan: followUpPlan.planId
      },
      status: 'scheduling_requested'
    };
  }

  /**
   * Enhance email content with context
   */
  private enhanceEmailContent(baseContent: string, followUpPlan: any): string {
    return `${baseContent}

--- 
This follow-up is automatically generated from the meeting "${followUpPlan.meetingId}".
Related action items: ${followUpPlan.taskFollowUps.length}
Generated on: ${new Date().toLocaleDateString()}`;
  }

  /**
   * Get workflow status for monitoring
   */
  async getOrchestrationStatus(sessionId: string): Promise<any> {
    // In a real implementation, this would:
    // 1. Query session storage for current status
    // 2. Check routing completion status
    // 3. Aggregate progress from downstream workflows

    return {
      sessionId,
      status: 'in_progress',
      progress: {
        followUpPlanGenerated: true,
        routingCompleted: true,
        emailDraftsCreated: true,
        schedulingRequestsCreated: true
      },
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Handle workflow completion notifications
   */
  async handleWorkflowCompletion(workflowType: string, result: any): Promise<void> {
    this.logger.log(`Received completion notification from ${workflowType}`);

    // In a real implementation, this would:
    // 1. Update orchestration status
    // 2. Trigger next steps if needed
    // 3. Send notifications to stakeholders
    // 4. Update analytics and metrics

    switch (workflowType) {
      case 'email_triage':
        this.logger.log('Email triage workflow completed');
        break;
      
      case 'calendar_workflow':
        this.logger.log('Calendar workflow completed');
        break;
      
      case 'task_management':
        this.logger.log('Task management workflow completed');
        break;
      
      default:
        this.logger.warn(`Unknown workflow type: ${workflowType}`);
    }
  }

  /**
   * 🚀 NEW: Auto-trigger post-meeting orchestration when meeting analysis completes
   */
  @OnEvent('meeting_analysis.completed')
  async handleMeetingAnalysisCompleted(event: {
    sessionId: string;
    result: any;
    timestamp: string;
  }): Promise<void> {
    this.logger.log(`🎯 Auto-triggering post-meeting orchestration for session ${event.sessionId}`);

    try {
      // Process the orchestration workflow automatically
      const orchestrationInput = {
        type: 'post_meeting_orchestration',
        sessionId: `orchestration-${event.sessionId}`,
        meetingAnalysisResult: event.result,
        metadata: {
          triggeredBy: 'meeting_analysis_completion',
          originalSessionId: event.sessionId,
          triggeredAt: event.timestamp,
          autoTriggered: true
        }
      };

      // Execute the orchestration workflow
      const orchestrationResult = await this.process(orchestrationInput);

      this.logger.log(`✅ Completed automated post-meeting orchestration for session ${event.sessionId}`);
      this.logger.log(`   - Follow-up plan generated: ${!!orchestrationResult.followUpPlan}`);
      this.logger.log(`   - Email drafts created: ${orchestrationResult.emailDrafts?.length || 0}`);
      this.logger.log(`   - Scheduling requests: ${orchestrationResult.schedulingResults?.length || 0}`);

    } catch (error) {
      this.logger.error(`❌ Error in automated post-meeting orchestration for session ${event.sessionId}: ${error.message}`, error.stack);
      
      // Don't throw - we don't want to break the main meeting analysis workflow
      // Instead, we could store this error for retry or manual intervention
      this.logger.warn(`Post-meeting orchestration will need to be triggered manually for session ${event.sessionId}`);
    }
  }
} 