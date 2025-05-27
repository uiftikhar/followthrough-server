"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_client_1 = require("../utils/google-client");
// Perform list function for polling trigger
const performList = async (z, bundle) => {
    const googleClient = new google_client_1.GoogleClient(z, bundle);
    try {
        const inputData = bundle.inputData;
        const events = await googleClient.getRecentCalendarEvents({
            maxResults: inputData.maxResults || 10,
            timeMin: inputData.timeMin || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            timeMax: inputData.timeMax,
        });
        return events.map((event) => ({
            id: event.id,
            summary: event.summary || '',
            description: event.description || '',
            start: event.start || '',
            end: event.end || '',
            attendees: event.attendees || [],
            location: event.location || '',
            creator: event.creator || '',
            created: event.created || '',
            updated: event.updated || '',
            htmlLink: `https://calendar.google.com/calendar/event?eid=${event.id}`,
        }));
    }
    catch (error) {
        z.console.error('Failed to fetch calendar events:', error);
        throw new Error(`Failed to fetch calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// Perform subscribe function for webhook trigger
const performSubscribe = async (z, bundle) => {
    try {
        const inputData = bundle.inputData;
        // Set up Calendar push notifications via your server
        const response = await z.request({
            url: `${process.env.FOLLOWTHROUGH_API_URL}/api/calendar/subscribe`,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${bundle.authData.access_token}`,
                'Content-Type': 'application/json',
                'x-api-key': bundle.authData.api_key,
            },
            body: {
                targetUrl: bundle.targetUrl,
                calendarId: inputData.calendarId || 'primary',
                userId: bundle.authData.userId,
            },
        });
        return response.data;
    }
    catch (error) {
        z.console.error('Failed to subscribe to Calendar notifications:', error);
        throw new Error(`Failed to subscribe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// Perform unsubscribe function for webhook trigger
const performUnsubscribe = async (z, bundle) => {
    try {
        // Cleanup subscription
        if (bundle.subscribeData?.id) {
            await z.request({
                url: `${process.env.FOLLOWTHROUGH_API_URL}/api/calendar/unsubscribe/${bundle.subscribeData.id}`,
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${bundle.authData.access_token}`,
                    'x-api-key': bundle.authData.api_key,
                },
            });
        }
        return { success: true };
    }
    catch (error) {
        z.console.error('Failed to unsubscribe from Calendar notifications:', error);
        // Don't throw error on unsubscribe failure
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
};
exports.default = {
    key: 'new_calendar_event',
    noun: 'Calendar Event',
    display: {
        label: 'New Calendar Event',
        description: 'Triggers when a new calendar event is created in Google Calendar.',
    },
    operation: {
        type: 'hook',
        performSubscribe,
        performUnsubscribe,
        perform: performList, // Required for hook triggers
        performList, // Fallback for polling if webhooks fail
        // Input fields for configuration
        inputFields: [
            {
                key: 'calendarId',
                label: 'Calendar ID',
                helpText: 'Calendar ID to monitor (leave empty for primary calendar)',
                type: 'string',
                required: false,
                default: 'primary',
            },
            {
                key: 'maxResults',
                label: 'Max Results',
                helpText: 'Maximum number of events to return (1-50)',
                type: 'integer',
                required: false,
                default: '10',
            },
            {
                key: 'timeMin',
                label: 'Start Time Filter',
                helpText: 'Only return events after this time (ISO format)',
                type: 'datetime',
                required: false,
            },
            {
                key: 'timeMax',
                label: 'End Time Filter',
                helpText: 'Only return events before this time (ISO format)',
                type: 'datetime',
                required: false,
            },
        ],
        // Sample data for testing
        sample: {
            id: 'event-123456789',
            summary: 'Team Planning Meeting',
            description: 'Weekly team planning and retrospective session',
            start: '2024-01-15T14:00:00Z',
            end: '2024-01-15T15:00:00Z',
            attendees: ['team@company.com', 'manager@company.com'],
            location: 'Conference Room B',
            creator: 'organizer@company.com',
            created: '2024-01-14T10:00:00Z',
            updated: '2024-01-14T10:00:00Z',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=event-123456789',
        },
        // Output fields definition
        outputFields: [
            { key: 'id', label: 'Event ID', type: 'string' },
            { key: 'summary', label: 'Event Title', type: 'string' },
            { key: 'description', label: 'Description', type: 'string' },
            { key: 'start', label: 'Start Time', type: 'datetime' },
            { key: 'end', label: 'End Time', type: 'datetime' },
            { key: 'attendees', label: 'Attendees', type: 'string', list: true },
            { key: 'location', label: 'Location', type: 'string' },
            { key: 'creator', label: 'Creator', type: 'string' },
            { key: 'created', label: 'Created Time', type: 'datetime' },
            { key: 'updated', label: 'Updated Time', type: 'datetime' },
            { key: 'htmlLink', label: 'Calendar Link', type: 'string' },
        ],
    },
};
//# sourceMappingURL=new-calendar-event.js.map