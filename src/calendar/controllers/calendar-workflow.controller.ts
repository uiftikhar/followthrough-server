import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { UnifiedWorkflowService } from '../../langgraph/unified-workflow.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CalendarSyncService } from '../services/calendar-sync.service';
import { CalendarWebhookService, GoogleWebhookNotification, OutlookWebhookNotification } from '../services/calendar-webhook.service';
import { CalendarEvent } from '../interfaces/calendar-event.interface';

export class CalendarSyncDto {
  type: 'calendar_sync' | 'meeting_brief' | 'meeting_prep';
  eventId?: string;
  hoursAhead?: number;
  metadata?: Record<string, any>;
}

export interface SessionInfoDto {
  sessionId: string;
  status: string;
}

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarWorkflowController {
  constructor(
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
    private readonly calendarSyncService: CalendarSyncService,
    private readonly calendarWebhookService: CalendarWebhookService,
  ) {}

  /**
   * Sync calendar events
   */
  @Post('sync')
  async syncCalendar(
    @Body() dto: CalendarSyncDto,
    @Request() req
  ): Promise<SessionInfoDto> {
    const userId = req.user?.userId || req.user?.id;
    
    const input = {
      type: dto.type,
      userId,
      eventId: dto.eventId,
      hoursAhead: dto.hoursAhead,
    };

    return this.unifiedWorkflowService.processInput(input, dto.metadata, userId);
  }

  /**
   * Request meeting brief generation
   */
  @Post('brief/:eventId')
  async generateMeetingBrief(
    @Param('eventId') eventId: string,
    @Body() metadata: Record<string, any> = {},
    @Request() req
  ): Promise<SessionInfoDto> {
    const userId = req.user?.userId || req.user?.id;
    
    const input = {
      type: 'meeting_brief',
      userId,
      eventId,
      metadata,
    };

    return this.unifiedWorkflowService.processInput(input, metadata, userId);
  }

  /**
   * Get calendar sync status
   */
  @Get('sync/status')
  async getSyncStatus(@Request() req) {
    const userId = req.user?.userId || req.user?.id;
    return {
      userId,
      synced: this.calendarSyncService.isCalendarSynced(userId),
      status: this.calendarSyncService.getSyncStatus(userId),
    };
  }

  // 🚀 NEW: Webhook endpoints for calendar automation

  /**
   * Google Calendar webhook endpoint
   */
  @Post('webhook/google')
  async handleGoogleWebhook(@Body() notification: GoogleWebhookNotification): Promise<{ status: string }> {
    await this.calendarWebhookService.handleGoogleWebhook(notification);
    return { status: 'processed' };
  }

  /**
   * Outlook Calendar webhook endpoint
   */
  @Post('webhook/outlook')
  async handleOutlookWebhook(@Body() notification: OutlookWebhookNotification): Promise<{ status: string }> {
    await this.calendarWebhookService.handleOutlookWebhook(notification);
    return { status: 'processed' };
  }

  /**
   * Schedule a pre-meeting brief (for testing/manual triggers)
   */
  @Post('schedule-brief/:eventId')
  async schedulePreMeetingBrief(
    @Param('eventId') eventId: string,
    @Body() calendarEvent: CalendarEvent,
    @Request() req
  ): Promise<{ status: string; message: string }> {
    const userId = req.user?.userId || req.user?.id;
    
    await this.calendarWebhookService.schedulePreMeetingBrief(calendarEvent, userId);
    
    return {
      status: 'scheduled',
      message: `Pre-meeting brief scheduled for event ${eventId}`
    };
  }

  /**
   * Manually trigger meeting start event (for testing)
   */
  @Post('events/start/:eventId')
  async triggerMeetingStart(
    @Param('eventId') eventId: string,
    @Body() calendarEvent: CalendarEvent,
    @Request() req
  ): Promise<{ status: string; message: string }> {
    const userId = req.user?.userId || req.user?.id;
    
    await this.calendarWebhookService.handleMeetingStarted(calendarEvent, userId);
    
    return {
      status: 'triggered',
      message: `Meeting start event triggered for ${eventId}`
    };
  }

  /**
   * Manually trigger meeting end event (for testing)
   */
  @Post('events/end/:eventId')
  async triggerMeetingEnd(
    @Param('eventId') eventId: string,
    @Body() calendarEvent: CalendarEvent,
    @Request() req
  ): Promise<{ status: string; message: string }> {
    const userId = req.user?.userId || req.user?.id;
    
    await this.calendarWebhookService.handleMeetingEnded(calendarEvent, userId);
    
    return {
      status: 'triggered',
      message: `Meeting end event triggered for ${eventId}`
    };
  }

  /**
   * Manually trigger transcript available event (for testing)
   */
  @Post('events/transcript/:eventId')
  async triggerTranscriptAvailable(
    @Param('eventId') eventId: string,
    @Body() body: { calendarEvent: CalendarEvent; transcript: string },
    @Request() req
  ): Promise<{ status: string; message: string }> {
    const userId = req.user?.userId || req.user?.id;
    
    await this.calendarWebhookService.handleTranscriptAvailable(
      body.calendarEvent,
      body.transcript,
      userId
    );
    
    return {
      status: 'triggered',
      message: `Transcript processing triggered for ${eventId}`
    };
  }

  /**
   * Get scheduled briefs status
   */
  @Get('scheduled-briefs')
  async getScheduledBriefs(): Promise<{ scheduledBriefs: string[] }> {
    return {
      scheduledBriefs: this.calendarWebhookService.getScheduledBriefs()
    };
  }
} 