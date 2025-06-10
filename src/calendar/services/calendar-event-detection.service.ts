import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { CalendarWebhookService, CalendarEventTrigger } from './calendar-webhook.service';
import { GoogleCalendarService } from './google-calendar.service';

export interface EventChange {
  type: 'created' | 'updated' | 'deleted' | 'started' | 'ended';
  event: CalendarEvent;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface MeetingTimeWindow {
  userId: string;
  event: CalendarEvent;
  timeUntilStart: number; // minutes
  timeSinceEnd: number; // minutes
}

@Injectable()
export class CalendarEventDetectionService {
  private readonly logger = new Logger(CalendarEventDetectionService.name);
  
  // Track processed events to avoid duplicate processing
  private readonly processedEvents = new Map<string, string>(); // eventId -> lastProcessedTime
  
  // Track meeting states
  private readonly meetingStates = new Map<string, 'scheduled' | 'starting' | 'active' | 'ended'>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly calendarWebhookService: CalendarWebhookService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {
    // Start periodic meeting detection for events starting/ending soon
    this.startPeriodicMeetingDetection();
  }

  /**
   * 🚀 Process calendar event changes from webhook notifications
   */
  async processEventChanges(userId: string, events: CalendarEvent[]): Promise<void> {
    this.logger.log(`🔍 Processing ${events.length} event changes for user ${userId}`);

    try {
      const eventChanges: EventChange[] = [];

      for (const event of events) {
        const change = await this.detectEventChange(userId, event);
        if (change) {
          eventChanges.push(change);
        }
      }

      this.logger.log(`📊 Detected ${eventChanges.length} significant event changes`);

      // Process each change type
      for (const change of eventChanges) {
        await this.processEventChange(userId, change);
      }

      // Check for meetings starting/ending soon based on the current time
      await this.checkMeetingTimings(userId, events);

    } catch (error) {
      this.logger.error(`❌ Error processing event changes for user ${userId}: ${error.message}`, error.stack);
    }
  }

  /**
   * 🚀 Detect what type of change occurred for an event
   */
  private async detectEventChange(userId: string, event: CalendarEvent): Promise<EventChange | null> {
    const eventKey = `${userId}-${event.id}`;
    const lastProcessed = this.processedEvents.get(eventKey);
    const currentTime = new Date().toISOString();

    // If we haven't seen this event before, it's new
    if (!lastProcessed) {
      this.processedEvents.set(eventKey, currentTime);
      return {
        type: 'created',
        event,
        timestamp: currentTime,
        metadata: { isNew: true }
      };
    }

    // Check if the event was updated since last processing
    const eventUpdatedTime = new Date(event.updated);
    const lastProcessedTime = new Date(lastProcessed);

    if (eventUpdatedTime > lastProcessedTime) {
      this.processedEvents.set(eventKey, currentTime);
      return {
        type: 'updated',
        event,
        timestamp: currentTime,
        metadata: { 
          lastProcessed: lastProcessed,
          timeDiff: eventUpdatedTime.getTime() - lastProcessedTime.getTime()
        }
      };
    }

    return null; // No significant change
  }

  /**
   * 🚀 Process individual event change
   */
  private async processEventChange(userId: string, change: EventChange): Promise<void> {
    this.logger.log(`🎯 Processing ${change.type} event: ${change.event.title} (${change.event.id})`);

    switch (change.type) {
      case 'created':
        await this.handleEventCreated(userId, change.event);
        break;
      case 'updated':
        await this.handleEventUpdated(userId, change.event);
        break;
      case 'deleted':
        await this.handleEventDeleted(userId, change.event);
        break;
      case 'started':
        await this.handleMeetingStarted(userId, change.event);
        break;
      case 'ended':
        await this.handleMeetingEnded(userId, change.event);
        break;
    }
  }

  /**
   * 🚀 Check meeting timings to detect starts/ends
   */
  private async checkMeetingTimings(userId: string, events: CalendarEvent[]): Promise<void> {
    const now = new Date();
    
    for (const event of events) {
      const startTime = new Date(event.startTime);
      const endTime = new Date(event.endTime);
      const eventKey = `${userId}-${event.id}`;
      
      const minutesToStart = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));
      const minutesSinceEnd = Math.floor((now.getTime() - endTime.getTime()) / (1000 * 60));
      
      const currentState = this.meetingStates.get(eventKey) || 'scheduled';

      // Meeting starting soon (within 5 minutes)
      if (minutesToStart <= 5 && minutesToStart > 0 && currentState === 'scheduled') {
        this.logger.log(`🚀 Meeting starting soon: ${event.title} (in ${minutesToStart} minutes)`);
        this.meetingStates.set(eventKey, 'starting');
        await this.handleMeetingStartingSoon(userId, event, minutesToStart);
      }

      // Meeting just started (within 2 minutes of start time)
      if (minutesToStart <= 0 && minutesToStart >= -2 && currentState === 'starting') {
        this.logger.log(`▶️ Meeting started: ${event.title}`);
        this.meetingStates.set(eventKey, 'active');
        await this.handleMeetingStarted(userId, event);
      }

