import { Bundle, ZObject } from 'zapier-platform-core';
import { GoogleClient } from '../utils/google-client';

export interface EmailSearchTrigger {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  headers: Record<string, string>;
  threadId: string;
  snippet: string;
  labels: string[];
  matchedQuery: string;
}

// Perform list function for polling trigger
const performList = async (z: ZObject, bundle: Bundle): Promise<EmailSearchTrigger[]> => {
  const googleClient = new GoogleClient(z, bundle);
  
  try {
    const inputData = bundle.inputData as Record<string, any>;
    const searchQuery = inputData.searchQuery as string;
    
    if (!searchQuery) {
      throw new Error('Search query is required for email matching search trigger');
    }

    const emails = await googleClient.getRecentEmails({
      maxResults: (inputData.maxResults as number) || 10,
      query: searchQuery,
      labelIds: inputData.labelIds as string,
    });
    
    return emails.map((email: any) => ({
      id: email.id,
      subject: email.subject || '',
      from: email.from || '',
      to: email.to || '',
      body: email.body || email.snippet || '',
      timestamp: email.timestamp || email.internalDate,
      headers: email.headers || {},
      threadId: email.threadId || '',
      snippet: email.snippet || '',
      labels: email.labels || [],
      matchedQuery: searchQuery,
    }));
  } catch (error) {
    z.console.error('Failed to fetch emails matching search:', error);
    throw new Error(`Failed to fetch emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Perform subscribe function for webhook trigger
const performSubscribe = async (z: ZObject, bundle: Bundle) => {
  try {
    const inputData = bundle.inputData as Record<string, any>;
    const searchQuery = inputData.searchQuery as string;
    
    if (!searchQuery) {
      throw new Error('Search query is required for email matching search trigger');
    }

    // Set up Gmail push notifications with search filter via your server
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
        query: searchQuery,
        labelIds: inputData.labelIds,
        userId: bundle.authData.userId,
        triggerType: 'search',
      },
    });
    
    return response.data;
  } catch (error) {
    z.console.error('Failed to subscribe to Gmail search notifications:', error);
    throw new Error(`Failed to subscribe: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Perform unsubscribe function for webhook trigger
const performUnsubscribe = async (z: ZObject, bundle: Bundle) => {
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
  } catch (error) {
    z.console.error('Failed to unsubscribe from Gmail search notifications:', error);
    // Don't throw error on unsubscribe failure
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export default {
  key: 'email_matching_search',
  noun: 'Email Search',
  display: {
    label: 'Email Matching Search',
    description: 'Triggers when emails matching a specific Gmail search query are received.',

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
        key: 'searchQuery',
        label: 'Gmail Search Query',
        helpText: 'Gmail search query to match emails (e.g., "from:support@company.com is:unread", "has:attachment subject:invoice")',
        type: 'string',
        required: true,
        placeholder: 'from:support@company.com is:unread',
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
        helpText: 'Comma-separated list of Gmail label IDs to filter by (optional)',
        type: 'string',
        required: false,
      },
    ],
    
    // Sample data for testing
    sample: {
      id: 'email-search-123456789',
      subject: 'Support Request: Payment Issue',
      from: 'customer@example.com',
      to: 'support@company.com',
      body: 'I am having trouble with my payment processing. The transaction keeps failing.',
      timestamp: '2024-01-15T11:30:00Z',
      headers: {
        'message-id': '<search123456789@mail.gmail.com>',
        'reply-to': 'customer@example.com',
      },
      threadId: 'thread-search-123456789',
      snippet: 'I am having trouble with my payment processing...',
      labels: ['INBOX', 'UNREAD', 'SUPPORT'],
      matchedQuery: 'to:support@company.com is:unread',
    },
    
    // Output fields definition
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
      { key: 'labels', label: 'Labels', type: 'string', list: true },
      { key: 'matchedQuery', label: 'Matched Query', type: 'string' },
    ],
  },
}; 