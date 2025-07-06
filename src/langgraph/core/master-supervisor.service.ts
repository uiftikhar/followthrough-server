import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TeamHandlerRegistry } from './team-handler-registry.service';
import { StateService } from '../state/state.service';
import { UnifiedWorkflowService } from '../unified-workflow.service';

export interface MasterWorkflowState {
  masterSessionId: string;
  userId: string;
  initiatingEvent: WorkflowTrigger;
  
  // Cross-workflow session tracking
  activeWorkflows: {
    calendar?: string; // Calendar session ID
    meeting?: string;  // Meeting analysis session ID
    email?: string;    // Email triage session ID
  };
  
  // Unified workflow data
  googleEvent?: any;
  meetingTranscript?: string;
  analysisResults?: any;
  followUpActions?: any[];
  
  // Workflow orchestration
  currentWorkflow: 'calendar' | 'meeting' | 'email' | 'completed';
  stage: string;
  progress: number;
  completedWorkflows: string[];
  
  // Google Workspace integration
  googleWorkspaceData: {
    meetingRecording?: any;
    calendarEvent?: any;
    emailDrafts?: any[];
    permissions?: string[];
  };
  
  // Error handling and recovery
  error?: string;
  retryCount: number;
  fallbackStrategy?: string;
  
  // Metadata
  startTime: string;
  endTime?: string;
  metadata: Record<string, any>;
}

export interface WorkflowTrigger {
  type: 'google_calendar_event' | 'meeting_ended' | 'email_received' | 'manual_trigger';
  source: 'google_webhook' | 'user_action' | 'automated';
  data: any;
  priority: 'high' | 'medium' | 'low';
}

export interface WorkflowTransition {
  from: string;
  to: string;
  condition: (state: MasterWorkflowState) => boolean;
  action?: (state: MasterWorkflowState) => Promise<MasterWorkflowState>;
}

@Injectable()
export class MasterSupervisorService {
  private readonly logger = new Logger(MasterSupervisorService.name);
  
  // Active master sessions
  private readonly activeSessions = new Map<string, MasterWorkflowState>();
  
