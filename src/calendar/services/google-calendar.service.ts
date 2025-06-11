import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleOAuthService } from "../../integrations/google/services/google-oauth.service";
import { TokenEncryptionService } from "../../integrations/google/services/token-encryption.service";
import {
  CalendarEvent,
  CalendarAuth,
  CalendarSyncStatus,
  CalendarWebhookConfig,
} from "../interfaces/calendar-event.interface";
import { google, calendar_v3 } from "googleapis";
import { v4 as uuidv4 } from "uuid";

// Add push notification interfaces
export interface GoogleCalendarChannel {
  id: string;
  type: "web_hook";
  address: string;
  token?: string;
  expiration?: number;
  params?: {
    ttl?: string;
  };
}

export interface GoogleCalendarChannelResponse {
  kind: "api#channel";
  id: string;
  resourceId: string;
  resourceUri: string;
  token?: string;
  expiration?: string;
}

export interface GoogleWebhookNotification {
  channelId: string;
  resourceId: string;
  resourceUri: string;
  resourceState: "sync" | "exists" | "not_exists";
  messageNumber: string;
  token?: string;
  expiration?: string;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly activeChannels = new Map<
    string,
    GoogleCalendarChannelResponse
  >();

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
      const authUrl = "https://accounts.google.com/oauth/authorize"; // Placeholder

