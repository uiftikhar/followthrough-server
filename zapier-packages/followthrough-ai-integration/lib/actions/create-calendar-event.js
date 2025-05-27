"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_client_1 = require("../utils/google-client");
const perform = async (z, bundle) => {
    const inputData = bundle.inputData;
    const { summary, description, start, end, attendees, location, timezone, reminders, reminderMinutes } = inputData;
    if (!summary || !start || !end) {
        throw new Error('Summary, start time, and end time are required for creating calendar event');
    }
    const googleClient = new google_client_1.GoogleClient(z, bundle);
    try {
        const eventData = {
            summary,
            description: description || '',
            start,
            end,
            attendees: attendees || [],
            location: location || '',
            timezone: timezone || 'UTC',
            reminders: reminders || false,
            reminderMinutes: reminderMinutes || 15,
        };
        const result = await googleClient.createCalendarEvent(eventData);
        return {
            id: result.id,
            summary: result.summary,
            description: result.description,
            start: result.start,
            end: result.end,
            attendees: result.attendees,
            location: result.location,
            htmlLink: `https://calendar.google.com/calendar/event?eid=${result.id}`,
            success: true,
        };
    }
    catch (error) {
        z.console.error('Failed to create calendar event:', error);
        throw new Error(`Failed to create calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
exports.default = {
    key: 'createCalendarEvent',
    noun: 'Calendar Event',
    display: {
        label: 'Create Calendar Event',
        description: 'Create a new calendar event in Google Calendar',
    },
    operation: {
        inputFields: [
            {
                key: 'summary',
                label: 'Event Title',
                type: 'string',
                required: true,
                helpText: 'The title/summary of the calendar event',
            },
            {
                key: 'description',
                label: 'Description',
                type: 'text',
                required: false,
                helpText: 'Detailed description or agenda for the event',
            },
            {
                key: 'start',
                label: 'Start Time',
                type: 'datetime',
                required: true,
                helpText: 'Start time of the event (ISO format)',
            },
            {
                key: 'end',
                label: 'End Time',
                type: 'datetime',
                required: true,
                helpText: 'End time of the event (ISO format)',
            },
            {
                key: 'attendees',
                label: 'Attendees',
                type: 'string',
                required: false,
                list: true,
                helpText: 'List of attendee email addresses',
            },
            {
                key: 'location',
                label: 'Location',
                type: 'string',
                required: false,
                helpText: 'Meeting location or video conference link',
            },
            {
                key: 'timezone',
                label: 'Timezone',
                type: 'string',
                required: false,
                default: 'UTC',
                helpText: 'Timezone for the event (e.g., America/New_York)',
            },
            {
                key: 'reminders',
                label: 'Enable Reminders',
                type: 'boolean',
                required: false,
                default: 'true',
                helpText: 'Whether to enable email/popup reminders',
            },
            {
                key: 'reminderMinutes',
                label: 'Reminder Minutes',
                type: 'integer',
                required: false,
                default: '15',
                helpText: 'Minutes before event to send reminder',
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
            { key: 'htmlLink', label: 'Calendar Link', type: 'string' },
            { key: 'success', label: 'Success', type: 'boolean' },
        ],
        perform,
        sample: {
            id: 'event-123456789',
            summary: 'Team Standup Meeting',
            description: 'Daily team standup to discuss progress and blockers',
            start: '2024-01-15T09:00:00Z',
            end: '2024-01-15T09:30:00Z',
            attendees: ['team@company.com', 'manager@company.com'],
            location: 'Conference Room A',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=event-123456789',
            success: true,
        },
    },
};
//# sourceMappingURL=create-calendar-event.js.map