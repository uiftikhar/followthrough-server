"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_client_1 = require("../utils/google-client");
const perform = async (z, bundle) => {
    const inputData = bundle.inputData;
    const { summary, description, attendee, location, maxResults, timeMin, timeMax, orderBy } = inputData;
    const googleClient = new google_client_1.GoogleClient(z, bundle);
    try {
        // Build search parameters
        const searchParams = {
            maxResults: maxResults || 25,
            timeMin: timeMin || new Date().toISOString(), // Default to current time
            timeMax: timeMax,
            orderBy: orderBy || 'startTime',
        };
        // Get events from Google Calendar
        const events = await googleClient.getRecentCalendarEvents(searchParams);
        // Filter events based on search criteria
        let filteredEvents = events;
        if (summary) {
            filteredEvents = filteredEvents.filter(event => event.summary?.toLowerCase().includes(summary.toLowerCase()));
        }
        if (description) {
            filteredEvents = filteredEvents.filter(event => event.description?.toLowerCase().includes(description.toLowerCase()));
        }
        if (attendee) {
            filteredEvents = filteredEvents.filter(event => event.attendees?.some(att => att.toLowerCase().includes(attendee.toLowerCase())));
        }
        if (location) {
            filteredEvents = filteredEvents.filter(event => event.location?.toLowerCase().includes(location.toLowerCase()));
        }
        return filteredEvents.map((event) => ({
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
            status: event.status || 'confirmed',
            organizer: event.organizer || event.creator || '',
        }));
    }
    catch (error) {
        z.console.error('Calendar event search failed:', error);
        throw new Error(`Failed to search calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
exports.default = {
    key: 'findEvents',
    noun: 'Calendar Event',
    display: {
        label: 'Find Calendar Events',
        description: 'Search for calendar events in Google Calendar using various criteria',
    },
    operation: {
        inputFields: [
            {
                key: 'summary',
                label: 'Event Title Contains',
                type: 'string',
                required: false,
                helpText: 'Search events with specific text in title/summary',
            },
            {
                key: 'description',
                label: 'Description Contains',
                type: 'string',
                required: false,
                helpText: 'Search events with specific text in description',
            },
            {
                key: 'attendee',
                label: 'Attendee Email',
                type: 'string',
                required: false,
                helpText: 'Search events with specific attendee',
            },
            {
                key: 'location',
                label: 'Location Contains',
                type: 'string',
                required: false,
                helpText: 'Search events with specific location',
            },
            {
                key: 'calendarId',
                label: 'Calendar ID',
                type: 'string',
                required: false,
                default: 'primary',
                helpText: 'Calendar ID to search in (default: primary)',
            },
            {
                key: 'maxResults',
                label: 'Max Results',
                type: 'integer',
                required: false,
                default: '25',
                helpText: 'Maximum number of events to return (1-100)',
            },
            {
                key: 'timeMin',
                label: 'Start Time',
                type: 'datetime',
                required: false,
                helpText: 'Only return events after this time (default: now)',
            },
            {
                key: 'timeMax',
                label: 'End Time',
                type: 'datetime',
                required: false,
                helpText: 'Only return events before this time',
            },
            {
                key: 'orderBy',
                label: 'Order By',
                type: 'string',
                required: false,
                choices: ['startTime', 'updated'],
                default: 'startTime',
                helpText: 'How to order the results',
            },
        ],
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
            { key: 'status', label: 'Status', type: 'string' },
            { key: 'organizer', label: 'Organizer', type: 'string' },
        ],
        perform,
        sample: {
            id: 'search-event-123456789',
            summary: 'Weekly Team Standup',
            description: 'Weekly team standup meeting to discuss progress, blockers, and upcoming tasks',
            start: '2024-01-15T09:00:00Z',
            end: '2024-01-15T09:30:00Z',
            attendees: ['team@company.com', 'manager@company.com', 'lead@company.com'],
            location: 'Conference Room A',
            creator: 'manager@company.com',
            created: '2024-01-08T10:00:00Z',
            updated: '2024-01-14T15:30:00Z',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=search-event-123456789',
            status: 'confirmed',
            organizer: 'manager@company.com',
        },
    },
};
//# sourceMappingURL=find-events.js.map