      // For now, return the auth URL - in production, this would be part of the OAuth flow
      throw new Error(`Please authenticate at: ${authUrl}`);
    } catch (error) {
      this.logger.error(
        `Error authenticating user ${userId}: ${error.message}`,
      );
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
    },
  ): Promise<CalendarEvent[]> {
    this.logger.log(`Syncing calendar events for user ${userId}`);

    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: options?.timeMin || new Date().toISOString(),
        timeMax: options?.timeMax,
        maxResults: options?.maxResults || 50,
        singleEvents: true,
        orderBy: "startTime",
        syncToken: options?.syncToken,
      });

      const events = response.data.items || [];

      return events
        .filter((event) => event.start && event.end) // Filter out all-day events for now
        .map((event) =>
          this.transformGoogleEventToCalendarEvent(event, userId),
        );
    } catch (error) {
      this.logger.error(
        `Error syncing calendar events for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get upcoming events for the next 24 hours
   */
  async getUpcomingEvents(
    userId: string,
    hoursAhead: number = 24,
  ): Promise<CalendarEvent[]> {
    const now = new Date();
    const timeMax = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return this.syncCalendarEvents(userId, {
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 20,
    });
  }

  /**
   * Get a specific calendar event
   */
  async getCalendarEvent(
    userId: string,
    eventId: string,
  ): Promise<CalendarEvent | null> {
    this.logger.log(`Getting calendar event ${eventId} for user ${userId}`);

    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      const response = await calendar.events.get({
        calendarId: "primary",
        eventId: eventId,
      });

      if (!response.data) {
        return null;
      }

      return this.transformGoogleEventToCalendarEvent(response.data, userId);
    } catch (error) {
      this.logger.error(
        `Error getting calendar event ${eventId} for user ${userId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Create a new calendar event
   */
  async createCalendarEvent(
    userId: string,
    event: Partial<CalendarEvent>,
  ): Promise<CalendarEvent> {
    this.logger.log(
      `Creating calendar event for user ${userId}: ${event.title}`,
    );

    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      const googleEvent: calendar_v3.Schema$Event = {
        summary: event.title,
        description: event.description,
        start: {
          dateTime: event.startTime,
          timeZone: "UTC",
        },
        end: {
          dateTime: event.endTime,
          timeZone: "UTC",
        },
        location: event.location,
        attendees: event.attendees?.map((attendee) => ({
          email: attendee.email,
          displayName: attendee.displayName,
          optional: attendee.optional,
        })),
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: googleEvent,
      });

      return this.transformGoogleEventToCalendarEvent(response.data, userId);
    } catch (error) {
      this.logger.error(
        `Error creating calendar event for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Transform Google Calendar event to our CalendarEvent interface
   */
  private transformGoogleEventToCalendarEvent(
    googleEvent: calendar_v3.Schema$Event,
    userId: string,
  ): CalendarEvent {
    return {
      id: googleEvent.id!,
      title: googleEvent.summary || "Untitled Event",
      description: googleEvent.description || undefined,
      startTime: googleEvent.start?.dateTime || googleEvent.start?.date || "",
      endTime: googleEvent.end?.dateTime || googleEvent.end?.date || "",
      location: googleEvent.location || undefined,
      attendees: (googleEvent.attendees || []).map((attendee) => ({
        email: attendee.email || "",
        displayName: attendee.displayName || undefined,
        responseStatus: this.mapGoogleResponseStatus(
          attendee.responseStatus as string,
        ),
        organizer: attendee.organizer || false,
        optional: attendee.optional || false,
      })),
      organizer: {
        email: googleEvent.organizer?.email || "",
        displayName: googleEvent.organizer?.displayName || undefined,
        responseStatus: "accepted" as const,
        organizer: true,
      },
      status: this.mapGoogleEventStatus(googleEvent.status as string),
      recurring: !!googleEvent.recurringEventId,
      recurringEventId: googleEvent.recurringEventId || undefined,
      meetingLink: googleEvent.hangoutLink || googleEvent.location || undefined,
      calendarId: "primary",
      provider: "google",
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
        this.configService.get("GOOGLE_CLIENT_ID"),
        this.configService.get("GOOGLE_CLIENT_SECRET"),
        this.configService.get("GOOGLE_REDIRECT_URI"),
      );

      oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      return oauth2Client;
    } catch (error) {
      this.logger.error(
        `Error getting authenticated client for user ${userId}: ${error.message}`,
      );
      throw new Error(
        `User ${userId} is not authenticated with Google Calendar`,
      );
    }
  }

  /**
   * Get stored tokens for user (placeholder - needs database implementation)
   */
  private async getStoredTokens(userId: string): Promise<CalendarAuth> {
    // TODO: Implement database storage for calendar tokens
    // This should retrieve encrypted tokens from the database
    throw new Error("Token storage not yet implemented");
  }

  /**
   * Map Google response status to our interface
   */
  private mapGoogleResponseStatus(
    status?: string,
  ): "needsAction" | "declined" | "tentative" | "accepted" {
    switch (status) {
      case "declined":
        return "declined";
      case "tentative":
        return "tentative";
      case "accepted":
        return "accepted";
      default:
        return "needsAction";
    }
  }

  /**
   * Map Google event status to our interface
   */
  private mapGoogleEventStatus(
    status?: string,
  ): "confirmed" | "tentative" | "cancelled" {
    switch (status) {
      case "cancelled":
        return "cancelled";
      case "tentative":
        return "tentative";
      default:
        return "confirmed";
    }
  }

  /**
   * 🚀 NEW: Set up Google Calendar push notifications for a user
   */
  async setupPushNotifications(
    userId: string,
  ): Promise<GoogleCalendarChannelResponse> {
    this.logger.log(`Setting up push notifications for user ${userId}`);

    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      // Generate unique channel ID
      const channelId = `followthrough-${userId}-${Date.now()}`;
      const webhookUrl = `${this.configService.get("BASE_URL")}/webhook/calendar/google`;

      // Calculate expiration (maximum 1 week for Google Calendar)
      const expirationTime = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

      const channel: GoogleCalendarChannel = {
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        token: `user-${userId}`, // Use userId as token for verification
        expiration: expirationTime,
      };

      this.logger.log(
        `Creating notification channel: ${channelId} -> ${webhookUrl}`,
      );

      // Set up watch request for primary calendar events
      const response = await calendar.events.watch({
        calendarId: "primary",
        requestBody: channel as any,
      });

      const channelResponse: GoogleCalendarChannelResponse = {
        kind: "api#channel",
        id: response.data.id!,
        resourceId: response.data.resourceId!,
        resourceUri: response.data.resourceUri!,
        token: response.data.token || undefined,
        expiration: response.data.expiration || undefined,
      };

      // Store the active channel
      this.activeChannels.set(userId, channelResponse);

      this.logger.log(
        `✅ Successfully set up push notifications for user ${userId}`,
      );
      this.logger.log(
        `Channel ID: ${channelResponse.id}, Resource ID: ${channelResponse.resourceId}`,
      );

      return channelResponse;
    } catch (error) {
      this.logger.error(
        `❌ Error setting up push notifications for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to setup push notifications: ${error.message}`);
    }
  }

  /**
   * 🚀 NEW: Stop push notifications for a user
   */
  async stopPushNotifications(userId: string): Promise<void> {
    this.logger.log(`Stopping push notifications for user ${userId}`);

    try {
      const channel = this.activeChannels.get(userId);
      if (!channel) {
        this.logger.warn(`No active channel found for user ${userId}`);
        return;
      }

      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      // Stop the notification channel
      await calendar.channels.stop({
        requestBody: {
          id: channel.id,
          resourceId: channel.resourceId,
        },
      });

      // Remove from active channels
      this.activeChannels.delete(userId);

      this.logger.log(
        `✅ Successfully stopped push notifications for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error stopping push notifications for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to stop push notifications: ${error.message}`);
    }
  }

  /**
   * 🚀 NEW: Process Google Calendar webhook notification
   */
  async processWebhookNotification(
    notification: GoogleWebhookNotification,
  ): Promise<{
    eventsChanged: CalendarEvent[];
    userId: string;
  }> {
    this.logger.log(
      `Processing webhook notification: ${notification.channelId}`,
    );
    this.logger.log(
      `Resource State: ${notification.resourceState}, Message Number: ${notification.messageNumber}`,
    );

    try {
      // Extract userId from token
      const userId = this.extractUserIdFromToken(notification.token);
      if (!userId) {
        throw new Error("Invalid or missing token in notification");
      }

      // Handle different resource states
      switch (notification.resourceState) {
        case "sync":
          this.logger.log(
            `📡 Sync notification received for user ${userId} - channel is now active`,
          );
          return { eventsChanged: [], userId };

        case "exists":
          this.logger.log(
            `📅 Calendar change detected for user ${userId} - fetching updated events`,
          );
          const changedEvents = await this.fetchRecentChanges(userId);
          return { eventsChanged: changedEvents, userId };

        case "not_exists":
          this.logger.log(`🗑️ Calendar resource deleted for user ${userId}`);
          return { eventsChanged: [], userId };

        default:
          this.logger.warn(
            `Unknown resource state: ${notification.resourceState}`,
          );
          return { eventsChanged: [], userId };
      }
    } catch (error) {
      this.logger.error(
        `❌ Error processing webhook notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 🚀 NEW: Fetch recent calendar changes to detect what events were modified
   */
  private async fetchRecentChanges(userId: string): Promise<CalendarEvent[]> {
    this.logger.log(`Fetching recent changes for user ${userId}`);

    try {
      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      // Get events from the last hour to identify what changed
      const timeMin = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const timeMax = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours ahead

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        maxResults: 50,
        singleEvents: true,
        orderBy: "updated",
        showDeleted: false,
      });

      const events = response.data.items || [];

      const transformedEvents = events
        .filter((event) => event.start && event.end) // Filter out all-day events
        .map((event) =>
          this.transformGoogleEventToCalendarEvent(event, userId),
        );

      this.logger.log(
        `📊 Found ${transformedEvents.length} recent events for user ${userId}`,
      );

      return transformedEvents;
    } catch (error) {
      this.logger.error(
        `❌ Error fetching recent changes for user ${userId}: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * 🚀 NEW: Get events happening soon (for meeting start detection)
   */
  async getEventsStartingSoon(
    userId: string,
    minutesAhead: number = 5,
  ): Promise<CalendarEvent[]> {
    this.logger.log(
      `Getting events starting soon for user ${userId} (within ${minutesAhead} minutes)`,
    );

    try {
      const now = new Date();
      const soonTime = new Date(now.getTime() + minutesAhead * 60 * 1000);

      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: soonTime.toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      const transformedEvents = events
        .filter((event) => event.start && event.end)
        .map((event) =>
          this.transformGoogleEventToCalendarEvent(event, userId),
        );

      this.logger.log(
        `🔔 Found ${transformedEvents.length} events starting soon for user ${userId}`,
      );

      return transformedEvents;
    } catch (error) {
      this.logger.error(
        `❌ Error getting events starting soon for user ${userId}: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * 🚀 NEW: Get events that recently ended (for meeting end detection)
   */
  async getEventsEndedRecently(
    userId: string,
    minutesAgo: number = 5,
  ): Promise<CalendarEvent[]> {
    this.logger.log(
      `Getting events that ended recently for user ${userId} (within ${minutesAgo} minutes)`,
    );

    try {
      const now = new Date();
      const recentTime = new Date(now.getTime() - minutesAgo * 60 * 1000);

      const auth = await this.getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: "v3", auth });

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: recentTime.toISOString(),
        timeMax: now.toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      const transformedEvents = events
        .filter((event) => event.start && event.end)
        .map((event) =>
          this.transformGoogleEventToCalendarEvent(event, userId),
        );

      // Filter to only events that actually ended recently
      const recentlyEndedEvents = transformedEvents.filter((event) => {
        const endTime = new Date(event.endTime);
        const timeSinceEnd = now.getTime() - endTime.getTime();
        return timeSinceEnd <= minutesAgo * 60 * 1000 && timeSinceEnd >= 0;
      });

      this.logger.log(
        `📅 Found ${recentlyEndedEvents.length} recently ended events for user ${userId}`,
      );

      return recentlyEndedEvents;
    } catch (error) {
      this.logger.error(
        `❌ Error getting recently ended events for user ${userId}: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * 🚀 NEW: Check if a channel is still active
   */
  async checkChannelStatus(
    userId: string,
  ): Promise<{ active: boolean; channel?: GoogleCalendarChannelResponse }> {
    const channel = this.activeChannels.get(userId);

    if (!channel) {
      return { active: false };
    }

    // Check if channel has expired
    if (channel.expiration) {
      const expirationTime = parseInt(channel.expiration);
      if (Date.now() > expirationTime) {
        this.logger.warn(
          `Channel ${channel.id} for user ${userId} has expired`,
        );
        this.activeChannels.delete(userId);
        return { active: false };
      }
    }

    return { active: true, channel };
  }

  /**
   * 🚀 NEW: Renew push notification channel before expiration
   */
  async renewPushNotifications(
    userId: string,
  ): Promise<GoogleCalendarChannelResponse> {
    this.logger.log(`Renewing push notifications for user ${userId}`);

    // Stop existing channel
    await this.stopPushNotifications(userId);

    // Set up new channel
    return this.setupPushNotifications(userId);
  }

  /**
   * 🚀 NEW: Get all active channels (for monitoring)
   */
  getActiveChannels(): Map<string, GoogleCalendarChannelResponse> {
    return new Map(this.activeChannels);
  }

  /**
   * Helper method to extract userId from webhook token
   */
  private extractUserIdFromToken(token?: string): string | null {
    if (!token) return null;

    // Token format: "user-{userId}"
    const match = token.match(/^user-(.+)$/);
    return match ? match[1] : null;
  }
}
