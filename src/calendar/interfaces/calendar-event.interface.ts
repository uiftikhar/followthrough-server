export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  location?: string;
  attendees: CalendarAttendee[];
  organizer: CalendarAttendee;
  status: "confirmed" | "tentative" | "cancelled";
  recurring?: boolean;
  recurringEventId?: string;
  meetingLink?: string;
  calendarId: string;
  provider: "google" | "outlook" | "apple";
  metadata?: Record<string, any>;
  created: string;
  updated: string;
}

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus: "needsAction" | "declined" | "tentative" | "accepted";
  organizer?: boolean;
  optional?: boolean;
}

export interface CalendarAuth {
  userId: string;
  provider: "google" | "outlook" | "apple";
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  calendarId?: string;
}

export interface CalendarSyncStatus {
  userId: string;
  provider: "google" | "outlook" | "apple";
  lastSyncAt?: Date;
  nextPageToken?: string;
  syncToken?: string;
  status: "active" | "paused" | "error";
  errorMessage?: string;
}

export interface CalendarWebhookConfig {
  id: string;
  userId: string;
  provider: "google" | "outlook" | "apple";
  resourceId: string;
  resourceUri: string;
  expiration?: number;
  token?: string;
  address: string;
}
