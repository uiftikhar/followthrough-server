import { Bundle, ZObject } from 'zapier-platform-core';
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
export declare class GoogleClient {
    private apiClient;
    private z;
    constructor(z: ZObject, bundle: Bundle);
    /**
     * Get recent emails from Gmail via your server's proxy
     */
    getRecentEmails(options?: EmailQueryOptions): Promise<EmailData[]>;
    /**
     * Get a specific email by ID
     */
    getEmail(emailId: string): Promise<EmailData>;
    /**
     * Send an email via Gmail
     */
    sendEmail(emailData: {
        to: string;
        subject: string;
        body: string;
        isHtml?: boolean;
        inReplyTo?: string;
        references?: string;
    }): Promise<{
        id: string;
        threadId: string;
        labelIds: string[];
        snippet: string;
    }>;
    /**
     * Get recent calendar events
     */
    getRecentCalendarEvents(options?: CalendarQueryOptions): Promise<CalendarEventData[]>;
    /**
     * Create a calendar event
     */
    createCalendarEvent(eventData: {
        summary: string;
        description?: string;
        start: string;
        end: string;
        attendees?: string[];
        location?: string;
    }): Promise<CalendarEventData>;
    /**
     * Format email data from Gmail API response
     */
    private formatEmailData;
    /**
     * Format calendar event data from Calendar API response
     */
    private formatCalendarEventData;
    /**
     * Extract email body from Gmail payload
     */
    private extractEmailBody;
}
//# sourceMappingURL=google-client.d.ts.map