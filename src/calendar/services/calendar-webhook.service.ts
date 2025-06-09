import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CalendarWebhookConfig, CalendarEvent } from '../interfaces/calendar-event.interface';
import { CalendarWorkflowService } from './calendar-workflow.service';
import { UnifiedWorkflowService } from '../../langgraph/unified-workflow.service';

// Define webhook notification types
export interface GoogleWebhookNotification {
  kind: string;
  resourceId: string;
  resourceUri: string;
  token?: string;
  expiration?: string;
  type: 'sync';
  id: string;
}

export interface OutlookWebhookNotification {
  subscriptionId: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;
  tenantId?: string;
  clientState?: string;
}

export interface CalendarEventTrigger {
  eventType: 'meeting_starting' | 'meeting_started' | 'meeting_ended' | 'meeting_created' | 'meeting_updated';
  calendarEvent: CalendarEvent;
  userId: string;
  provider: 'google' | 'outlook' | 'apple';
  timestamp: string;
}

@Injectable()
export class CalendarWebhookService {
  private readonly logger = new Logger(CalendarWebhookService.name);
  private readonly webhooks = new Map<string, CalendarWebhookConfig>();
  private readonly scheduledBriefs = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly calendarWorkflowService: CalendarWorkflowService,
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
  ) {}

  /**
   * Register webhook for calendar notifications
   */
  async registerWebhook(userId: string, config: Partial<CalendarWebhookConfig>): Promise<string> {
    this.logger.log(`Registering webhook for user ${userId}`);
    
    const webhookId = `webhook-${userId}-${Date.now()}`;
    const webhookConfig: CalendarWebhookConfig = {
      id: webhookId,
      userId,
      provider: config.provider || 'google',
      resourceId: config.resourceId || 'primary',
      resourceUri: config.resourceUri || '',
      address: config.address || `${process.env.BASE_URL}/webhook/calendar`,
      token: config.token,
      expiration: config.expiration,
    };

    this.webhooks.set(webhookId, webhookConfig);
    
    // TODO: Implement actual webhook registration with Google Calendar API
    this.logger.log(`Webhook registered with ID: ${webhookId}`);
    
    return webhookId;
  }

  /**
   * 🚀 NEW: Handle Google Calendar webhook notifications
   */
  async handleGoogleWebhook(notification: GoogleWebhookNotification): Promise<void> {
    this.logger.log(`Handling Google webhook notification: ${notification.id}`);
    
    try {
      // Find the webhook configuration
      const webhook = Array.from(this.webhooks.values()).find(
        w => w.resourceId === notification.resourceId && w.provider === 'google'
      );

      if (!webhook) {
        this.logger.warn(`No webhook configuration found for resource: ${notification.resourceId}`);
        return;
      }

      // TODO: Fetch the actual event details from Google Calendar API
      // For now, simulate event detection
      await this.simulateEventDetection(webhook.userId, 'google');

    } catch (error) {
      this.logger.error(`Error handling Google webhook: ${error.message}`, error.stack);
    }
  }

  /**
   * 🚀 NEW: Handle Outlook webhook notifications
   */
  async handleOutlookWebhook(notification: OutlookWebhookNotification): Promise<void> {
    this.logger.log(`Handling Outlook webhook notification: ${notification.subscriptionId}`);
    
    try {
      // Find the webhook configuration
      const webhook = Array.from(this.webhooks.values()).find(
        w => w.resourceId === notification.subscriptionId && w.provider === 'outlook'
      );

      if (!webhook) {
        this.logger.warn(`No webhook configuration found for subscription: ${notification.subscriptionId}`);
        return;
      }

      // TODO: Fetch the actual event details from Microsoft Graph API
      // For now, simulate event detection
      await this.simulateEventDetection(webhook.userId, 'outlook');

    } catch (error) {
      this.logger.error(`Error handling Outlook webhook: ${error.message}`, error.stack);
    }
  }

  /**
   * 🚀 NEW: Schedule pre-meeting brief generation
   */
  async schedulePreMeetingBrief(calendarEvent: CalendarEvent, userId: string): Promise<void> {
    const briefTime = new Date(new Date(calendarEvent.startTime).getTime() - 30 * 60 * 1000); // 30 minutes before
    const now = new Date();

    if (briefTime <= now) {
      // If the meeting is starting in less than 30 minutes, generate brief immediately
      this.logger.log(`Meeting ${calendarEvent.id} starts soon, generating brief immediately`);
      await this.triggerPreMeetingBrief(calendarEvent, userId);
      return;
    }

    const delayMs = briefTime.getTime() - now.getTime();
    this.logger.log(`Scheduling pre-meeting brief for ${calendarEvent.id} in ${Math.round(delayMs / 1000 / 60)} minutes`);

    // Schedule the brief generation
    const timeoutId = setTimeout(async () => {
      await this.triggerPreMeetingBrief(calendarEvent, userId);
      this.scheduledBriefs.delete(calendarEvent.id);
    }, delayMs);

    // Store the timeout so we can cancel it if needed
    this.scheduledBriefs.set(calendarEvent.id, timeoutId);
  }

  /**
   * 🚀 NEW: Trigger pre-meeting brief generation
   */
  private async triggerPreMeetingBrief(calendarEvent: CalendarEvent, userId: string): Promise<void> {
    this.logger.log(`🎯 Triggering pre-meeting brief for event ${calendarEvent.id}`);

    try {
      const input = {
        type: 'meeting_brief',
        userId,
        eventId: calendarEvent.id,
        calendarEvent,
        metadata: {
          triggeredBy: 'pre_meeting_schedule',
          scheduledTime: new Date().toISOString(),
          autoTriggered: true
        }
      };

      // Use the unified workflow service to process the brief
      const result = await this.unifiedWorkflowService.processInput(input, input.metadata, userId);

      this.logger.log(`✅ Successfully triggered pre-meeting brief for ${calendarEvent.id}, session: ${result.sessionId}`);

    } catch (error) {
      this.logger.error(`❌ Error triggering pre-meeting brief for ${calendarEvent.id}: ${error.message}`, error.stack);
    }
  }

  /**
   * 🚀 NEW: Handle meeting start event
   */
  async handleMeetingStarted(calendarEvent: CalendarEvent, userId: string): Promise<void> {
    this.logger.log(`🎯 Meeting started: ${calendarEvent.id} - ${calendarEvent.title}`);

    // Emit event for other services to handle
    this.eventEmitter.emit('calendar.meeting_started', {
      eventType: 'meeting_started',
      calendarEvent,
      userId,
      provider: calendarEvent.provider,
      timestamp: new Date().toISOString()
    } as CalendarEventTrigger);

    // Cancel any pending brief if it hasn't been sent yet
    if (this.scheduledBriefs.has(calendarEvent.id)) {
      clearTimeout(this.scheduledBriefs.get(calendarEvent.id)!);
      this.scheduledBriefs.delete(calendarEvent.id);
      this.logger.log(`Cancelled pending brief for started meeting ${calendarEvent.id}`);
    }
  }

  /**
   * 🚀 NEW: Handle meeting end event
   */
  async handleMeetingEnded(calendarEvent: CalendarEvent, userId: string): Promise<void> {
    this.logger.log(`🎯 Meeting ended: ${calendarEvent.id} - ${calendarEvent.title}`);

    // Emit event for other services to handle
    this.eventEmitter.emit('calendar.meeting_ended', {
      eventType: 'meeting_ended',
      calendarEvent,
      userId,
      provider: calendarEvent.provider,
      timestamp: new Date().toISOString()
    } as CalendarEventTrigger);

    // TODO: In a real implementation, this would:
    // 1. Check if a transcript is available
    // 2. If available, trigger meeting analysis workflow
    // 3. If not available, schedule periodic checks or wait for transcript webhook

    this.logger.log(`📝 Meeting ${calendarEvent.id} ended - waiting for transcript to become available`);
  }

  /**
   * 🚀 NEW: Handle transcript availability
   */
  async handleTranscriptAvailable(calendarEvent: CalendarEvent, transcript: string, userId: string): Promise<void> {
    this.logger.log(`🎯 Transcript available for meeting: ${calendarEvent.id}`);

    try {
      const input = {
        type: 'meeting_transcript',
        transcript,
        participants: calendarEvent.attendees.map(a => a.email),
        meetingTitle: calendarEvent.title,
        date: calendarEvent.startTime,
        metadata: {
          calendarEventId: calendarEvent.id,
          provider: calendarEvent.provider,
          triggeredBy: 'transcript_available',
          autoTriggered: true
        }
      };

      // Trigger meeting analysis workflow
      const result = await this.unifiedWorkflowService.processInput(input, input.metadata, userId);

      this.logger.log(`✅ Successfully triggered meeting analysis for ${calendarEvent.id}, session: ${result.sessionId}`);
      this.logger.log(`📈 This will automatically trigger post-meeting orchestration when analysis completes`);

    } catch (error) {
      this.logger.error(`❌ Error triggering meeting analysis for ${calendarEvent.id}: ${error.message}`, error.stack);
    }
  }

  /**
   * Cancel scheduled brief for a meeting
   */
  async cancelScheduledBrief(eventId: string): Promise<void> {
    if (this.scheduledBriefs.has(eventId)) {
      clearTimeout(this.scheduledBriefs.get(eventId)!);
      this.scheduledBriefs.delete(eventId);
      this.logger.log(`Cancelled scheduled brief for event ${eventId}`);
    }
  }

  /**
   * Get all active scheduled briefs
   */
  getScheduledBriefs(): string[] {
    return Array.from(this.scheduledBriefs.keys());
  }

  /**
   * Temporary simulation for testing - remove when real webhook integration is ready
   */
  private async simulateEventDetection(userId: string, provider: 'google' | 'outlook'): Promise<void> {
    this.logger.log(`Simulating event detection for user ${userId} on ${provider}`);
    
    // This would be replaced with actual calendar API calls to detect changes
    // For now, just log that an event was detected
    this.logger.log(`📅 Event detected for user ${userId} - would trigger appropriate workflow based on event type`);
  }

  /**
   * Handle incoming webhook notification (generic entry point)
   */
  async handleWebhookNotification(webhookId: string, notification: any): Promise<void> {
    this.logger.log(`Handling webhook notification for ${webhookId}`);
    
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      this.logger.warn(`Unknown webhook ID: ${webhookId}`);
      return;
    }

    // Route to appropriate handler based on provider
    switch (webhook.provider) {
      case 'google':
        await this.handleGoogleWebhook(notification);
        break;
      case 'outlook':
        await this.handleOutlookWebhook(notification);
        break;
      default:
        this.logger.warn(`Unsupported provider: ${webhook.provider}`);
    }
  }
} 