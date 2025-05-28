import { Bundle, ZObject } from 'zapier-platform-core';
import { ApiClient } from '../utils/api-client';

interface DraftReplyInput {
  originalEmailId: string;
  originalSubject: string;
  originalFrom: string;
  originalBody: string;
  replyTone?: 'professional' | 'friendly' | 'formal' | 'casual';
  customInstructions?: string;
  includeOriginal?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface DraftReplyOutput {
  draftId: string;
  subject: string;
  body: string;
  tone: string;
  confidence: number;
  suggestedActions: string[];
  estimatedReadTime: number;
  keyPoints: string[];
  success: boolean;
}

const perform = async (z: ZObject, bundle: Bundle): Promise<DraftReplyOutput> => {
  const inputData = bundle.inputData as unknown as DraftReplyInput;
  const { 
    originalEmailId, 
    originalSubject, 
    originalFrom, 
    originalBody, 
    replyTone, 
    customInstructions, 
    includeOriginal, 
    priority 
  } = inputData;

  if (!originalEmailId || !originalSubject || !originalBody) {
    throw new Error('Original email ID, subject, and body are required for draft reply generation');
  }

  const apiClient = new ApiClient(z, bundle);

  try {
    // Generate draft reply through the FollowThrough AI server
    const response = await apiClient.post('/api/zapier/draft-reply', {
      originalEmailId,
      originalSubject,
      originalFrom,
      originalBody,
      replyTone: replyTone || 'professional',
      customInstructions,
      includeOriginal: includeOriginal || false,
      priority: priority || 'medium',
      source: 'zapier',
      timestamp: new Date().toISOString(),
    });

    return {
      draftId: response.data.draftId || `draft_${Date.now()}`,
      subject: response.data.subject || `Re: ${originalSubject}`,
      body: response.data.body || '',
      tone: response.data.tone || replyTone || 'professional',
      confidence: response.data.confidence || 0.8,
      suggestedActions: response.data.suggestedActions || [],
      estimatedReadTime: response.data.estimatedReadTime || 30,
      keyPoints: response.data.keyPoints || [],
      success: true,
    };
  } catch (error) {
    z.console.error('Draft reply generation failed:', error);
    throw new Error(`Failed to generate draft reply: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default {
  key: 'draftReply',
  noun: 'Draft Reply',
  display: {
    label: 'Create Draft Reply',
    description: 'Generate an AI-powered email reply draft using FollowThrough AI',

  },
  operation: {
    inputFields: [
      {
        key: 'originalEmailId',
        label: 'Original Email ID',
        type: 'string',
        required: true,
        helpText: 'The ID of the email you are replying to',
      },
      {
        key: 'originalSubject',
        label: 'Original Subject',
        type: 'string',
        required: true,
        helpText: 'Subject line of the original email',
      },
      {
        key: 'originalFrom',
        label: 'Original Sender',
        type: 'string',
        required: true,
        helpText: 'Email address of the original sender',
      },
      {
        key: 'originalBody',
        label: 'Original Email Body',
        type: 'text',
        required: true,
        helpText: 'Content of the original email',
      },
      {
        key: 'replyTone',
        label: 'Reply Tone',
        type: 'string',
        required: false,
        choices: ['professional', 'friendly', 'formal', 'casual'],
        default: 'professional',
        helpText: 'Tone for the AI-generated reply',
      },
      {
        key: 'customInstructions',
        label: 'Custom Instructions',
        type: 'text',
        required: false,
        helpText: 'Additional instructions for the AI (e.g., specific points to address, company policies)',
      },
      {
        key: 'includeOriginal',
        label: 'Include Original Email',
        type: 'boolean',
        required: false,
        default: 'false',
        helpText: 'Whether to include the original email in the reply',
      },
      {
        key: 'priority',
        label: 'Priority Level',
        type: 'string',
        required: false,
        choices: ['low', 'medium', 'high'],
        default: 'medium',
        helpText: 'Priority level for processing this reply',
      },
    ],
    outputFields: [
      { key: 'draftId', label: 'Draft ID', type: 'string' },
      { key: 'subject', label: 'Reply Subject', type: 'string' },
      { key: 'body', label: 'Reply Body', type: 'string' },
      { key: 'tone', label: 'Reply Tone', type: 'string' },
      { key: 'confidence', label: 'Confidence Score', type: 'number' },
      { key: 'suggestedActions', label: 'Suggested Actions', type: 'string', list: true },
      { key: 'estimatedReadTime', label: 'Estimated Read Time (seconds)', type: 'integer' },
      { key: 'keyPoints', label: 'Key Points Addressed', type: 'string', list: true },
      { key: 'success', label: 'Success', type: 'boolean' },
    ],
    perform,
    sample: {
      draftId: 'draft_1234567890',
      subject: 'Re: Product Inquiry - Enterprise Solution',
      body: 'Dear John,\n\nThank you for your interest in our enterprise solution. I\'d be happy to provide you with detailed information about our pricing and features.\n\nBased on your requirements, I believe our Enterprise Plus package would be the best fit for your organization. This includes:\n\n• Advanced analytics and reporting\n• 24/7 priority support\n• Custom integrations\n• Dedicated account manager\n\nI\'d love to schedule a call to discuss your specific needs in more detail. Are you available for a 30-minute demo this week?\n\nBest regards,\nSales Team',
      tone: 'professional',
      confidence: 0.92,
      suggestedActions: [
        'Schedule demo call',
        'Send pricing information',
        'Follow up within 24 hours',
      ],
      estimatedReadTime: 45,
      keyPoints: [
        'Acknowledged product inquiry',
        'Recommended appropriate package',
        'Listed key features',
        'Proposed next steps',
      ],
      success: true,
    },
  },
}; 