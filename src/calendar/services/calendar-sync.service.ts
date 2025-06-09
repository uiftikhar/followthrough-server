import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { CalendarEvent, CalendarSyncStatus } from '../interfaces/calendar-event.interface';

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);
  private readonly syncStatuses = new Map<string, CalendarSyncStatus>();

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  /**
   * Sync calendar events for a user
   */
  async syncUserCalendar(userId: string): Promise<CalendarEvent[]> {
    this.logger.log(`Starting calendar sync for user ${userId}`);
    
    try {
      // Update sync status to in progress
      this.updateSyncStatus(userId, 'active');
      
      // Get upcoming events from Google Calendar
      const events = await this.googleCalendarService.getUpcomingEvents(userId);
      
      // Update last sync time
      this.updateSyncStatus(userId, 'active', undefined, new Date());
      
      this.logger.log(`Synced ${events.length} events for user ${userId}`);
      return events;
      
    } catch (error) {
      this.logger.error(`Error syncing calendar for user ${userId}: ${error.message}`);
      this.updateSyncStatus(userId, 'error', error.message);
      throw error;
    }
  }

  /**
   * Get sync status for a user
   */
  getSyncStatus(userId: string): CalendarSyncStatus | undefined {
    return this.syncStatuses.get(userId);
  }

  /**
   * Update sync status for a user
   */
  private updateSyncStatus(
    userId: string, 
    status: 'active' | 'paused' | 'error', 
    errorMessage?: string,
    lastSyncAt?: Date
  ): void {
    const currentStatus = this.syncStatuses.get(userId) || {
      userId,
      provider: 'google',
      status: 'paused',
    };

    this.syncStatuses.set(userId, {
      ...currentStatus,
      status,
      errorMessage,
      lastSyncAt: lastSyncAt || currentStatus.lastSyncAt,
    });
  }

  /**
   * Check if user calendar is synced and up to date
   */
  isCalendarSynced(userId: string): boolean {
    const status = this.getSyncStatus(userId);
    if (!status || status.status === 'error') {
      return false;
    }

    // Consider synced if last sync was within the last hour
    if (!status.lastSyncAt) {
      return false;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return status.lastSyncAt > oneHourAgo;
  }

  /**
   * Trigger sync for user if needed
   */
  async ensureCalendarSynced(userId: string): Promise<CalendarEvent[]> {
    if (this.isCalendarSynced(userId)) {
      this.logger.log(`Calendar already synced for user ${userId}`);
      // Return cached events or re-fetch latest
      return this.googleCalendarService.getUpcomingEvents(userId);
    }

    return this.syncUserCalendar(userId);
  }

  /**
   * Get events happening soon (within the next 2 hours)
   */
  async getEventsHappeningSoon(userId: string): Promise<CalendarEvent[]> {
    const events = await this.ensureCalendarSynced(userId);
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const now = new Date();

    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      return eventStart >= now && eventStart <= twoHoursFromNow;
    });
  }

  /**
   * Get the next upcoming event
   */
  async getNextUpcomingEvent(userId: string): Promise<CalendarEvent | null> {
    const events = await this.ensureCalendarSynced(userId);
    const now = new Date();

    const upcomingEvents = events
      .filter(event => new Date(event.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return upcomingEvents.length > 0 ? upcomingEvents[0] : null;
  }
} 