  // Workflow transition rules
  private readonly transitions: WorkflowTransition[] = [
    {
      from: 'calendar',
      to: 'meeting',
      condition: (state) => !!state.meetingTranscript,
      action: this.triggerMeetingAnalysis.bind(this)
    },
    {
      from: 'meeting', 
      to: 'email',
      condition: (state) => !!state.analysisResults?.actionItems?.length,
      action: this.triggerEmailGeneration.bind(this)
    },
    {
      from: 'email',
      to: 'completed',
      condition: (state) => !!(state.followUpActions && state.followUpActions.length > 0),
      action: this.finalizeWorkflow.bind(this)
    }
  ];

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly teamRegistry: TeamHandlerRegistry,
    private readonly stateService: StateService,
    private readonly unifiedWorkflow: UnifiedWorkflowService,
  ) {
    this.setupEventListeners();
  }

  /**
   * 🚀 Main orchestration method - handles all workflow triggers
   */
  async orchestrateWorkflows(trigger: WorkflowTrigger): Promise<MasterWorkflowState> {
    this.logger.log(`🎯 Master Supervisor: Orchestrating workflows for trigger: ${trigger.type}`);

    try {
      // Create master session
      const masterSessionId = `master-${Date.now()}`;
      const masterState: MasterWorkflowState = {
        masterSessionId,
        userId: trigger.data.userId || 'unknown',
        initiatingEvent: trigger,
        activeWorkflows: {},
        currentWorkflow: this.determineStartingWorkflow(trigger),
        stage: 'initialized',
        progress: 0,
        completedWorkflows: [],
        googleWorkspaceData: {},
        retryCount: 0,
        startTime: new Date().toISOString(),
        metadata: { trigger }
      };

      // Store active session
      this.activeSessions.set(masterSessionId, masterState);

      // Start workflow orchestration
      const finalState = await this.executeWorkflowChain(masterState);

      this.logger.log(`✅ Master Supervisor: Workflow orchestration completed for session ${masterSessionId}`);
      return finalState;

    } catch (error) {
      this.logger.error(`❌ Master Supervisor: Orchestration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔄 Execute the workflow chain based on transitions
   */
  private async executeWorkflowChain(state: MasterWorkflowState): Promise<MasterWorkflowState> {
    this.logger.log(`🔄 Executing workflow chain, current: ${state.currentWorkflow}`);

    let currentState = state;
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;

    while (currentState.currentWorkflow !== 'completed' && iteration < maxIterations) {
      iteration++;
      
      try {
        // Execute current workflow
        currentState = await this.executeCurrentWorkflow(currentState);
        
        // Check for transitions
        const transition = this.findApplicableTransition(currentState);
        
        if (transition) {
          this.logger.log(`🔄 Transitioning from ${transition.from} to ${transition.to}`);
          
          // Execute transition action if defined
          if (transition.action) {
            currentState = await transition.action(currentState);
          }
          
          // Update current workflow
          currentState.currentWorkflow = transition.to as any;
          currentState.completedWorkflows.push(transition.from);
          currentState.progress = this.calculateProgress(currentState);
          
          // Update stored state
          this.activeSessions.set(currentState.masterSessionId, currentState);
        } else {
          // No applicable transition - workflow might be waiting for external input
          this.logger.log(`⏳ No applicable transition from ${currentState.currentWorkflow}, workflow may be waiting`);
          break;
        }
        
      } catch (error) {
        this.logger.error(`❌ Error in workflow chain execution: ${error.message}`);
        currentState = await this.handleWorkflowError(currentState, error);
        break;
      }
    }

    // Finalize
    currentState.endTime = new Date().toISOString();
    this.activeSessions.set(currentState.masterSessionId, currentState);
    
    return currentState;
  }

  /**
   * 🎯 Execute current workflow using existing team handlers
   */
  private async executeCurrentWorkflow(state: MasterWorkflowState): Promise<MasterWorkflowState> {
    this.logger.log(`🎯 Executing ${state.currentWorkflow} workflow`);

    switch (state.currentWorkflow) {
      case 'calendar':
        return await this.executeCalendarWorkflow(state);
      
      case 'meeting':
        return await this.executeMeetingAnalysisWorkflow(state);
      
      case 'email':
        return await this.executeEmailTriageWorkflow(state);
      
      default:
        throw new Error(`Unknown workflow: ${state.currentWorkflow}`);
    }
  }

  /**
   * 📅 Execute calendar workflow using existing CalendarWorkflowService
   */
  private async executeCalendarWorkflow(state: MasterWorkflowState): Promise<MasterWorkflowState> {
    this.logger.log(`📅 Executing calendar workflow for session ${state.masterSessionId}`);

    try {
      // Get calendar team handler
      const calendarTeam = this.teamRegistry.getHandler('calendar_workflow');
      
      if (!calendarTeam) {
        throw new Error('Calendar workflow team handler not found');
      }

      // Prepare calendar workflow input
      const calendarInput = {
        type: 'calendar_event_processing',
        userId: state.userId,
        calendarEvent: state.initiatingEvent.data.calendarEvent,
        googleEvent: state.initiatingEvent.data.googleEvent,
        sessionId: `cal-${state.masterSessionId}`,
        metadata: {
          masterSessionId: state.masterSessionId,
          trigger: state.initiatingEvent
        }
      };

      // Execute calendar workflow
      const calendarResult = await calendarTeam.process(calendarInput);
      
      // Store calendar session ID and extract relevant data
      const updatedState: MasterWorkflowState = {
        ...state,
        activeWorkflows: {
          ...state.activeWorkflows,
          calendar: calendarResult.sessionId
        },
        googleEvent: calendarResult.calendarEvent,
        stage: 'calendar_completed',
        googleWorkspaceData: {
          ...state.googleWorkspaceData,
          calendarEvent: calendarResult.calendarEvent,
          permissions: calendarResult.context?.permissions
        }
      };

      // If this is a post-meeting trigger, look for meeting transcript
      if (state.initiatingEvent.type === 'meeting_ended') {
        updatedState.meetingTranscript = state.initiatingEvent.data.transcript;
      }

      return updatedState;

    } catch (error) {
      this.logger.error(`❌ Calendar workflow execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🎤 Execute meeting analysis workflow
   */
  private async executeMeetingAnalysisWorkflow(state: MasterWorkflowState): Promise<MasterWorkflowState> {
    this.logger.log(`🎤 Executing meeting analysis workflow for session ${state.masterSessionId}`);

    try {
      // Get meeting analysis team handler
      const meetingTeam = this.teamRegistry.getHandler('meeting_analysis');
      
      if (!meetingTeam) {
        throw new Error('Meeting analysis team handler not found');
      }

      // Prepare meeting analysis input
      const meetingInput = {
        type: 'meeting_transcript',
        transcript: state.meetingTranscript,
        participants: state.googleEvent?.attendees?.map((a: any) => a.email) || [],
        meetingTitle: state.googleEvent?.summary || 'Unknown Meeting',
        date: state.googleEvent?.start?.dateTime || new Date().toISOString(),
        sessionId: `meeting-${state.masterSessionId}`,
        metadata: {
          masterSessionId: state.masterSessionId,
          calendarSessionId: state.activeWorkflows.calendar,
          googleEvent: state.googleEvent
        }
      };

      // Execute meeting analysis workflow
      const meetingResult = await meetingTeam.process(meetingInput);
      
      // Extract analysis results
      const updatedState: MasterWorkflowState = {
        ...state,
        activeWorkflows: {
          ...state.activeWorkflows,
          meeting: meetingResult.sessionId
        },
        analysisResults: meetingResult.analysisResult,
        stage: 'meeting_analysis_completed',
        googleWorkspaceData: {
          ...state.googleWorkspaceData,
          meetingRecording: state.initiatingEvent.data.recording
        }
      };

      return updatedState;

    } catch (error) {
      this.logger.error(`❌ Meeting analysis workflow execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * ✉️ Execute email triage workflow
   */
  private async executeEmailTriageWorkflow(state: MasterWorkflowState): Promise<MasterWorkflowState> {
    this.logger.log(`✉️ Executing email triage workflow for session ${state.masterSessionId}`);

    try {
      // Get email triage team handler
      const emailTeam = this.teamRegistry.getHandler('email_triage_team');
      
      if (!emailTeam) {
        throw new Error('Email triage team handler not found');
      }

      // Generate follow-up emails based on meeting analysis
      const followUpEmails = this.generateFollowUpEmails(state.analysisResults, state.googleEvent);

      // Process each follow-up email through email triage
      const emailResults: any[] = [];
      
      for (const emailData of followUpEmails) {
        const emailInput = {
          type: 'follow_up_email',
          emailDraft: emailData,
          originatingMeeting: state.googleEvent?.id,
          sessionId: `email-${state.masterSessionId}-${emailResults.length}`,
          metadata: {
            masterSessionId: state.masterSessionId,
            calendarSessionId: state.activeWorkflows.calendar,
            meetingSessionId: state.activeWorkflows.meeting,
            analysisResults: state.analysisResults
          }
        };

        const emailResult = await emailTeam.process(emailInput);
        emailResults.push(emailResult);
      }

      // Update state with email results
      const updatedState: MasterWorkflowState = {
        ...state,
        activeWorkflows: {
          ...state.activeWorkflows,
          email: emailResults.map((r: any) => r.sessionId).join(',')
        },
        followUpActions: emailResults,
        stage: 'email_generation_completed',
        googleWorkspaceData: {
          ...state.googleWorkspaceData,
          emailDrafts: emailResults.map((r: any) => r.emailDraft)
        }
      };

      return updatedState;

    } catch (error) {
      this.logger.error(`❌ Email triage workflow execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🎯 Workflow transition actions
   */
  private async triggerMeetingAnalysis(state: MasterWorkflowState): Promise<MasterWorkflowState> {
    this.logger.log(`🎯 Triggering meeting analysis transition`);
    
    // Emit event for meeting analysis trigger
    this.eventEmitter.emit('master.workflow.meeting_analysis_triggered', {
      masterSessionId: state.masterSessionId,
      calendarSessionId: state.activeWorkflows.calendar,
      transcript: state.meetingTranscript
    });
    
    return state;
  }

  private async triggerEmailGeneration(state: MasterWorkflowState): Promise<MasterWorkflowState> {
    this.logger.log(`🎯 Triggering email generation transition`);
    
    // Emit event for email generation trigger
    this.eventEmitter.emit('master.workflow.email_generation_triggered', {
      masterSessionId: state.masterSessionId,
      meetingSessionId: state.activeWorkflows.meeting,
      actionItems: state.analysisResults?.actionItems
    });
    
    return state;
  }

  private async finalizeWorkflow(state: MasterWorkflowState): Promise<MasterWorkflowState> {
    this.logger.log(`🎯 Finalizing master workflow`);
    
    // Emit completion event
    this.eventEmitter.emit('master.workflow.completed', {
      masterSessionId: state.masterSessionId,
      completedWorkflows: state.completedWorkflows,
      finalResults: {
        calendarEvent: state.googleEvent,
        analysisResults: state.analysisResults,
        followUpActions: state.followUpActions
      }
    });
    
    return {
      ...state,
      stage: 'completed',
      progress: 100
    };
  }

  /**
   * 🔍 Helper methods
   */
  private determineStartingWorkflow(trigger: WorkflowTrigger): 'calendar' | 'meeting' | 'email' {
    switch (trigger.type) {
      case 'google_calendar_event':
        return 'calendar';
      case 'meeting_ended':
        return trigger.data.transcript ? 'meeting' : 'calendar';
      case 'email_received':
        return 'email';
      default:
        return 'calendar';
    }
  }

  private findApplicableTransition(state: MasterWorkflowState): WorkflowTransition | null {
    return this.transitions.find(transition => 
      transition.from === state.currentWorkflow && 
      transition.condition(state)
    ) || null;
  }

  private calculateProgress(state: MasterWorkflowState): number {
    const totalWorkflows = 3; // calendar, meeting, email
    const completedCount = state.completedWorkflows.length;
    return Math.round((completedCount / totalWorkflows) * 100);
  }

  private generateFollowUpEmails(analysisResults: any, googleEvent: any): any[] {
    // Generate follow-up emails based on analysis results
    const emails: any[] = [];
    
    if (analysisResults?.actionItems?.length > 0) {
      emails.push({
        type: 'action_items_summary',
        to: googleEvent?.attendees?.map((a: any) => a.email) || [],
        subject: `Action Items from ${googleEvent?.summary || 'Meeting'}`,
        actionItems: analysisResults.actionItems,
        priority: 'medium'
      });
    }
    
    if (analysisResults?.decisions?.length > 0) {
      emails.push({
        type: 'decisions_summary',
        to: googleEvent?.organizer?.email ? [googleEvent.organizer.email] : [],
        subject: `Key Decisions from ${googleEvent?.summary || 'Meeting'}`,
        decisions: analysisResults.decisions,
        priority: 'high'
      });
    }
    
    return emails;
  }

  private async handleWorkflowError(state: MasterWorkflowState, error: Error): Promise<MasterWorkflowState> {
    this.logger.error(`❌ Handling workflow error for session ${state.masterSessionId}: ${error.message}`);
    
    const updatedState = {
      ...state,
      error: error.message,
      retryCount: state.retryCount + 1,
      stage: 'error'
    };
    
    // Implement retry logic or fallback strategies here
    if (state.retryCount < 3) {
      updatedState.fallbackStrategy = 'retry_current_workflow';
    } else {
      updatedState.fallbackStrategy = 'manual_intervention_required';
    }
    
    return updatedState;
  }

  /**
   * 📡 Event listeners for cross-workflow communication
   */
  private setupEventListeners(): void {
    // Listen for Google Calendar events
    this.eventEmitter.on('google.calendar.event_created', this.handleCalendarEvent.bind(this));
    this.eventEmitter.on('google.calendar.meeting_ended', this.handleMeetingEnded.bind(this));
    
    // Listen for workflow completion events
    this.eventEmitter.on('calendar.workflow.completed', this.handleCalendarCompleted.bind(this));
    this.eventEmitter.on('meeting.analysis.completed', this.handleMeetingAnalysisCompleted.bind(this));
    this.eventEmitter.on('email.triage.completed', this.handleEmailTriageCompleted.bind(this));
  }

  private async handleCalendarEvent(event: any): Promise<void> {
    await this.orchestrateWorkflows({
      type: 'google_calendar_event',
      source: 'google_webhook',
      data: event,
      priority: 'medium'
    });
  }

  private async handleMeetingEnded(event: any): Promise<void> {
    await this.orchestrateWorkflows({
      type: 'meeting_ended',
      source: 'google_webhook', 
      data: event,
      priority: 'high'
    });
  }

  private handleCalendarCompleted(event: any): void {
    this.logger.log(`📅 Calendar workflow completed for session ${event.sessionId}`);
  }

  private handleMeetingAnalysisCompleted(event: any): void {
    this.logger.log(`🎤 Meeting analysis completed for session ${event.sessionId}`);
  }

  private handleEmailTriageCompleted(event: any): void {
    this.logger.log(`✉️ Email triage completed for session ${event.sessionId}`);
  }

  /**
   * 📊 Public methods for monitoring and control
   */
  async getMasterSessionStatus(masterSessionId: string): Promise<MasterWorkflowState | null> {
    return this.activeSessions.get(masterSessionId) || null;
  }

  async getAllActiveSessions(): Promise<MasterWorkflowState[]> {
    return Array.from(this.activeSessions.values());
  }

  async cancelMasterSession(masterSessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(masterSessionId);
    if (session) {
      // Cancel individual workflows
      // Implementation depends on individual workflow cancellation capabilities
      this.activeSessions.delete(masterSessionId);
      return true;
    }
    return false;
  }
} 