      // Meeting just ended (within 5 minutes of end time)
      if (minutesSinceEnd <= 5 && minutesSinceEnd > 0 && currentState === 'active') {
        this.logger.log(`🏁 Meeting ended: ${event.title} (${minutesSinceEnd} minutes ago)`);
        this.meetingStates.set(eventKey, 'ended');
        await this.handleMeetingEnded(userId, event);
      }
    }
  }

  /**
   * 🚀 Handle new event creation
   */
  private async handleEventCreated(userId: string, event: CalendarEvent): Promise<void> {
    this.logger.log(`📅 New event created: ${event.title}`);
    
    // Check if we need to schedule a pre-meeting brief
    const startTime = new Date(event.startTime);
    const now = new Date();
    
    // Only schedule briefs for meetings more than 30 minutes in the future
    if (startTime.getTime() - now.getTime() > 30 * 60 * 1000) {
      await this.calendarWebhookService.schedulePreMeetingBrief(event, userId);
    }

    // Emit event for other services
    this.eventEmitter.emit('calendar.event_created', {
      eventType: 'meeting_created',
      calendarEvent: event,
      userId,
      provider: event.provider,
      timestamp: new Date().toISOString()
    } as CalendarEventTrigger);
  }

  /**
   * 🚀 Handle event updates
   */
  private async handleEventUpdated(userId: string, event: CalendarEvent): Promise<void> {
    this.logger.log(`📝 Event updated: ${event.title}`);
    
    // If timing changed, reschedule brief if needed
    const startTime = new Date(event.startTime);
    const now = new Date();
    
    if (startTime.getTime() - now.getTime() > 30 * 60 * 1000) {
      // Cancel existing brief and reschedule
      await this.calendarWebhookService.cancelScheduledBrief(event.id);
      await this.calendarWebhookService.schedulePreMeetingBrief(event, userId);
    }

    // Emit event for other services
    this.eventEmitter.emit('calendar.event_updated', {
      eventType: 'meeting_updated',
      calendarEvent: event,
      userId,
      provider: event.provider,
      timestamp: new Date().toISOString()
    } as CalendarEventTrigger);
  }

  /**
   * 🚀 Handle event deletion
   */
  private async handleEventDeleted(userId: string, event: CalendarEvent): Promise<void> {
    this.logger.log(`🗑️ Event deleted: ${event.title}`);
    
    // Cancel any scheduled brief
    await this.calendarWebhookService.cancelScheduledBrief(event.id);
    
    // Clean up tracking data
    const eventKey = `${userId}-${event.id}`;
    this.processedEvents.delete(eventKey);
    this.meetingStates.delete(eventKey);
  }

  /**
   * 🚀 Handle meeting starting soon
   */
  private async handleMeetingStartingSoon(userId: string, event: CalendarEvent, minutesToStart: number): Promise<void> {
    this.logger.log(`⏰ Meeting starting soon: ${event.title} (${minutesToStart} minutes)`);
    
    // If no brief was sent yet, send it now
    const scheduledBriefs = this.calendarWebhookService.getScheduledBriefs();
    if (!scheduledBriefs.includes(event.id)) {
      this.logger.log(`📨 Sending last-minute brief for ${event.title}`);
      await this.calendarWebhookService.schedulePreMeetingBrief(event, userId);
    }
  }

  /**
   * 🚀 Handle meeting started
   */
  private async handleMeetingStarted(userId: string, event: CalendarEvent): Promise<void> {
    this.logger.log(`▶️ Meeting started: ${event.title}`);
    
    await this.calendarWebhookService.handleMeetingStarted(event, userId);
  }

  /**
   * 🚀 Handle meeting ended
   */
  private async handleMeetingEnded(userId: string, event: CalendarEvent): Promise<void> {
    this.logger.log(`🏁 Meeting ended: ${event.title}`);
    
    await this.calendarWebhookService.handleMeetingEnded(event, userId);
  }

  /**
   * 🚀 Start periodic meeting detection (checks every minute)
   */
  private startPeriodicMeetingDetection(): void {
    this.logger.log('🕒 Starting periodic meeting detection (every 60 seconds)');
    
    setInterval(async () => {
      try {
        await this.performPeriodicMeetingCheck();
      } catch (error) {
        this.logger.error(`❌ Error in periodic meeting detection: ${error.message}`, error.stack);
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * 🚀 Perform periodic check for meetings starting/ending soon
   */
  private async performPeriodicMeetingCheck(): Promise<void> {
    this.logger.debug('🔍 Performing periodic meeting timing check');
    
    try {
      // Get all active channels to check their users
      const activeChannels = this.googleCalendarService.getActiveChannels();
      
      for (const [userId, channel] of activeChannels) {
        // Check for meetings starting soon
        const startingSoon = await this.googleCalendarService.getEventsStartingSoon(userId, 10);
        
        // Check for meetings that ended recently
        const endedRecently = await this.googleCalendarService.getEventsEndedRecently(userId, 10);
        
        // Process both sets of events
        const allEvents = [...startingSoon, ...endedRecently];
        if (allEvents.length > 0) {
          await this.checkMeetingTimings(userId, allEvents);
        }
      }
      
    } catch (error) {
      this.logger.error(`❌ Error in periodic meeting check: ${error.message}`, error.stack);
    }
  }

  /**
   * 🚀 Get meeting state for debugging
   */
  getMeetingState(userId: string, eventId: string): string | undefined {
    return this.meetingStates.get(`${userId}-${eventId}`);
  }

  /**
   * 🚀 Get processing statistics
   */
  getProcessingStats(): {
    processedEvents: number;
    trackedMeetings: number;
    activeStates: Record<string, number>;
  } {
    const states = Array.from(this.meetingStates.values());
    const stateCount = states.reduce((acc, state) => {
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      processedEvents: this.processedEvents.size,
      trackedMeetings: this.meetingStates.size,
      activeStates: stateCount,
    };
  }
} 