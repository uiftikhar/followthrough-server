import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService } from '../../integrations/google/services/google-oauth.service';
import { TokenEncryptionService } from '../../integrations/google/services/token-encryption.service';
import { CalendarEvent, CalendarAuth, CalendarSyncStatus } from '../interfaces/calendar-event.interface';
import { google, calendar_v3 } from 'googleapis';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly tokenEncryptionService: TokenEncryptionService,
  ) {}

  /**
   * Authenticate user with Google Calendar
   */
  async authenticateUser(userId: string): Promise<CalendarAuth> {
    this.logger.log(`Authenticating user ${userId} with Google Calendar`);
    
    try {
      // Get OAuth URL with calendar scopes
      // TODO: Implement proper OAuth flow with calendar scopes
      const authUrl = 'https://accounts.google.com/oauth/authorize'; // Placeholder

      // For now, return the auth URL - in production, this would be part of the OAuth flow
      throw new Error(`Please authenticate at: ${authUrl}`);
      
    } catch (error) {
      this.logger.error(`Error authenticating user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync calendar events for authenticated user
   */
  async syncCalendarEvents(
    userId: string, 
    options?: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      syncToken?: string;
    }
  ): Promise<CalendarEvent[]> {
    this.logger.log(`Syncing calendar events for user ${userId}`);
    
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: options?.timeMin || new Date().toISOString(),
        timeMax: options?.timeMax,
        maxResults: options?.maxResults || 50,
        singleEvents: true,
        orderBy: 'startTime',
        syncToken: options?.syncToken,
      });

      const events = response.data.items || [];
      
      return events
        .filter(event => event.start && event.end) // Filter out all-day events for now
        .map(event => this.transformGoogleEventToCalendarEvent(event, userId));
        
    } catch (error) {
      this.logger.error(`Error syncing calendar events for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get upcoming events for the next 24 hours
   */
  async getUpcomingEvents(userId: string, hoursAhead: number = 24): Promise<CalendarEvent[]> {
    const now = new Date();
    const timeMax = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));

    return this.syncCalendarEvents(userId, {
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 20,
    });
  }

  /**
   * Get a specific calendar event
   */
  async getCalendarEvent(userId: string, eventId: string): Promise<CalendarEvent | null> {
    this.logger.log(`Getting calendar event ${eventId} for user ${userId}`);
    
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      if (!response.data) {
        return null;
      }

      return this.transformGoogleEventToCalendarEvent(response.data, userId);
      
    } catch (error) {
      this.logger.error(`Error getting calendar event ${eventId} for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a new calendar event
   */
  async createCalendarEvent(userId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    this.logger.log(`Creating calendar event for user ${userId}: ${event.title}`);
    
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      const googleEvent: calendar_v3.Schema$Event = {
        summary: event.title,
        description: event.description,
        start: {
          dateTime: event.startTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: event.endTime,
          timeZone: 'UTC',
        },
        location: event.location,
        attendees: event.attendees?.map(attendee => ({
          email: attendee.email,
          displayName: attendee.displayName,
          optional: attendee.optional,
        })),
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: googleEvent,
      });

      return this.transformGoogleEventToCalendarEvent(response.data, userId);
      
    } catch (error) {
      this.logger.error(`Error creating calendar event for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transform Google Calendar event to our CalendarEvent interface
   */
  private transformGoogleEventToCalendarEvent(
    googleEvent: calendar_v3.Schema$Event, 
    userId: string
  ): CalendarEvent {
    return {
      id: googleEvent.id!,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description || undefined,
      startTime: googleEvent.start?.dateTime || googleEvent.start?.date || '',
      endTime: googleEvent.end?.dateTime || googleEvent.end?.date || '',
      location: googleEvent.location || undefined,
      attendees: (googleEvent.attendees || []).map(attendee => ({
        email: attendee.email || '',
        displayName: attendee.displayName || undefined,
        responseStatus: this.mapGoogleResponseStatus(attendee.responseStatus as string),
        organizer: attendee.organizer || false,
        optional: attendee.optional || false,
      })),
      organizer: {
        email: googleEvent.organizer?.email || '',
        displayName: googleEvent.organizer?.displayName || undefined,
        responseStatus: 'accepted' as const,
        organizer: true,
      },
      status: this.mapGoogleEventStatus(googleEvent.status as string),
      recurring: !!googleEvent.recurringEventId,
      recurringEventId: googleEvent.recurringEventId || undefined,
      meetingLink: googleEvent.hangoutLink || googleEvent.location || undefined,
      calendarId: 'primary',
      provider: 'google',
      metadata: {
        htmlLink: googleEvent.htmlLink,
        iCalUID: googleEvent.iCalUID,
        sequence: googleEvent.sequence,
      },
      created: googleEvent.created || new Date().toISOString(),
      updated: googleEvent.updated || new Date().toISOString(),
    };
  }

  /**
   * Get authenticated Google client for user
   */
  private async getAuthenticatedClient(userId: string) {
    try {
      // This would typically get stored tokens from database
      // For now, we'll need to implement token storage
      const tokens = await this.getStoredTokens(userId);
      
      const oauth2Client = new google.auth.OAuth2(
        this.configService.get('GOOGLE_CLIENT_ID'),
        this.configService.get('GOOGLE_CLIENT_SECRET'),
        this.configService.get('GOOGLE_REDIRECT_URI'),
      );

      oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      return oauth2Client;
    } catch (error) {
      this.logger.error(`Error getting authenticated client for user ${userId}: ${error.message}`);
      throw new Error(`User ${userId} is not authenticated with Google Calendar`);
    }
  }

  /**
   * Get stored tokens for user (placeholder - needs database implementation)
   */
  private async getStoredTokens(userId: string): Promise<CalendarAuth> {
    // TODO: Implement database storage for calendar tokens
    // This should retrieve encrypted tokens from the database
    throw new Error('Token storage not yet implemented');
  }

  /**
   * Map Google response status to our interface
   */
  private mapGoogleResponseStatus(status?: string): 'needsAction' | 'declined' | 'tentative' | 'accepted' {
    switch (status) {
      case 'declined':
        return 'declined';
      case 'tentative':
        return 'tentative';
      case 'accepted':
        return 'accepted';
      default:
        return 'needsAction';
    }
  }

  /**
   * Map Google event status to our interface
   */
  private mapGoogleEventStatus(status?: string): 'confirmed' | 'tentative' | 'cancelled' {
    switch (status) {
      case 'cancelled':
        return 'cancelled';
      case 'tentative':
        return 'tentative';
      default:
        return 'confirmed';
    }
  }
} 