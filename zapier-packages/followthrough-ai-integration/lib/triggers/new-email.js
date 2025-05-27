"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_client_1 = require("../utils/google-client");
// Perform list function for polling trigger
const performList = async (z, bundle) => {
    const googleClient = new google_client_1.GoogleClient(z, bundle);
    try {
        // Get recent emails using your existing Google OAuth integration
        const inputData = bundle.inputData;
        const emails = await googleClient.getRecentEmails({
            maxResults: inputData.maxResults || 10,
            query: inputData.query || 'is:unread',
            labelIds: inputData.labelIds,
        });
        return emails.map((email) => ({
            id: email.id,
            subject: email.subject || '',
            from: email.from || '',
            to: email.to || '',
            body: email.body || email.snippet || '',
            timestamp: email.timestamp || email.internalDate,
            headers: email.headers || {},
            threadId: email.threadId || '',
            snippet: email.snippet || '',
        }));
    }
    catch (error) {
        z.console.error('Failed to fetch emails:', error);
        throw new Error(`Failed to fetch emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// Perform subscribe function for webhook trigger
const performSubscribe = async (z, bundle) => {
    try {
        // Set up Gmail push notifications via your server
        const response = await z.request({
            url: `${process.env.FOLLOWTHROUGH_API_URL}/api/gmail/subscribe`,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${bundle.authData.access_token}`,
                'Content-Type': 'application/json',
                'x-api-key': bundle.authData.api_key,
            },
            body: {
                targetUrl: bundle.targetUrl,
                query: bundle.inputData.query || 'is:unread',
                labelIds: bundle.inputData.labelIds,
                userId: bundle.authData.userId,
            },
        });
        return response.data;
    }
    catch (error) {
        z.console.error('Failed to subscribe to Gmail notifications:', error);
        throw new Error(`Failed to subscribe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// Perform unsubscribe function for webhook trigger
const performUnsubscribe = async (z, bundle) => {
    try {
        // Cleanup subscription
        if (bundle.subscribeData?.id) {
            await z.request({
                url: `${process.env.FOLLOWTHROUGH_API_URL}/api/gmail/unsubscribe/${bundle.subscribeData.id}`,
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
        z.console.error('Failed to unsubscribe from Gmail notifications:', error);
        // Don't throw error on unsubscribe failure
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
};
exports.default = {
    key: 'new_email',
    noun: 'Email',
    display: {
        label: 'New Email',
        description: 'Triggers when a new email is received in Gmail. Can be filtered by search query.',
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
                key: 'query',
                label: 'Gmail Search Query',
                helpText: 'Optional Gmail search query to filter emails (e.g., "is:unread", "from:support@company.com")',
                type: 'string',
                required: false,
                default: 'is:unread',
            },
            {
                key: 'maxResults',
                label: 'Max Results',
                helpText: 'Maximum number of emails to return (1-50)',
                type: 'integer',
                required: false,
                default: '10',
            },
            {
                key: 'labelIds',
                label: 'Label IDs',
                helpText: 'Comma-separated list of Gmail label IDs to filter by',
                type: 'string',
                required: false,
            },
        ],
        // Sample data for testing
        sample: {
            id: 'email-123456789',
            subject: 'Welcome to FollowThrough AI',
            from: 'support@followthrough.ai',
            to: 'user@example.com',
            body: 'Thank you for signing up for FollowThrough AI. We\'re excited to help you automate your email triage and meeting analysis.',
            timestamp: '2024-01-15T10:30:00Z',
            headers: {
                'message-id': '<123456789@mail.gmail.com>',
                'reply-to': 'support@followthrough.ai',
            },
            threadId: 'thread-123456789',
            snippet: 'Thank you for signing up for FollowThrough AI...',
        },
        // Output fields definition
        outputFields: [
            { key: 'id', label: 'Email ID', type: 'string' },
            { key: 'subject', label: 'Subject', type: 'string' },
            { key: 'from', label: 'From', type: 'string' },
            { key: 'to', label: 'To', type: 'string' },
            { key: 'body', label: 'Body', type: 'string' },
            { key: 'timestamp', label: 'Timestamp', type: 'datetime' },
            { key: 'headers', label: 'Headers' },
            { key: 'threadId', label: 'Thread ID', type: 'string' },
            { key: 'snippet', label: 'Snippet', type: 'string' },
        ],
    },
};
//# sourceMappingURL=new-email.js.map