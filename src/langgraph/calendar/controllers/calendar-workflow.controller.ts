import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { CalendarWorkflowService, WorkflowStartOptions, WorkflowExecutionResult } from '../services/calendar-workflow.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../../auth/user/get-user.decorator';
import { CalendarEvent } from '../../../calendar/interfaces/calendar-event.interface';
import { CalendarWorkflowOptions } from '../interfaces/calendar-workflow-state.interface';

// Enhanced Meeting Integration Services
import { GoogleMeetingTrackerService, MeetingRecording } from '../services/google-meeting-tracker.service';
import { MeetingAnalysisTriggerService } from '../services/meeting-analysis-trigger.service';
import { EnhancedGoogleOAuthService } from '../services/enhanced-google-oauth.service';
import { CalendarWorkflowIntegrationService } from '../services/calendar-workflow-integration.service';

export class StartWorkflowDto {
  calendarEvent: CalendarEvent;
  options?: CalendarWorkflowOptions;
}

export class TestWorkflowDto {
  meetingTitle: string;
  participantEmails: string[];
  startTime: string;
  endTime: string;
  description?: string;
  options?: CalendarWorkflowOptions;
}

// Phase 2 DTOs
export class TriggerAnalysisDto {
  eventId: string;
  calendarEvent: CalendarEvent;
  forceWithoutRecording?: boolean;
  testTranscript?: string;
}

export class TestMeetingDto {
  eventId: string;
  transcriptFile: string;
}

export class WorkflowStatusResponse {
  sessionId: string;
  status: 'completed' | 'failed' | 'in_progress';
  stage: string;
  progress: number;
  error?: string;
  result?: any;
}

export class UserStatsResponse {
  totalWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  averageCompletionTime: number;
  recentWorkflows: any[];
}

@ApiTags('Calendar Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar-workflow')
export class CalendarWorkflowController {
  private readonly logger = new Logger(CalendarWorkflowController.name);

  constructor(
    private readonly workflowService: CalendarWorkflowService,
    // Enhanced Meeting Integration Services
    private readonly googleMeetingTracker: GoogleMeetingTrackerService,
    private readonly meetingAnalysisTrigger: MeetingAnalysisTriggerService,
    private readonly enhancedOAuth: EnhancedGoogleOAuthService,
    private readonly workflowIntegration: CalendarWorkflowIntegrationService,
  ) {}

