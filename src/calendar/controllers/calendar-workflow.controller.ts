import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { UnifiedWorkflowService } from '../../langgraph/unified-workflow.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CalendarSyncService } from '../services/calendar-sync.service';
import { CalendarWebhookService, GoogleWebhookNotification, OutlookWebhookNotification } from '../services/calendar-webhook.service';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { GoogleCalendarService, GoogleCalendarChannelResponse } from '../services/google-calendar.service';
import { CalendarEventDetectionService } from '../services/calendar-event-detection.service';

export class CalendarSyncDto {
  type: 'calendar_sync' | 'meeting_brief' | 'meeting_prep';
  eventId?: string;
  hoursAhead?: number;
  metadata?: Record<string, any>;
}

export class CalendarBriefDto {
  eventId: string;
  metadata?: Record<string, any>;
}

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarWorkflowController {
  constructor(
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
    private readonly calendarSyncService: CalendarSyncService,
    private readonly calendarWebhookService: CalendarWebhookService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly eventDetectionService: CalendarEventDetectionService,
  ) {}

  /**
   * Trigger calendar sync workflow
   */
  @Post('sync')
  async syncCalendar(
    @Body() dto: CalendarSyncDto,
    @Request() req
  ): Promise<{ sessionId: string; status: string }> {
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
  ): Promise<{ sessionId: string; status: string }> {
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

  /**
   * Get upcoming calendar events
   */
  @Get('events/upcoming')
  async getUpcomingEvents(@Request() req): Promise<{ events: CalendarEvent[] }> {
    const userId = req.user?.userId || req.user?.id;
    const events = await this.calendarSyncService.getEventsHappeningSoon(userId);
    return { events };
  }

  /**
   * Get events happening soon (within 2 hours)
   */
  @Get('events/soon')
  async getEventsSoon(@Request() req): Promise<{ events: CalendarEvent[] }> {
    const userId = req.user?.userId || req.user?.id;
    const events = await this.calendarSyncService.getEventsHappeningSoon(userId);
    
    // Filter for events starting within 2 hours
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const soonEvents = events.filter(event => 
      new Date(event.startTime) <= twoHoursFromNow
    );
    
    return { events: soonEvents };
  }

  /**
   * Get next upcoming event
   */
  @Get('events/next')
  async getNextEvent(@Request() req): Promise<{ event: CalendarEvent | null; timeUntilStart?: string; minutesUntilStart?: number }> {
    const userId = req.user?.userId || req.user?.id;
    const event = await this.calendarSyncService.getNextUpcomingEvent(userId);
    
    if (!event) {
      return { event: null };
    }
    
    const now = new Date();
    const startTime = new Date(event.startTime);
    const minutesUntilStart = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));
    
    return {
      event,
      timeUntilStart: `${minutesUntilStart} minutes`,
      minutesUntilStart
    };
  }

  // 🚀 NEW: Push Notification Management Endpoints

  /**
   * Setup Google Calendar push notifications
   */
  @Post('notifications/setup')
  async setupPushNotifications(@Request() req): Promise<{
    status: string;
    channel?: GoogleCalendarChannelResponse;
    message: string;
  }> {
    const userId = req.user?.userId || req.user?.id;
    
    try {
      const channel = await this.googleCalendarService.setupPushNotifications(userId);
      
      return {
        status: 'success',
        channel,
        message: `Push notifications set up successfully for user ${userId}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to setup push notifications: ${error.message}`
      };
    }
  }

  /**
   * Check push notification status
   */
  @Get('notifications/status')
  async getNotificationStatus(@Request() req): Promise<{
    active: boolean;
    channel?: GoogleCalendarChannelResponse;
    message: string;
  }> {
    const userId = req.user?.userId || req.user?.id;
    
    try {
      const status = await this.googleCalendarService.checkChannelStatus(userId);
      
      if (status.active && status.channel) {
        return {
          active: true,
          channel: status.channel,
          message: `Push notifications are active for user ${userId}`
        };
      } else {
        return {
          active: false,
          message: `No active push notifications for user ${userId}`
        };
      }
    } catch (error) {
      return {
        active: false,
        message: `Error checking notification status: ${error.message}`
      };
    }
  }

  /**
   * Stop push notifications
   */
  @Post('notifications/stop')
  async stopPushNotifications(@Request() req): Promise<{
    status: string;
    message: string;
  }> {
    const userId = req.user?.userId || req.user?.id;
    
    try {
      await this.googleCalendarService.stopPushNotifications(userId);
      
      return {
        status: 'success',
        message: `Push notifications stopped for user ${userId}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to stop push notifications: ${error.message}`
      };
    }
  }

  /**
   * Renew push notification channel (before expiration)
   */
  @Post('notifications/renew')
  async renewPushNotifications(@Request() req): Promise<{
    status: string;
    channel?: GoogleCalendarChannelResponse;
    message: string;
  }> {
    const userId = req.user?.userId || req.user?.id;
    
    try {
      // Stop existing notifications and setup new ones
      await this.googleCalendarService.stopPushNotifications(userId);
      const channel = await this.googleCalendarService.setupPushNotifications(userId);
      
      return {
        status: 'success',
        channel,
        message: `Push notification channel renewed for user ${userId}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to renew push notifications: ${error.message}`
      };
    }
  }

  // 🚀 NEW: Event Detection and Statistics Endpoints

  /**
   * Get event detection statistics
   */
  @Get('events/stats')
  async getEventDetectionStats(): Promise<{
    stats: {
      processedEvents: number;
      trackedMeetings: number;
      activeStates: Record<string, number>;
    };
    message: string;
  }> {
    const stats = this.eventDetectionService.getProcessingStats();
    
    return {
      stats,
      message: 'Event detection statistics retrieved successfully'
    };
  }

  /**
   * Get meeting state for specific event
   */
  @Get('events/:eventId/state')
  async getMeetingState(
    @Param('eventId') eventId: string,
    @Request() req
  ): Promise<{
    state: string | undefined;
    eventId: string;
    userId: string;
    message: string;
  }> {
    const userId = req.user?.userId || req.user?.id;
    const state = this.eventDetectionService.getMeetingState(userId, eventId);
    
    return {
      state,
      eventId,
      userId,
      message: `Meeting state: ${state || 'unknown'}`
    };
  }

  /**
   * Get scheduled briefs
   */
  @Get('scheduled-briefs')
  async getScheduledBriefs(): Promise<{
    scheduledBriefs: string[];
    count: number;
    message: string;
  }> {
    const scheduledBriefs = this.calendarWebhookService.getScheduledBriefs();
    
    return {
      scheduledBriefs,
      count: scheduledBriefs.length,
      message: `Found ${scheduledBriefs.length} scheduled briefs`
    };
  }

  // 🚀 NEW: Testing and Development Endpoints

  /**
   * Manual trigger for pre-meeting brief (for testing)
   */
  @Post('schedule-brief/:eventId')
  async schedulePreMeetingBrief(
    @Param('eventId') eventId: string,
    @Body() event: CalendarEvent,
    @Request() req
  ): Promise<{ status: string; message: string }> {
    const userId = req.user?.userId || req.user?.id;
    
    try {
      await this.calendarWebhookService.schedulePreMeetingBrief(event, userId);
      
      return {
        status: 'success',
        message: `Pre-meeting brief scheduled for event ${eventId}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to schedule brief: ${error.message}`
      };
    }
  }

  /**
   * Manual trigger for meeting start (for testing)
   */
  @Post('events/start/:eventId')
  async triggerMeetingStart(
    @Param('eventId') eventId: string,
    @Body() event: CalendarEvent,
    @Request() req
  ): Promise<{ status: string; message: string }> {
    const userId = req.user?.userId || req.user?.id;
    
    try {
      await this.calendarWebhookService.handleMeetingStarted(event, userId);
      
      return {
        status: 'success',
        message: `Meeting start triggered for event ${eventId}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to trigger meeting start: ${error.message}`
      };
    }
  }

  /**
   * Manual trigger for meeting end (for testing)
   */
  @Post('events/end/:eventId')
  async triggerMeetingEnd(
    @Param('eventId') eventId: string,
    @Body() event: CalendarEvent,
    @Request() req
  ): Promise<{ status: string; message: string }> {
    const userId = req.user?.userId || req.user?.id;
    
    try {
      await this.calendarWebhookService.handleMeetingEnded(event, userId);
      
      return {
        status: 'success',
        message: `Meeting end triggered for event ${eventId}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to trigger meeting end: ${error.message}`
      };
    }
  }

  /**
   * Manual trigger for transcript processing (for testing)
   */
  @Post('events/transcript/:eventId')
  async processTranscript(
    @Param('eventId') eventId: string,
    @Body() body: { calendarEvent: CalendarEvent; transcript: string },
    @Request() req
  ): Promise<{ status: string; message: string }> {
    const userId = req.user?.userId || req.user?.id;
    
    try {
      await this.calendarWebhookService.handleTranscriptAvailable(
        body.calendarEvent,
        body.transcript,
        userId
      );
      
      return {
        status: 'success',
        message: `Transcript processing triggered for event ${eventId}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to process transcript: ${error.message}`
      };
    }
  }

  // 🚀 EXISTING: Webhook endpoints for calendar automation (keeping for backward compatibility)

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
} 