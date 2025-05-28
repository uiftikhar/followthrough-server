"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleClient = void 0;
const api_client_1 = require("./api-client");
class GoogleClient {
    constructor(z, bundle) {
        this.z = z;
        this.apiClient = new api_client_1.ApiClient(z, bundle);
    }
    /**
     * Get recent emails from Gmail via your server's proxy
     */
    async getRecentEmails(options = {}) {
        try {
            const params = {};
            if (options.maxResults)
                params.maxResults = options.maxResults.toString();
            if (options.query)
                params.query = options.query;
            if (options.labelIds)
                params.labelIds = options.labelIds;
            if (options.pageToken)
                params.pageToken = options.pageToken;
            const response = await this.apiClient.get('/api/gmail/messages', params);
            if (!response.data || !Array.isArray(response.data.messages)) {
                return [];
            }
            return response.data.messages.map((message) => this.formatEmailData(message));
        }
        catch (error) {
            this.z.console.error('Failed to get recent emails:', error);
            throw new Error(`Failed to get emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get a specific email by ID
     */
    async getEmail(emailId) {
        try {
            const response = await this.apiClient.get(`/api/gmail/messages/${emailId}`);
            return this.formatEmailData(response.data);
        }
        catch (error) {
            this.z.console.error(`Failed to get email ${emailId}:`, error);
            throw new Error(`Failed to get email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Send an email via Gmail
     */
    async sendEmail(emailData) {
        try {
            const response = await this.apiClient.post('/api/gmail/send', emailData);
            return response.data;
        }
        catch (error) {
            this.z.console.error('Failed to send email:', error);
            throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get recent calendar events
     */
    async getRecentCalendarEvents(options = {}) {
        try {
            const params = {};
            if (options.maxResults)
                params.maxResults = options.maxResults.toString();
            if (options.timeMin)
                params.timeMin = options.timeMin;
            if (options.timeMax)
                params.timeMax = options.timeMax;
            if (options.pageToken)
                params.pageToken = options.pageToken;
            const response = await this.apiClient.get('/api/calendar/events', params);
            if (!response.data || !Array.isArray(response.data.items)) {
                return [];
            }
            return response.data.items.map((event) => this.formatCalendarEventData(event));
        }
        catch (error) {
            this.z.console.error('Failed to get calendar events:', error);
            throw new Error(`Failed to get calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create a calendar event
     */
    async createCalendarEvent(eventData) {
        try {
            const response = await this.apiClient.post('/api/calendar/events', eventData);
            return this.formatCalendarEventData(response.data);
        }
        catch (error) {
            this.z.console.error('Failed to create calendar event:', error);
            throw new Error(`Failed to create calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Format email data from Gmail API response
     */
    formatEmailData(message) {
        const headers = message.payload?.headers || [];
        const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        return {
            id: message.id || '',
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: getHeader('To'),
            body: this.extractEmailBody(message.payload) || message.snippet || '',
            timestamp: new Date(parseInt(message.internalDate || '0')).toISOString(),
            headers: headers.reduce((acc, header) => {
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
    formatCalendarEventData(event) {
        return {
            id: event.id || '',
            summary: event.summary || '',
            description: event.description || '',
            start: event.start?.dateTime || event.start?.date || '',
            end: event.end?.dateTime || event.end?.date || '',
            attendees: event.attendees?.map((a) => a.email).filter(Boolean) || [],
            location: event.location || '',
        };
    }
    /**
     * Extract email body from Gmail payload
     */
    extractEmailBody(payload) {
        if (!payload)
            return '';
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
                    if (nestedBody)
                        return nestedBody;
                }
            }
        }
        return '';
    }
}
exports.GoogleClient = GoogleClient;
//# sourceMappingURL=google-client.js.map