  @Post('start')
  @ApiOperation({ 
    summary: 'Start a new calendar workflow',
    description: 'Initiates a new calendar workflow for meeting preparation and analysis'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Workflow started successfully',
    type: WorkflowStatusResponse
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async startWorkflow(
    @Body() startWorkflowDto: StartWorkflowDto,
    @GetUser() user: any
  ): Promise<WorkflowStatusResponse> {
    this.logger.log(`Starting workflow for user ${user.userId} and event ${startWorkflowDto.calendarEvent.id}`);

    try {
      // Validate input
      if (!startWorkflowDto.calendarEvent || !startWorkflowDto.calendarEvent.id) {
        throw new HttpException('Valid calendar event is required', HttpStatus.BAD_REQUEST);
      }

      const options: WorkflowStartOptions = {
        calendarEvent: startWorkflowDto.calendarEvent,
        userId: user.userId,
        options: {
          generateBrief: true,
          deliverBrief: true,
          useRAG: true,
          autonomyLevel: 'assisted',
          ...startWorkflowDto.options
        }
      };

      const result = await this.workflowService.startWorkflow(options);

      return {
        sessionId: result.sessionId,
        status: result.status,
        stage: result.stage,
        progress: result.progress,
        error: result.error,
        result: result.result
      };
    } catch (error) {
      this.logger.error(`Error starting workflow: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to start calendar workflow',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status/:sessionId')
  @ApiOperation({ 
    summary: 'Get workflow status',
    description: 'Retrieves the current status and progress of a calendar workflow'
  })
  @ApiParam({ name: 'sessionId', description: 'The workflow session ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow status retrieved successfully',
    type: WorkflowStatusResponse
  })
  @ApiResponse({ status: 404, description: 'Workflow session not found' })
  async getWorkflowStatus(
    @Param('sessionId') sessionId: string,
    @GetUser() user: any
  ): Promise<WorkflowStatusResponse> {
    this.logger.log(`Getting workflow status for session ${sessionId}`);

    try {
      const result = await this.workflowService.getWorkflowStatus(sessionId);

      if (!result) {
        throw new HttpException('Workflow session not found', HttpStatus.NOT_FOUND);
      }

      // TODO: Add authorization check to ensure user owns this workflow

      return {
        sessionId: result.sessionId,
        status: result.status,
        stage: result.stage,
        progress: result.progress,
        error: result.error,
        result: result.result
      };
    } catch (error) {
      this.logger.error(`Error getting workflow status: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to retrieve workflow status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('cancel/:sessionId')
  @ApiOperation({ 
    summary: 'Cancel a workflow',
    description: 'Cancels an active calendar workflow'
  })
  @ApiParam({ name: 'sessionId', description: 'The workflow session ID to cancel' })
  @ApiResponse({ status: 200, description: 'Workflow cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Workflow session not found' })
  async cancelWorkflow(
    @Param('sessionId') sessionId: string,
    @GetUser() user: any
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Cancelling workflow session ${sessionId}`);

    try {
      // TODO: Add authorization check to ensure user owns this workflow

      const success = await this.workflowService.cancelWorkflow(sessionId);

      if (!success) {
        throw new HttpException('Workflow session not found or already completed', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'Workflow cancelled successfully'
      };
    } catch (error) {
      this.logger.error(`Error cancelling workflow: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to cancel workflow',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('user/stats')
  @ApiOperation({ 
    summary: 'Get user workflow statistics',
    description: 'Retrieves workflow statistics for the current user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User statistics retrieved successfully',
    type: UserStatsResponse
  })
  async getUserStats(
    @GetUser() user: any
  ): Promise<UserStatsResponse> {
    this.logger.log(`Getting workflow stats for user ${user.userId}`);

    try {
      const stats = await this.workflowService.getUserWorkflowStats(user.userId);

      return {
        totalWorkflows: stats.totalWorkflows,
        completedWorkflows: stats.completedWorkflows,
        failedWorkflows: stats.failedWorkflows,
        averageCompletionTime: stats.averageCompletionTime,
        recentWorkflows: stats.recentWorkflows
      };
    } catch (error) {
      this.logger.error(`Error getting user stats: ${error.message}`);
      
      throw new HttpException(
        'Failed to retrieve user statistics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('workflows')
  @ApiOperation({ 
    summary: 'Get user workflows',
    description: 'Retrieves a list of workflows for the current user'
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of workflows to return (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of workflows to skip (default: 0)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by workflow status' })
  @ApiResponse({ status: 200, description: 'Workflows retrieved successfully' })
  async getUserWorkflows(
    @GetUser() user: any,
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
    @Query('status') status?: string
  ): Promise<any[]> {
    this.logger.log(`Getting workflows for user ${user.userId}`);

    try {
      // This would need to be implemented in the workflow service
      // For now, return empty array
      return [];
    } catch (error) {
      this.logger.error(`Error getting user workflows: ${error.message}`);
      
      throw new HttpException(
        'Failed to retrieve workflows',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('test-workflow')
  @ApiOperation({ 
    summary: 'Test workflow with sample data',
    description: 'Creates a test workflow for development and testing purposes'
  })
  @ApiResponse({ status: 201, description: 'Test workflow started successfully' })
  async testWorkflow(
    @Body() dto: TestWorkflowDto,
    @GetUser() user: any
  ): Promise<WorkflowStatusResponse> {
    this.logger.log(`Starting test workflow for user ${user.userId}`);

    try {
      // Create test calendar event
      const testEvent: CalendarEvent = {
        id: `test-${Date.now()}`,
        title: dto.meetingTitle,
        description: dto.description,
        startTime: dto.startTime,
        endTime: dto.endTime,
        location: 'Test Location',
        attendees: dto.participantEmails.map(email => ({
          email,
          displayName: email.split('@')[0],
          responseStatus: 'accepted',
        })),
        organizer: {
          email: 'test@example.com',
          displayName: 'Test Organizer',
          responseStatus: 'accepted',
          organizer: true,
        },
        status: 'confirmed',
        calendarId: 'primary',
        provider: 'google',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      const options: WorkflowStartOptions = {
        calendarEvent: testEvent,
        userId: user.userId,
        options: {
          generateBrief: true,
          deliverBrief: false, // Don't actually deliver for test
          useRAG: true,
          autonomyLevel: 'assisted'
        }
      };

      const result = await this.workflowService.startWorkflow(options);

      return {
        sessionId: result.sessionId,
        status: result.status,
        stage: result.stage,
        progress: result.progress,
        error: result.error,
        result: result.result
      };
    } catch (error) {
      this.logger.error(`Error starting test workflow: ${error.message}`);
      
      throw new HttpException(
        'Failed to start test workflow',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ========== PHASE 2: Real Meeting Integration Endpoints ==========

  @Post('meeting/track-start/:eventId')
  @ApiOperation({ summary: 'Track meeting start (Phase 2)' })
  @ApiParam({ name: 'eventId', description: 'Calendar event ID' })
  @ApiResponse({ status: 201, description: 'Meeting tracking started' })
  async trackMeetingStart(
    @Param('eventId') eventId: string,
    @GetUser() user: any,
  ) {
    const userId = user.userId || user.id;
    
    try {
      const meetingSession = await this.googleMeetingTracker.trackMeetingStart(eventId, userId);
      
      this.logger.log(`✅ Meeting tracking started for ${eventId}: ${meetingSession.sessionId}`);
      
      return {
        success: true,
        eventId,
        sessionId: meetingSession.sessionId,
        recordingEnabled: meetingSession.recordingEnabled,
        transcriptionEnabled: meetingSession.transcriptionEnabled,
        message: 'Meeting tracking started successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error tracking meeting start: ${error.message}`);
      return {
        success: false,
        eventId,
        error: error.message,
        message: 'Failed to start meeting tracking'
      };
    }
  }

  @Post('meeting/track-end/:eventId')
  @ApiOperation({ summary: 'Track meeting end (Phase 2)' })
  @ApiParam({ name: 'eventId', description: 'Calendar event ID' })
  @ApiResponse({ status: 200, description: 'Meeting tracking ended' })
  async trackMeetingEnd(
    @Param('eventId') eventId: string,
    @GetUser() user: any,
  ) {
    const userId = user.userId || user.id;
    
    try {
      const meetingSession = await this.googleMeetingTracker.trackMeetingEnd(eventId, userId);
      
      if (!meetingSession) {
        return {
          success: false,
          eventId,
          error: 'No active meeting session found',
          message: 'Meeting was not being tracked'
        };
      }

      this.logger.log(`✅ Meeting tracking ended for ${eventId}: ${meetingSession.sessionId}`);
      
      return {
        success: true,
        eventId,
        sessionId: meetingSession.sessionId,
        duration: meetingSession.endTime ? 
          Math.round((new Date(meetingSession.endTime).getTime() - new Date(meetingSession.startTime).getTime()) / (1000 * 60)) : 
          0,
        participantCount: meetingSession.participants.length,
        message: 'Meeting tracking ended successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error tracking meeting end: ${error.message}`);
      return {
        success: false,
        eventId,
        error: error.message,
        message: 'Failed to end meeting tracking'
      };
    }
  }

  @Get('meeting/recording/:eventId')
  @ApiOperation({ summary: 'Get meeting recording data (Phase 2)' })
  @ApiParam({ name: 'eventId', description: 'Calendar event ID' })
  @ApiResponse({ status: 200, description: 'Meeting recording data' })
  async getMeetingRecording(
    @Param('eventId') eventId: string,
    @GetUser() user: any,
  ): Promise<{ recording: MeetingRecording | null; message: string }> {
    const userId = user.userId || user.id;
    
    try {
      const recording = await this.googleMeetingTracker.getMeetingRecording(eventId, userId);
      
      return {
        recording,
        message: recording ? 'Recording found' : 'No recording available'
      };
    } catch (error) {
      this.logger.error(`❌ Error getting meeting recording: ${error.message}`);
      return {
        recording: null,
        message: `Error getting recording: ${error.message}`
      };
    }
  }

  @Get('meeting/transcript/:eventId')
  @ApiOperation({ summary: 'Get meeting transcript (Phase 2)' })
  @ApiParam({ name: 'eventId', description: 'Calendar event ID' })
  @ApiResponse({ status: 200, description: 'Meeting transcript' })
  async getMeetingTranscript(
    @Param('eventId') eventId: string,
    @GetUser() user: any,
  ) {
    const userId = user.userId || user.id;
    
    try {
      const transcript = await this.googleMeetingTracker.extractMeetingTranscript(eventId, userId);
      
      return {
        eventId,
        transcript,
        available: !!transcript,
        length: transcript ? transcript.length : 0,
        message: transcript ? 'Transcript extracted successfully' : 'No transcript available'
      };
    } catch (error) {
      this.logger.error(`❌ Error getting meeting transcript: ${error.message}`);
      return {
        eventId,
        transcript: null,
        available: false,
        length: 0,
        message: `Error getting transcript: ${error.message}`
      };
    }
  }

  @Post('analysis/trigger')
  @ApiOperation({ summary: 'Manually trigger meeting analysis (Phase 2)' })
  @ApiBody({ type: TriggerAnalysisDto })
  @ApiResponse({ status: 201, description: 'Meeting analysis triggered' })
  async triggerMeetingAnalysis(
    @Body() dto: TriggerAnalysisDto,
    @GetUser() user: any,
  ) {
    const userId = user.userId || user.id;
    
    try {
      const result = await this.meetingAnalysisTrigger.manuallyTriggerAnalysis(
        dto.eventId,
        userId,
        dto.calendarEvent,
        {
          forceWithoutRecording: dto.forceWithoutRecording,
          testTranscript: dto.testTranscript
        }
      );
      
      this.logger.log(`✅ Meeting analysis triggered for ${dto.eventId}: ${result.sessionId}`);
      
      return {
        success: true,
        eventId: dto.eventId,
        triggerId: result.triggerId,
        sessionId: result.sessionId,
        status: result.status,
        message: 'Meeting analysis triggered successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error triggering meeting analysis: ${error.message}`);
      return {
        success: false,
        eventId: dto.eventId,
        error: error.message,
        message: 'Failed to trigger meeting analysis'
      };
    }
  }

  @Get('analysis/status')
  @ApiOperation({ summary: 'Get meeting analysis status (Phase 2)' })
  @ApiResponse({ status: 200, description: 'Analysis status overview' })
  async getAnalysisStatus() {
    try {
      const status = this.meetingAnalysisTrigger.getAnalysisStatus();
      
      return {
        ...status,
        message: `${status.pending} pending, ${status.active} active analysis workflows`
      };
    } catch (error) {
      this.logger.error(`❌ Error getting analysis status: ${error.message}`);
      return {
        pending: 0,
        active: 0,
        pendingChecks: 0,
        pendingTriggers: [],
        activeWorkflows: [],
        message: `Error getting status: ${error.message}`
      };
    }
  }

  @Get('meetings/active')
  @ApiOperation({ summary: 'Get active meetings being tracked (Phase 2)' })
  @ApiResponse({ status: 200, description: 'List of active meetings' })
  async getActiveMeetings() {
    try {
      const activeMeetings = this.googleMeetingTracker.getActiveMeetings();
      
      return {
        activeMeetings,
        count: activeMeetings.length,
        message: `${activeMeetings.length} active meetings being tracked`
      };
    } catch (error) {
      this.logger.error(`❌ Error getting active meetings: ${error.message}`);
      return {
        activeMeetings: [],
        count: 0,
        message: `Error getting active meetings: ${error.message}`
      };
    }
  }

  // ========== PHASE 2: OAuth Scope Management Endpoints ==========

  @Get('oauth/scopes/status')
  @ApiOperation({ summary: 'Get OAuth scope status for meeting integration (Phase 2)' })
  @ApiResponse({ status: 200, description: 'OAuth scope status' })
  async getOAuthScopeStatus(@GetUser() user: any) {
    const userId = user.userId || user.id;
    
    try {
      const scopeStatus = await this.enhancedOAuth.getScopeStatus(userId);
      const meetingPermissions = await this.enhancedOAuth.validateMeetingIntegrationPermissions(userId);
      
      return {
        ...scopeStatus,
        meetingIntegration: meetingPermissions,
        message: `OAuth status: ${scopeStatus.overall}`
      };
    } catch (error) {
      this.logger.error(`❌ Error getting OAuth scope status: ${error.message}`);
      return {
        overall: 'insufficient',
        categories: {},
        recommendations: [],
        meetingIntegration: {
          canAccessRecordings: false,
          canAccessTranscripts: false,
          canAccessDrive: false,
          recommendations: ['Re-authenticate with Google']
        },
        message: `Error getting OAuth status: ${error.message}`
      };
    }
  }

  @Post('oauth/reauthorize')
  @ApiOperation({ summary: 'Generate reauthorization URL with enhanced scopes (Phase 2)' })
  @ApiResponse({ status: 200, description: 'Reauthorization URL generated' })
  async generateReauthorizationUrl(@GetUser() user: any) {
    const userId = user.userId || user.id;
    
    try {
      const reauth = await this.enhancedOAuth.generateReauthorizationUrl(userId);
      
      return {
        ...reauth,
        message: 'Reauthorization URL generated successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error generating reauthorization URL: ${error.message}`);
      return {
        authUrl: null,
        missingScopes: [],
        reason: 'Error generating reauthorization URL',
        message: error.message
      };
    }
  }

  // ========== PHASE 2: Testing & Development Endpoints ==========

  @Post('test/simulate-meeting')
  @ApiOperation({ summary: 'Simulate real meeting with test data (Phase 2 - Development Only)' })
  @ApiBody({ type: TestMeetingDto })
  @ApiResponse({ status: 201, description: 'Meeting simulation completed' })
  async simulateMeetingWithTestData(
    @Body() dto: TestMeetingDto,
    @GetUser() user: any,
  ) {
    const userId = user.userId || user.id;
    
    try {
      const simulatedRecording = await this.googleMeetingTracker.simulateRealMeetingWithTestData(
        dto.eventId,
        dto.transcriptFile,
        userId
      );
      
      this.logger.log(`🧪 TESTING: Simulated meeting for ${dto.eventId}`);
      
      return {
        success: true,
        eventId: dto.eventId,
        simulatedRecording,
        message: 'Meeting simulation completed successfully'
      };
    } catch (error) {
      this.logger.error(`🧪 TESTING: Error simulating meeting: ${error.message}`);
      return {
        success: false,
        eventId: dto.eventId,
        error: error.message,
        message: 'Meeting simulation failed'
      };
    }
  }

  @Get('test/phase2-status')
  @ApiOperation({ summary: 'Get Phase 2 implementation status (Development Only)' })
  @ApiResponse({ status: 200, description: 'Phase 2 status overview' })
  async getPhase2Status() {
    try {
      const analysisStatus = this.meetingAnalysisTrigger.getAnalysisStatus();
      const activeMeetings = this.googleMeetingTracker.getActiveMeetings();
      
      return {
        phase: 'Phase 2: Real Meeting Integration',
        status: 'Active',
        features: {
          meetingTracking: {
            implemented: true,
            activeMeetings: activeMeetings.length,
            description: 'Google Meet recording and transcript access'
          },
          analysisTrigger: {
            implemented: true,
            pendingAnalysis: analysisStatus.pending,
            activeWorkflows: analysisStatus.active,
            description: 'Automated meeting analysis triggers'
          },
          enhancedOAuth: {
            implemented: true,
            description: 'Enhanced OAuth scopes for Drive and Meet access'
          }
        },
        nextSteps: [
          'Complete Milestone 2.2: Enhanced Testing Infrastructure',
          'Implement Milestone 2.3: Workflow Integration & Communication',
          'Test with real Google Workspace environment'
        ],
        message: 'Phase 2 core features implemented and ready for testing'
      };
    } catch (error) {
      return {
        phase: 'Phase 2: Real Meeting Integration',
        status: 'Error',
        error: error.message,
        message: 'Error getting Phase 2 status'
      };
    }
  }

  // ========== MILESTONE 2.3: Phase 1-2 Integration Endpoints ==========

  @Get('integration/status')
  @ApiOperation({ summary: 'Get Phase 1-2 integration status (Milestone 2.3)' })
  @ApiResponse({ status: 200, description: 'Integration status overview' })
  async getIntegrationStatus() {
    try {
      const integrationStatus = this.workflowIntegration.getIntegrationStatus();
      
      return {
        ...integrationStatus,
        milestone: 'Milestone 2.3: Workflow Integration & Communication',
        message: `Integration status: ${integrationStatus.coreConnected && integrationStatus.enhancedServicesActive ? 'Active' : 'Partial'}`
      };
    } catch (error) {
      this.logger.error(`❌ Error getting integration status: ${error.message}`);
      return {
        coreConnected: false,
        enhancedServicesActive: false,
        eventListenersRegistered: false,
        activeIntegrations: {},
        statistics: { eventsProcessed: 0, workflowsTriggered: 0, integrationErrors: 1 },
        message: `Error getting integration status: ${error.message}`
      };
    }
  }

  @Get('integration/workflows')
  @ApiOperation({ summary: 'Get active integrated workflows (Milestone 2.3)' })
  @ApiResponse({ status: 200, description: 'Active integrated workflows' })
  async getActiveIntegratedWorkflows() {
    try {
      const workflows = this.workflowIntegration.getActiveWorkflows();
      
      return {
        workflows,
        count: workflows.length,
        message: `${workflows.length} active integrated workflows`
      };
    } catch (error) {
      this.logger.error(`❌ Error getting integrated workflows: ${error.message}`);
      return {
        workflows: [],
        count: 0,
        message: `Error getting integrated workflows: ${error.message}`
      };
    }
  }

  @Get('integration/workflow/:eventId')
  @ApiOperation({ summary: 'Get specific integrated workflow data (Milestone 2.3)' })
  @ApiParam({ name: 'eventId', description: 'Calendar event ID' })
  @ApiResponse({ status: 200, description: 'Integrated workflow data' })
  async getIntegratedWorkflowData(@Param('eventId') eventId: string) {
    try {
      const workflowData = this.workflowIntegration.getWorkflowData(eventId);
      
      if (!workflowData) {
        return {
          found: false,
          eventId,
          message: 'No integrated workflow data found for this event'
        };
      }

      return {
        found: true,
        eventId,
        workflowData,
        message: 'Integrated workflow data retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Error getting workflow data: ${error.message}`);
      return {
        found: false,
        eventId,
        error: error.message,
        message: 'Error retrieving workflow data'
      };
    }
  }

  @Post('integration/cleanup')
  @ApiOperation({ summary: 'Clean up completed integrated workflows (Milestone 2.3)' })
  @ApiQuery({ name: 'hours', description: 'Clean workflows older than X hours', required: false })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  async cleanupCompletedWorkflows(@Query('hours') hours: string = '24') {
    try {
      const hoursNum = parseInt(hours, 10) || 24;
      const cleanedCount = this.workflowIntegration.cleanupCompletedWorkflows(hoursNum);
      
      return {
        success: true,
        cleanedCount,
        hoursThreshold: hoursNum,
        message: `Cleaned up ${cleanedCount} completed workflows older than ${hoursNum} hours`
      };
    } catch (error) {
      this.logger.error(`❌ Error cleaning up workflows: ${error.message}`);
      return {
        success: false,
        cleanedCount: 0,
        error: error.message,
        message: 'Failed to clean up workflows'
      };
    }
  }
} 