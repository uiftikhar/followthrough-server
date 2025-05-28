import { Bundle, ZObject } from 'zapier-platform-core';
import { ApiClient } from './api-client';

export interface EmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  headers: Record<string, string>;
  threadId: string;
  snippet: string;
  internalDate: string;
}

export interface CalendarEventData {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
}

export interface EmailQueryOptions {
  maxResults?: number;
  query?: string;
  labelIds?: string;
  pageToken?: string;
}

export interface CalendarQueryOptions {
  maxResults?: number;
  timeMin?: string;
  timeMax?: string;
  pageToken?: string;
}

export class GoogleClient {
  private apiClient: ApiClient;
  private z: ZObject;

  constructor(z: ZObject, bundle: Bundle) {
    this.z = z;
    this.apiClient = new ApiClient(z, bundle);
  }

  /**
   * Get recent emails from Gmail via your server's proxy
   */
  async getRecentEmails(options: EmailQueryOptions = {}): Promise<EmailData[]> {
    try {
      const params: Record<string, string> = {};
      
      if (options.maxResults) params.maxResults = options.maxResults.toString();
      if (options.query) params.query = options.query;
      if (options.labelIds) params.labelIds = options.labelIds;
      if (options.pageToken) params.pageToken = options.pageToken;

      const response = await this.apiClient.get('/api/gmail/messages', params);
      
      if (!response.data || !Array.isArray(response.data.messages)) {
        return [];
      }

      return response.data.messages.map((message: any) => this.formatEmailData(message));
    } catch (error) {
      this.z.console.error('Failed to get recent emails:', error);
      throw new Error(`Failed to get emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific email by ID
   */
  async getEmail(emailId: string): Promise<EmailData> {
    try {
      const response = await this.apiClient.get(`/api/gmail/messages/${emailId}`);
      return this.formatEmailData(response.data);
    } catch (error) {
      this.z.console.error(`Failed to get email ${emailId}:`, error);
      throw new Error(`Failed to get email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send an email via Gmail
   */
  async sendEmail(emailData: {
    to: string;
    subject: string;
    body: string;
    isHtml?: boolean;
    inReplyTo?: string;
    references?: string;
  }): Promise<{ id: string; threadId: string; labelIds: string[]; snippet: string }> {
    try {
      const response = await this.apiClient.post('/api/gmail/send', emailData);
      return response.data;
    } catch (error) {
      this.z.console.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent calendar events
   */
  async getRecentCalendarEvents(options: CalendarQueryOptions = {}): Promise<CalendarEventData[]> {
    try {
      const params: Record<string, string> = {};
      
      if (options.maxResults) params.maxResults = options.maxResults.toString();
      if (options.timeMin) params.timeMin = options.timeMin;
      if (options.timeMax) params.timeMax = options.timeMax;
      if (options.pageToken) params.pageToken = options.pageToken;

      const response = await this.apiClient.get('/api/calendar/events', params);
      
      if (!response.data || !Array.isArray(response.data.items)) {
        return [];
      }

      return response.data.items.map((event: any) => this.formatCalendarEventData(event));
    } catch (error) {
      this.z.console.error('Failed to get calendar events:', error);
      throw new Error(`Failed to get calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a calendar event
   */
  async createCalendarEvent(eventData: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    attendees?: string[];
    location?: string;
  }): Promise<CalendarEventData> {
    try {
      const response = await this.apiClient.post('/api/calendar/events', eventData);
      return this.formatCalendarEventData(response.data);
    } catch (error) {
      this.z.console.error('Failed to create calendar event:', error);
      throw new Error(`Failed to create calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format email data from Gmail API response
   */
  private formatEmailData(message: any): EmailData {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: message.id || '',
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      body: this.extractEmailBody(message.payload) || message.snippet || '',
      timestamp: new Date(parseInt(message.internalDate || '0')).toISOString(),
      headers: headers.reduce((acc: Record<string, string>, header: any) => {
        acc[header.name] = header.value;
        return acc;
      }, {}),
      threadId: message.threadId || '',
      snippet: message.snippet || '',
      internalDate: message.internalDate || '',
    };
  }

  /**
   * Format calendar event data from Calendar API response
   */
  private formatCalendarEventData(event: any): CalendarEventData {
    return {
      id: event.id || '',
      summary: event.summary || '',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      attendees: event.attendees?.map((a: any) => a.email).filter(Boolean) || [],
      location: event.location || '',
    };
  }

  /**
   * Extract email body from Gmail payload
   */
  private extractEmailBody(payload: any): string {
    if (!payload) return '';

    // If it's a simple message
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // If it's a multipart message
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        // Recursively check nested parts
        if (part.parts) {
          const nestedBody = this.extractEmailBody(part);
          if (nestedBody) return nestedBody;
        }
      }
    }

    return '';
  }

} 