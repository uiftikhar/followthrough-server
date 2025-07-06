import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MasterSupervisorService, WorkflowTrigger, MasterWorkflowState } from './master-supervisor.service';
import { EnhancedGoogleMeetingTrackerService, GoogleMeetingSession } from '../calendar/services/enhanced-google-meeting-tracker.service';
import { CalendarWorkflowIntegrationService } from '../calendar/services/calendar-workflow-integration.service';
import { UnifiedWorkflowService } from '../unified-workflow.service';

// DTOs for testing
export class TestCalendarEventDto {
  title: string;
  startTime: string;
  endTime: string;
  participants: string[];
  meetingLink?: string;
  description?: string;
}

export class TestMeetingTranscriptDto {
  eventId: string;
  transcript: string;
  participants: string[];
  duration?: number;
}

export class TestEndToEndDto {
  meetingTitle: string;
  participants: string[];
  transcript: string;
  duration?: number;
  simulateRealTime?: boolean;
  includeRecording?: boolean;
}

export class TestWorkflowTriggerDto {
  triggerType: 'calendar_event' | 'meeting_ended' | 'transcript_available';
  eventData: any;
  priority?: 'high' | 'medium' | 'low';
  userId: string;
}

@ApiTags('Master Testing')
@Controller('api/test/master-workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MasterTestingController {
  private readonly logger = new Logger(MasterTestingController.name);

  constructor(
    private readonly masterSupervisor: MasterSupervisorService,
    private readonly meetingTracker: EnhancedGoogleMeetingTrackerService,
    private readonly workflowIntegration: CalendarWorkflowIntegrationService,
    private readonly unifiedWorkflow: UnifiedWorkflowService,
  ) {}

  /**
   * 🚀 **PRIMARY END-TO-END TEST** - Complete Google Workspace Flow
   */
  @Post('end-to-end')
  @ApiOperation({ 
    summary: 'Test complete end-to-end workflow: Calendar → Meeting → Analysis → Email Actions',
    description: 'Simulates a complete Google Workspace integration flow with real API calls but controlled test data'
  })
  @ApiResponse({ status: 200, description: 'End-to-end test completed successfully' })
  async testEndToEndWorkflow(
    @Body() testData: TestEndToEndDto,
    @Request() req,
  ): Promise<{
    testId: string;
    phases: {
      calendar: { status: string; sessionId?: string; duration: number };
      meeting: { status: string; sessionId?: string; duration: number };
      analysis: { status: string; sessionId?: string; duration: number };
      email: { status: string; sessionId?: string; duration: number };
    };
    masterWorkflowState: MasterWorkflowState;
    results: {
      calendarEvent?: any;
      meetingSession?: GoogleMeetingSession;
      analysisResults?: any;
      emailDrafts?: any[];
    };
    totalDuration: number;
    success: boolean;
  }> {
    const userId = req.user?.userId || req.user?.id;
    const testId = `e2e-test-${Date.now()}`;
    
    this.logger.log(`🚀 Starting end-to-end workflow test ${testId} for user ${userId}`);
    const startTime = Date.now();

    try {
      const results: any = {
        calendarEvent: null,
        meetingSession: null,
        analysisResults: null,
        emailDrafts: []
      };

      // **PHASE 1: Calendar Event Creation & Pre-Meeting Brief**
      this.logger.log(`📅 Phase 1: Testing calendar workflow`);
      const calendarPhaseStart = Date.now();
      
      const mockCalendarEvent = this.createMockCalendarEvent(testData, userId);
      
      // Trigger calendar workflow through master supervisor
      const calendarTrigger: WorkflowTrigger = {
        type: 'google_calendar_event',
        source: 'automated',
        data: {
          userId,
          calendarEvent: mockCalendarEvent,
          googleEvent: mockCalendarEvent
        },
        priority: 'high'
      };

      const masterWorkflowState = await this.masterSupervisor.orchestrateWorkflows(calendarTrigger);
      results.calendarEvent = mockCalendarEvent;
      
      const calendarDuration = Date.now() - calendarPhaseStart;

      // **PHASE 2: Meeting Tracking & Recording Simulation**
      this.logger.log(`🎤 Phase 2: Testing meeting tracking`);
      const meetingPhaseStart = Date.now();
      
      // Start meeting tracking
      const meetingSession = await this.meetingTracker.trackMeetingStart(
        mockCalendarEvent.id,
        userId,
        {
          title: testData.meetingTitle,
          participants: testData.participants,
          startTime: mockCalendarEvent.startTime,
          endTime: mockCalendarEvent.endTime,
          meetingUrl: mockCalendarEvent.meetingLink
        }
      );

      // Simulate meeting end with transcript
      if (testData.simulateRealTime) {
        this.logger.log('⏳ Simulating real-time meeting flow...');
        await this.delay(2000); // 2 second delay to simulate meeting
      }

      await this.meetingTracker.trackMeetingEnd(mockCalendarEvent.id, userId);
      
      // Simulate transcript availability
      await this.simulateTranscriptAvailability(meetingSession.sessionId, testData.transcript);
      
      results.meetingSession = meetingSession;
      const meetingDuration = Date.now() - meetingPhaseStart;

      // **PHASE 3: Meeting Analysis Workflow**
      this.logger.log(`🔍 Phase 3: Testing meeting analysis`);
      const analysisPhaseStart = Date.now();
      
      const analysisTrigger: WorkflowTrigger = {
        type: 'meeting_ended',
        source: 'automated',
        data: {
          userId,
          calendarEvent: mockCalendarEvent,
          transcript: testData.transcript,
          meetingSession: meetingSession,
          recording: testData.includeRecording ? this.createMockRecording() : null
        },
        priority: 'high'
      };

      // Trigger analysis through master supervisor
      const analysisState = await this.masterSupervisor.orchestrateWorkflows(analysisTrigger);
      results.analysisResults = analysisState.analysisResults;
      
      const analysisDuration = Date.now() - analysisPhaseStart;

      // **PHASE 4: Email Generation & Triage**
      this.logger.log(`✉️ Phase 4: Testing email generation`);
      const emailPhaseStart = Date.now();
      
      if (results.analysisResults?.actionItems?.length > 0) {
        const emailTrigger: WorkflowTrigger = {
          type: 'email_received',
          source: 'automated',
          data: {
            userId,
            analysisResults: results.analysisResults,
            calendarEvent: mockCalendarEvent,
            emailType: 'follow_up_generation'
          },
          priority: 'medium'
        };

        const emailState = await this.masterSupervisor.orchestrateWorkflows(emailTrigger);
        results.emailDrafts = emailState.followUpActions;
      }
      
      const emailDuration = Date.now() - emailPhaseStart;

      const totalDuration = Date.now() - startTime;

      this.logger.log(`✅ End-to-end test ${testId} completed successfully in ${totalDuration}ms`);

      return {
        testId,
        phases: {
          calendar: { status: 'completed', sessionId: masterWorkflowState.activeWorkflows.calendar, duration: calendarDuration },
          meeting: { status: 'completed', sessionId: meetingSession.sessionId, duration: meetingDuration },
          analysis: { status: 'completed', sessionId: analysisState.activeWorkflows.meeting, duration: analysisDuration },
          email: { status: 'completed', sessionId: analysisState.activeWorkflows.email, duration: emailDuration }
        },
        masterWorkflowState: analysisState,
        results,
        totalDuration,
        success: true
      };

    } catch (error) {
      this.logger.error(`❌ End-to-end test ${testId} failed: ${error.message}`);
      
      return {
        testId,
        phases: {
          calendar: { status: 'failed', duration: 0 },
          meeting: { status: 'failed', duration: 0 },
          analysis: { status: 'failed', duration: 0 },
          email: { status: 'failed', duration: 0 }
        },
        masterWorkflowState: {} as any,
        results: {},
        totalDuration: Date.now() - startTime,
        success: false
      };
    }
  }

  /**
   * 🎯 Test Individual Workflow Components
   */
  @Post('calendar-workflow')
  @ApiOperation({ summary: 'Test calendar workflow in isolation' })
  async testCalendarWorkflow(
    @Body() eventData: TestCalendarEventDto,
    @Request() req,
  ): Promise<any> {
    const userId = req.user?.userId || req.user?.id;
    this.logger.log(`📅 Testing calendar workflow for user ${userId}`);

    try {
      const mockEvent = this.createMockCalendarEvent(eventData, userId);
      
      const trigger: WorkflowTrigger = {
        type: 'google_calendar_event',
        source: 'user_action',
        data: { userId, calendarEvent: mockEvent },
        priority: 'medium'
      };

      const result = await this.masterSupervisor.orchestrateWorkflows(trigger);
      
      return {
        success: true,
        calendarEvent: mockEvent,
        workflowState: result,
        message: 'Calendar workflow test completed'
      };
    } catch (error) {
      this.logger.error(`❌ Calendar workflow test failed: ${error.message}`);
      throw error;
    }
  }

  @Post('meeting-analysis')
  @ApiOperation({ summary: 'Test meeting analysis workflow in isolation' })
  async testMeetingAnalysis(
    @Body() transcriptData: TestMeetingTranscriptDto,
    @Request() req,
  ): Promise<any> {
    const userId = req.user?.userId || req.user?.id;
    this.logger.log(`🔍 Testing meeting analysis for user ${userId}`);

    try {
      const analysisInput = {
        type: 'meeting_transcript',
        transcript: transcriptData.transcript,
        participants: transcriptData.participants,
        meetingTitle: `Test Meeting Analysis - ${transcriptData.eventId}`,
        date: new Date().toISOString(),
        userId,
        metadata: {
          testMode: true,
          eventId: transcriptData.eventId
        }
      };

      const result = await this.unifiedWorkflow.processInput(analysisInput, analysisInput.metadata, userId);
      
      return {
        success: true,
        analysisResult: result,
        message: 'Meeting analysis test completed'
      };
    } catch (error) {
      this.logger.error(`❌ Meeting analysis test failed: ${error.message}`);
      throw error;
    }
  }

  @Post('email-generation')
  @ApiOperation({ summary: 'Test email generation workflow in isolation' })
  async testEmailGeneration(
    @Body() analysisData: any,
    @Request() req,
  ): Promise<any> {
    const userId = req.user?.userId || req.user?.id;
    this.logger.log(`✉️ Testing email generation for user ${userId}`);

    try {
      // Generate mock follow-up emails
      const emailDrafts = this.generateMockFollowUpEmails(analysisData);
      
             // Process through email triage
       const emailResults: any[] = [];
       for (const draft of emailDrafts) {
        const emailInput = {
          type: 'follow_up_email',
          emailDraft: draft,
          userId,
          metadata: { testMode: true }
        };

        const result = await this.unifiedWorkflow.processInput(emailInput, emailInput.metadata, userId);
        emailResults.push(result);
      }
      
      return {
        success: true,
        emailDrafts,
        emailResults,
        message: 'Email generation test completed'
      };
    } catch (error) {
      this.logger.error(`❌ Email generation test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔧 Test Google Workspace Integration Components
   */
  @Post('google-meet-tracking')
  @ApiOperation({ summary: 'Test Google Meet tracking and recording detection' })
  async testGoogleMeetTracking(
    @Body() meetingData: TestCalendarEventDto,
    @Request() req,
  ): Promise<any> {
    const userId = req.user?.userId || req.user?.id;
    this.logger.log(`🎤 Testing Google Meet tracking for user ${userId}`);

    try {
      const mockEvent = this.createMockCalendarEvent(meetingData, userId);
      
      // Start meeting tracking
      const session = await this.meetingTracker.trackMeetingStart(
        mockEvent.id,
        userId,
        {
          title: meetingData.title,
          participants: meetingData.participants,
          startTime: meetingData.startTime,
          endTime: meetingData.endTime,
          meetingUrl: meetingData.meetingLink
        }
      );

      // Simulate meeting end
      await this.delay(1000);
      const endedSession = await this.meetingTracker.trackMeetingEnd(mockEvent.id, userId);

      // Check recording availability (will simulate)
      await this.delay(1000);
      const recordingCheck = await this.meetingTracker.checkRecordingAvailability(session.sessionId);
      
      return {
        success: true,
        meetingSession: session,
        endedSession,
        recordingCheck,
        message: 'Google Meet tracking test completed'
      };
    } catch (error) {
      this.logger.error(`❌ Google Meet tracking test failed: ${error.message}`);
      throw error;
    }
  }

  @Post('workflow-integration')
  @ApiOperation({ summary: 'Test workflow integration service' })
  async testWorkflowIntegration(
    @Body() integrationData: any,
    @Request() req,
  ): Promise<any> {
    const userId = req.user?.userId || req.user?.id;
    this.logger.log(`🔗 Testing workflow integration for user ${userId}`);

    try {
      const status = this.workflowIntegration.getIntegrationStatus();
      const activeWorkflows = this.workflowIntegration.getActiveWorkflows();
      
      return {
        success: true,
        integrationStatus: status,
        activeWorkflows,
        message: 'Workflow integration test completed'
      };
    } catch (error) {
      this.logger.error(`❌ Workflow integration test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📊 Monitoring and Status Endpoints
   */
  @Get('master-sessions')
  @ApiOperation({ summary: 'Get all active master workflow sessions' })
  async getMasterSessions(): Promise<any> {
    try {
      const sessions = await this.masterSupervisor.getAllActiveSessions();
      
      return {
        success: true,
        sessions,
        count: sessions.length,
        message: `Found ${sessions.length} active master sessions`
      };
    } catch (error) {
      this.logger.error(`❌ Error getting master sessions: ${error.message}`);
      throw error;
    }
  }

  @Get('master-sessions/:sessionId')
  @ApiOperation({ summary: 'Get specific master workflow session' })
  async getMasterSession(@Param('sessionId') sessionId: string): Promise<any> {
    try {
      const session = await this.masterSupervisor.getMasterSessionStatus(sessionId);
      
      if (!session) {
        return { success: false, message: `Master session ${sessionId} not found` };
      }
      
      return {
        success: true,
        session,
        message: `Master session ${sessionId} details`
      };
    } catch (error) {
      this.logger.error(`❌ Error getting master session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  @Get('meeting-sessions')
  @ApiOperation({ summary: 'Get all active meeting tracking sessions' })
  async getMeetingSessions(@Query('userId') userId?: string): Promise<any> {
    try {
      const sessions = userId 
        ? await this.meetingTracker.getSessionsByUser(userId)
        : await this.meetingTracker.getAllActiveSessions();
      
      return {
        success: true,
        sessions,
        count: sessions.length,
        message: `Found ${sessions.length} meeting sessions`
      };
    } catch (error) {
      this.logger.error(`❌ Error getting meeting sessions: ${error.message}`);
      throw error;
    }
  }

  @Post('trigger-workflow')
  @ApiOperation({ summary: 'Manually trigger any workflow for testing' })
  async triggerWorkflow(
    @Body() triggerData: TestWorkflowTriggerDto,
    @Request() req,
  ): Promise<any> {
    this.logger.log(`🎯 Manual workflow trigger: ${triggerData.triggerType}`);

    try {
      const trigger: WorkflowTrigger = {
        type: triggerData.triggerType as any,
        source: 'user_action',
        data: {
          userId: triggerData.userId,
          ...triggerData.eventData
        },
        priority: triggerData.priority || 'medium'
      };

      const result = await this.masterSupervisor.orchestrateWorkflows(trigger);
      
      return {
        success: true,
        trigger,
        result,
        message: `Workflow ${triggerData.triggerType} triggered successfully`
      };
    } catch (error) {
      this.logger.error(`❌ Manual workflow trigger failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔧 Helper Methods
   */
  private createMockCalendarEvent(eventData: TestCalendarEventDto | TestEndToEndDto, userId: string): any {
    const eventId = `test-event-${Date.now()}`;
    
    return {
      id: eventId,
      summary: 'title' in eventData ? eventData.title : eventData.meetingTitle,
      start: { 
        dateTime: 'startTime' in eventData ? eventData.startTime : new Date().toISOString() 
      },
      end: { 
        dateTime: 'endTime' in eventData ? eventData.endTime : new Date(Date.now() + 60*60*1000).toISOString() 
      },
      attendees: eventData.participants.map(email => ({ email, displayName: email.split('@')[0] })),
      organizer: { email: `${userId}@example.com`, displayName: 'Test Organizer' },
      hangoutLink: 'meetingLink' in eventData ? eventData.meetingLink : `https://meet.google.com/test-${eventId}`,
      description: 'description' in eventData ? eventData.description : 'Test meeting for end-to-end workflow testing',
      status: 'confirmed',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
  }

  private createMockRecording(): any {
    return {
      driveFileId: `recording-${Date.now()}`,
      fileName: `Meeting Recording.mp4`,
      fileSize: 104857600, // 100MB
      downloadUrl: 'https://drive.google.com/file/d/mock-recording/view',
      createdTime: new Date().toISOString(),
      permissions: ['user@example.com']
    };
  }

  private generateMockFollowUpEmails(analysisData: any): any[] {
    return [
      {
        type: 'action_items_summary',
        to: ['participant1@example.com', 'participant2@example.com'],
        subject: 'Action Items from Test Meeting',
        actionItems: analysisData.actionItems || [],
        priority: 'medium'
      },
      {
        type: 'decisions_summary',
        to: ['organizer@example.com'],
        subject: 'Key Decisions from Test Meeting',
        decisions: analysisData.decisions || [],
        priority: 'high'
      }
    ];
  }

  private async simulateTranscriptAvailability(sessionId: string, transcript: string): Promise<void> {
    // Simulate transcript becoming available by directly updating the session
    // In real implementation, this would be triggered by Google Drive webhook
    this.logger.log(`📝 Simulating transcript availability for session ${sessionId}`);
    
    // This is a simulation - in real implementation, transcript would be detected via Google Drive API
    await this.delay(500);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 