import { Bundle, ZObject } from 'zapier-platform-core';
import { GoogleClient } from '../utils/google-client';
import { ApiClient } from '../utils/api-client';

export interface EmailTrigger {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  headers: string;
  threadId: string;
  snippet: string;
}

// Perform list function for polling trigger
const performList = async (z: ZObject, bundle: Bundle): Promise<EmailTrigger[]> => {
  const googleClient = new GoogleClient(z, bundle);

  try {
    const input = bundle.inputData as Record<string, any>;
    const emails = await googleClient.getRecentEmails({
      maxResults: parseInt(input.maxResults, 10) || 10,
      query: input.query || 'is:unread',
      labelIds: input.labelIds,
    });

    return emails.map((email: any) => {
      // Normalize timestamp to ISO-8601
      const ms = email.internalDate
        ? parseInt(email.internalDate, 10)
        : Date.parse(email.timestamp as string);
      const iso = new Date(ms).toISOString();

      return {
        id: email.id,
        subject: email.subject || '',
        from: email.from || '',
        to: email.to || '',
        body: email.body || email.snippet || '',
        timestamp: iso,
        headers: JSON.stringify(email.headers || {}),
        threadId: email.threadId || '',
        snippet: email.snippet || '',
      };
    });
  } catch (error: any) {
    z.console.error('Failed to fetch emails:', error);
    throw new Error(`Failed to fetch emails: ${error.message}`);
  }
};

// Perform subscribe function for webhook trigger
const performSubscribe = async (z: ZObject, bundle: Bundle) => {
  const apiClient = new ApiClient(z, bundle);
  try {
    const response = await apiClient.post('/api/zapier/webhooks/gmail/subscribe', {
      targetUrl: bundle.targetUrl,
      query: bundle.inputData.query || 'is:unread',
      labelIds: bundle.inputData.labelIds,
      userId: bundle.authData.userId,
    });
    return response.data;
  } catch (error: any) {
    z.console.error('Failed to subscribe to Gmail notifications:', error);
    throw new Error(`Failed to subscribe: ${error.message}`);
  }
};

// Perform unsubscribe function for webhook trigger
const performUnsubscribe = async (z: ZObject, bundle: Bundle) => {
  const apiClient = new ApiClient(z, bundle);
  try {
    if (bundle.subscribeData?.id) {
      // await z.request({
      //   url: `${process.env.FOLLOWTHROUGH_API_URL}/api/gmail/unsubscribe/${bundle.subscribeData.id}`,
      //   method: 'DELETE',
      //   headers: {
      //     Authorization: `Bearer ${bundle.authData.access_token}`,
      //     'x-api-key': bundle.authData.api_key,
      //   },
      // });
      await apiClient.delete('/api/zapier/webhooks/gmail/unsubscribe/' + bundle.subscribeData.id);
    }
    return { success: true };
  } catch (error: any) {
    z.console.error('Failed to unsubscribe from Gmail notifications:', error);
    return { success: false, error: error.message };
  }
};

export default {
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
    perform: performList,
    performList,

    inputFields: [
      {
        key: 'query',
        label: 'Gmail Search Query',
        helpText:
          'Optional Gmail search query to filter emails (e.g., "is:unread", "from:support@company.com")',
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
        default: '10', // must be a string
      },
      {
        key: 'labelIds',
        label: 'Label IDs',
        helpText: 'Comma-separated list of Gmail label IDs to filter by',
        type: 'string',
        required: false,
      },
    ],

    sample: {
      id: 'email-123456789',
      subject: 'Welcome to FollowThrough AI',
      from: 'support@followthrough.ai',
      to: 'user@example.com',
      body:
        'Thank you for signing up for FollowThrough AI. We’re excited to help you automate your email triage and meeting analysis.',
      timestamp: '2024-01-15T10:30:00.000Z',
      headers:
        '{"message-id":"<123456789@mail.gmail.com>","reply-to":"support@followthrough.ai"}',
      threadId: 'thread-123456789',
      snippet: 'Thank you for signing up for FollowThrough AI...',
    },

    outputFields: [
      { key: 'id', label: 'Email ID', type: 'string' },
      { key: 'subject', label: 'Subject', type: 'string' },
      { key: 'from', label: 'From', type: 'string' },
      { key: 'to', label: 'To', type: 'string' },
      { key: 'body', label: 'Body', type: 'string' },
      { key: 'timestamp', label: 'Timestamp', type: 'datetime' },
      { key: 'headers', label: 'Headers', type: 'string' },
      { key: 'threadId', label: 'Thread ID', type: 'string' },
      { key: 'snippet', label: 'Snippet', type: 'string' },
    ],
  },
};
