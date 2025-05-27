import { Bundle, ZObject } from 'zapier-platform-core';
import { ApiClient } from '../utils/api-client';

interface MeetingAnalysisInput {
  eventId: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  customInstructions?: string;
}

export interface MeetingAnalysisOutput {
  analysisId: string;
  status: 'processing' | 'completed' | 'failed';
  insights?: {
    purpose: string;
    keyTopics: string[];
    actionItems: string[];
    decisions: string[];
    nextSteps: string[];
  };
  summary?: string;
  attendeeAnalysis?: {
    totalAttendees: number;
    keyStakeholders: string[];
    missingStakeholders: string[];
  };
  followUpTasks?: Array<{
    title: string;
    description: string;
    assignee?: string;
    dueDate?: string;
    priority: string;
  }>;
  processingTime?: number;
  confidence?: number;
}

const perform = async (z: ZObject, bundle: Bundle): Promise<MeetingAnalysisOutput> => {
  const inputData = bundle.inputData as unknown as MeetingAnalysisInput;
  const { eventId, summary, description, start, end, attendees, location, customInstructions } = inputData;

  if (!eventId || !summary || !start || !end) {
    throw new Error('Event ID, summary, start, and end are required for meeting analysis');
  }

  const apiClient = new ApiClient(z, bundle);

  try {
    // Trigger meeting analysis through the FollowThrough AI server
    const response = await apiClient.post('/api/zapier/webhooks/meeting', {
      eventId,
      summary,
      description: description || '',
      start,
      end,
      attendees: attendees || [],
      location: location || '',
      customInstructions,
      source: 'zapier',
      timestamp: new Date().toISOString(),
    });

    // The server returns the analysis results
    return {
      analysisId: response.data.analysisId || `analysis_${Date.now()}`,
      status: response.data.status || 'processing',
      insights: response.data.insights,
      summary: response.data.summary,
      attendeeAnalysis: response.data.attendeeAnalysis,
      followUpTasks: response.data.followUpTasks || [],
      processingTime: response.data.processingTime,
      confidence: response.data.confidence,
    };
  } catch (error) {
    z.console.error('Meeting analysis failed:', error);
    throw new Error(`Failed to trigger meeting analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default {
  key: 'triggerMeetingAnalysis',
  noun: 'Meeting Analysis',
  display: {
    label: 'Trigger Meeting Analysis',
    description: 'Analyze a calendar event using FollowThrough AI for insights, action items, and follow-up tasks',

  },
  operation: {
    inputFields: [
      {
        key: 'eventId',
        label: 'Event ID',
        type: 'string',
        required: true,
        helpText: 'The unique identifier of the calendar event to analyze',
      },
      {
        key: 'summary',
        label: 'Event Summary',
        type: 'string',
        required: true,
        helpText: 'The title/summary of the calendar event',
      },
      {
        key: 'description',
        label: 'Event Description',
        type: 'text',
        required: false,
        helpText: 'The description or agenda of the calendar event',
      },
      {
        key: 'start',
        label: 'Start Time',
        type: 'datetime',
        required: true,
        helpText: 'The start time of the event (ISO format)',
      },
      {
        key: 'end',
        label: 'End Time',
        type: 'datetime',
        required: true,
        helpText: 'The end time of the event (ISO format)',
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
        key: 'customInstructions',
        label: 'Custom Instructions',
        type: 'text',
        required: false,
        helpText: 'Additional instructions for the AI analysis (e.g., focus areas, specific questions)',
      },
    ],
    outputFields: [
      { key: 'analysisId', label: 'Analysis ID', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'insights__purpose', label: 'Meeting Purpose', type: 'string' },
      { key: 'insights__keyTopics', label: 'Key Topics', type: 'string', list: true },
      { key: 'insights__actionItems', label: 'Action Items', type: 'string', list: true },
      { key: 'insights__decisions', label: 'Decisions Made', type: 'string', list: true },
      { key: 'insights__nextSteps', label: 'Next Steps', type: 'string', list: true },
      { key: 'summary', label: 'Analysis Summary', type: 'string' },
      { key: 'attendeeAnalysis__totalAttendees', label: 'Total Attendees', type: 'integer' },
      { key: 'attendeeAnalysis__keyStakeholders', label: 'Key Stakeholders', type: 'string', list: true },
      { key: 'attendeeAnalysis__missingStakeholders', label: 'Missing Stakeholders', type: 'string', list: true },
      { key: 'followUpTasks', label: 'Follow-up Tasks', type: 'string', list: true },
      { key: 'processingTime', label: 'Processing Time (ms)', type: 'integer' },
      { key: 'confidence', label: 'Confidence Score', type: 'number' },
    ],
    perform,
    sample: {
      analysisId: 'analysis_1234567890',
      status: 'completed',
      insights: {
        purpose: 'Quarterly business review and planning session',
        keyTopics: [
          'Q4 performance review',
          'Q1 2024 planning',
          'Budget allocation',
          'Team restructuring',
        ],
        actionItems: [
          'Finalize Q1 budget by end of week',
          'Schedule team restructuring meetings',
          'Prepare Q4 performance report',
        ],
        decisions: [
          'Approved 15% budget increase for marketing',
          'Decided to hire 2 additional developers',
        ],
        nextSteps: [
          'Send meeting notes to all attendees',
          'Schedule follow-up meetings with department heads',
          'Create project timeline for Q1 initiatives',
        ],
      },
      summary: 'Productive quarterly review meeting with clear action items and decisions made for Q1 planning.',
      attendeeAnalysis: {
        totalAttendees: 8,
        keyStakeholders: ['CEO', 'CTO', 'Head of Marketing', 'Head of Sales'],
        missingStakeholders: ['CFO', 'Head of HR'],
      },
      followUpTasks: [
        'Schedule budget review meeting with CFO',
        'Prepare job descriptions for developer positions',
        'Create Q1 marketing campaign proposal',
      ],
      processingTime: 3200,
      confidence: 0.88,
    },
  },
}; 