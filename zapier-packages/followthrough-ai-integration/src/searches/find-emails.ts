import { Bundle, ZObject } from 'zapier-platform-core';
import { GoogleClient } from '../utils/google-client';

interface FindEmailsInput {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  labelIds?: string;
  maxResults?: number;
  dateAfter?: string;
  dateBefore?: string;
}

export interface EmailSearchResult {
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
  hasAttachments: boolean;
  isUnread: boolean;
}

const perform = async (z: ZObject, bundle: Bundle): Promise<EmailSearchResult[]> => {
  const inputData = bundle.inputData as unknown as FindEmailsInput;
  const { 
    query, 
    from, 
    to, 
    subject, 
    hasAttachment, 
    isUnread, 
    labelIds, 
    maxResults, 
    dateAfter, 
    dateBefore 
  } = inputData;

  const googleClient = new GoogleClient(z, bundle);

  try {
    // Build Gmail search query
    let searchQuery = query || '';
    
    if (from) searchQuery += ` from:${from}`;
    if (to) searchQuery += ` to:${to}`;
    if (subject) searchQuery += ` subject:"${subject}"`;
    if (hasAttachment) searchQuery += ' has:attachment';
    if (isUnread) searchQuery += ' is:unread';
    if (dateAfter) searchQuery += ` after:${dateAfter}`;
    if (dateBefore) searchQuery += ` before:${dateBefore}`;

    // Remove leading/trailing spaces
    searchQuery = searchQuery.trim();

    if (!searchQuery) {
      searchQuery = 'in:inbox'; // Default to inbox if no query specified
    }

    const emails = await googleClient.getRecentEmails({
      maxResults: maxResults || 25,
      query: searchQuery,
      labelIds: labelIds,
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
      hasAttachments: email.hasAttachments || false,
      isUnread: email.isUnread || false,
    }));
  } catch (error) {
    z.console.error('Email search failed:', error);
    throw new Error(`Failed to search emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default {
  key: 'findEmails',
  noun: 'Email',
  display: {
    label: 'Find Emails',
    description: 'Search for emails in Gmail using various criteria',

  },
  operation: {
    inputFields: [
      {
        key: 'query',
        label: 'Search Query',
        type: 'string',
        required: false,
        helpText: 'Gmail search query (e.g., "is:unread has:attachment")',
      },
      {
        key: 'from',
        label: 'From Email',
        type: 'string',
        required: false,
        helpText: 'Search emails from specific sender',
      },
      {
        key: 'to',
        label: 'To Email',
        type: 'string',
        required: false,
        helpText: 'Search emails sent to specific recipient',
      },
      {
        key: 'subject',
        label: 'Subject Contains',
        type: 'string',
        required: false,
        helpText: 'Search emails with specific text in subject',
      },
      {
        key: 'hasAttachment',
        label: 'Has Attachment',
        type: 'boolean',
        required: false,
        helpText: 'Only return emails with attachments',
      },
      {
        key: 'isUnread',
        label: 'Is Unread',
        type: 'boolean',
        required: false,
        helpText: 'Only return unread emails',
      },
      {
        key: 'labelIds',
        label: 'Label IDs',
        type: 'string',
        required: false,
        helpText: 'Comma-separated list of Gmail label IDs',
      },
      {
        key: 'maxResults',
        label: 'Max Results',
        type: 'integer',
        required: false,
        default: '25',
        helpText: 'Maximum number of emails to return (1-100)',
      },
      {
        key: 'dateAfter',
        label: 'Date After',
        type: 'datetime',
        required: false,
        helpText: 'Only return emails after this date',
      },
      {
        key: 'dateBefore',
        label: 'Date Before',
        type: 'datetime',
        required: false,
        helpText: 'Only return emails before this date',
      },
    ],
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
      { key: 'hasAttachments', label: 'Has Attachments', type: 'boolean' },
      { key: 'isUnread', label: 'Is Unread', type: 'boolean' },
    ],
    perform,
    sample: {
      id: 'search-email-123456789',
      subject: 'Project Update - Q1 Progress Report',
      from: 'project.manager@company.com',
      to: 'team@company.com',
      body: 'Here is the Q1 progress report for our project. We have completed 75% of the planned milestones.',
      timestamp: '2024-01-15T14:30:00Z',
      headers: {
        'message-id': '<search123456789@mail.gmail.com>',
        'reply-to': 'project.manager@company.com',
      },
      threadId: 'thread-search-123456789',
      snippet: 'Here is the Q1 progress report for our project...',
      labels: ['INBOX', 'IMPORTANT', 'PROJECT'],
      hasAttachments: true,
      isUnread: false,
    },
  },
}; 