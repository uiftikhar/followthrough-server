import { Bundle, ZObject } from 'zapier-platform-core';
import { ApiClient } from '../utils/api-client';

interface EmailTriageInput {
  emailId: string;
  messageId?: string;
  threadId?: string;
  priority?: 'low' | 'medium' | 'high';
  customInstructions?: string;
}

export interface EmailTriageOutput {
  triageId: string;
  status: 'processing' | 'completed' | 'failed';
  classification?: {
    category: string;
    priority: string;
    sentiment: string;
    urgency: string;
  };
  summary?: string;
  suggestedActions?: string[];
  draftReply?: {
    subject: string;
    body: string;
    tone: string;
  };
  extractedTasks?: Array<{
    title: string;
    description: string;
    priority: string;
    dueDate?: string;
  }>;
  processingTime?: number;
  confidence?: number;
}

const perform = async (z: ZObject, bundle: Bundle): Promise<EmailTriageOutput> => {
  const inputData = bundle.inputData as unknown as EmailTriageInput;
  const { emailId, messageId, threadId, priority, customInstructions } = inputData;

  if (!emailId) {
    throw new Error('Email ID is required for email triage');
  }

  const apiClient = new ApiClient(z, bundle);

  try {
    // Trigger email triage through the FollowThrough AI server
    const response = await apiClient.post('/api/zapier/webhooks/email', {
      emailId,
      messageId,
      threadId,
      priority: priority || 'medium',
      customInstructions,
      source: 'zapier',
      timestamp: new Date().toISOString(),
    });

    // The server returns the triage results
    return {
      triageId: response.triageId || `triage_${Date.now()}`,
      status: response.status || 'processing',
      classification: response.classification,
      summary: response.summary,
      suggestedActions: response.suggestedActions || [],
      draftReply: response.draftReply,
      extractedTasks: response.extractedTasks || [],
      processingTime: response.processingTime,
      confidence: response.confidence,
    };
  } catch (error) {
    z.console.error('Email triage failed:', error);
    throw new Error(`Failed to trigger email triage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default {
  key: 'triggerEmailTriage',
  noun: 'Email Triage',
  display: {
    label: 'Trigger Email Triage',
    description: 'Process an email through FollowThrough AI agents for classification, summarization, and response generation',

  },
  operation: {
    inputFields: [
      {
        key: 'emailId',
        label: 'Email ID',
        type: 'string',
        required: true,
        helpText: 'The unique identifier of the email to process',
      },
      {
        key: 'messageId',
        label: 'Message ID',
        type: 'string',
        required: false,
        helpText: 'Gmail message ID (optional, will be extracted from email if not provided)',
      },
      {
        key: 'threadId',
        label: 'Thread ID',
        type: 'string',
        required: false,
        helpText: 'Gmail thread ID for conversation context',
      },
      {
        key: 'priority',
        label: 'Processing Priority',
        type: 'string',
        required: false,
        choices: ['low', 'medium', 'high'],
        default: 'medium',
        helpText: 'Priority level for processing this email',
      },
      {
        key: 'customInstructions',
        label: 'Custom Instructions',
        type: 'text',
        required: false,
        helpText: 'Additional instructions for the AI agents (e.g., specific tone, focus areas)',
      },
    ],
    outputFields: [
      { key: 'triageId', label: 'Triage ID', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'classification__category', label: 'Category', type: 'string' },
      { key: 'classification__priority', label: 'Priority', type: 'string' },
      { key: 'classification__sentiment', label: 'Sentiment', type: 'string' },
      { key: 'classification__urgency', label: 'Urgency', type: 'string' },
      { key: 'summary', label: 'Summary', type: 'string' },
      { key: 'suggestedActions', label: 'Suggested Actions', type: 'string', list: true },
      { key: 'draftReply__subject', label: 'Draft Reply Subject', type: 'string' },
      { key: 'draftReply__body', label: 'Draft Reply Body', type: 'string' },
      { key: 'draftReply__tone', label: 'Draft Reply Tone', type: 'string' },
      { key: 'extractedTasks', label: 'Extracted Tasks', type: 'string', list: true },
      { key: 'processingTime', label: 'Processing Time (ms)', type: 'integer' },
      { key: 'confidence', label: 'Confidence Score', type: 'number' },
    ],
    perform,
    sample: {
      triageId: 'triage_1234567890',
      status: 'completed',
      classification: {
        category: 'business_inquiry',
        priority: 'high',
        sentiment: 'neutral',
        urgency: 'medium',
      },
      summary: 'Customer inquiry about product pricing and availability for enterprise solution.',
      suggestedActions: [
        'Schedule follow-up call',
        'Send pricing information',
        'Connect with sales team',
      ],
      draftReply: {
        subject: 'Re: Enterprise Solution Inquiry',
        body: 'Thank you for your interest in our enterprise solution. I\'d be happy to provide you with detailed pricing information and schedule a call to discuss your specific needs.',
        tone: 'professional',
      },
      extractedTasks: [
        'Follow up with customer within 24 hours',
        'Prepare enterprise pricing proposal',
      ],
      processingTime: 2500,
      confidence: 0.92,
    },
  },
}; 