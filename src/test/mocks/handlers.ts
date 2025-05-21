import { http, HttpResponse } from 'msw';

// Mock response for OpenAI embeddings API
const mockEmbeddingResponse = {
  data: [
    {
      embedding: Array(1536).fill(0.5),
      index: 0,
      object: 'embedding',
    },
  ],
  model: 'text-embedding-3-large',
  object: 'list',
  usage: {
    prompt_tokens: 10,
    total_tokens: 10,
  },
};

// Mock response for OpenAI batch embeddings API
const mockBatchEmbeddingResponse = (inputCount: number) => ({
  data: Array(inputCount)
    .fill(0)
    .map((_, index) => ({
      embedding: Array(1536).fill(0.5),
      index,
      object: 'embedding',
    })),
  model: 'text-embedding-3-large',
  object: 'list',
  usage: {
    prompt_tokens: inputCount * 10,
    total_tokens: inputCount * 10,
  },
});

// Mock topic extraction response
const mockTopicExtractionResponse = {
  id: 'chatcmpl-topic-123',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify([
          {
            name: 'Project Timeline',
            description: 'Discussion about project deadlines and milestones',
            relevance: 9,
            subtopics: ['Delays', 'Milestones', 'Deliverables'],
            keywords: ['timeline', 'deadline', 'milestone', 'schedule'],
          },
          {
            name: 'Budget Concerns',
            description:
              'Analysis of current expenditures and budget constraints',
            relevance: 8,
            subtopics: ['Cost Overruns', 'Resource Allocation'],
            keywords: ['budget', 'cost', 'expense', 'funding'],
          },
          {
            name: 'Team Collaboration',
            description: 'Discussion about team dynamics and communication',
            relevance: 7,
            subtopics: ['Communication Channels', 'Work Distribution'],
            keywords: [
              'team',
              'collaboration',
              'communication',
              'coordination',
            ],
          },
        ]),
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 200,
    total_tokens: 250,
  },
};

// Mock action item extraction response
const mockActionItemResponse = {
  id: 'chatcmpl-action-123',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify([
          {
            description: 'Update project timeline document with new milestones',
            assignee: 'Alice',
            dueDate: '2023-07-15',
            priority: 'high',
            status: 'pending',
            relatedTopics: ['Project Timeline'],
          },
          {
            description:
              'Schedule budget review meeting with finance department',
            assignee: 'Bob',
            dueDate: '2023-07-10',
            priority: 'medium',
            status: 'pending',
            relatedTopics: ['Budget Concerns'],
          },
          {
            description:
              'Create new Slack channel for cross-team communication',
            assignee: 'Charlie',
            dueDate: '2023-07-05',
            priority: 'low',
            status: 'pending',
            relatedTopics: ['Team Collaboration'],
          },
        ]),
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 60,
    completion_tokens: 180,
    total_tokens: 240,
  },
};

// Mock sentiment analysis response
const mockSentimentResponse = {
  id: 'chatcmpl-sentiment-123',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify({
          overall: 'mixed',
          score: 0.2,
          segments: [
            {
              text: 'We need to address these timeline issues immediately.',
              sentiment: 'negative',
              score: -0.6,
              speaker: 'Alice',
            },
            {
              text: 'I think we can work through these challenges together.',
              sentiment: 'positive',
              score: 0.7,
              speaker: 'Bob',
            },
            {
              text: 'The budget constraints are concerning but not insurmountable.',
              sentiment: 'neutral',
              score: 0.1,
              speaker: 'Charlie',
            },
          ],
          keyEmotions: ['concern', 'hope', 'determination'],
          toneShifts: [
            {
              from: 'negative',
              to: 'positive',
              approximate_time: '10:15',
              trigger: 'Discussion of team collaboration',
            },
          ],
        }),
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 70,
    completion_tokens: 220,
    total_tokens: 290,
  },
};

// Default chat completion response for other queries
const mockChatCompletionResponse = {
  id: 'chatcmpl-mock-123',
  object: 'chat.completion',
  created: Date.now(),
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a mock response from the OpenAI API.',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 20,
    completion_tokens: 10,
    total_tokens: 30,
  },
};

// Type for OpenAI embedding request
interface OpenAIEmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: string;
  dimensions?: number;
  user?: string;
}

export const handlers = [
  // Intercept OpenAI embeddings API
  http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
    // Parse the request body
    const reqBody = (await request.json()) as OpenAIEmbeddingRequest;

    if (Array.isArray(reqBody.input)) {
      // Handle batch embedding request
      return HttpResponse.json(
        mockBatchEmbeddingResponse(reqBody.input.length),
      );
    } else {
      // Handle single embedding request
      return HttpResponse.json(mockEmbeddingResponse);
    }
  }),

  // Intercept OpenAI chat completion API with content-based response selection
  http.post(
    'https://api.openai.com/v1/chat/completions',
    async ({ request }) => {
      const reqBody = (await request.json()) as any;
      const messages = reqBody.messages || [];
      const content =
        messages.length > 0 ? messages[messages.length - 1].content || '' : '';

      // Select appropriate mock response based on content
      if (
        content.toLowerCase().includes('topic') ||
        content.toLowerCase().includes('main discussion points')
      ) {
        return HttpResponse.json(mockTopicExtractionResponse);
      } else if (
        content.toLowerCase().includes('action item') ||
        content.toLowerCase().includes('task') ||
        content.toLowerCase().includes('to-do')
      ) {
        return HttpResponse.json(mockActionItemResponse);
      } else if (
        content.toLowerCase().includes('sentiment') ||
        content.toLowerCase().includes('emotion') ||
        content.toLowerCase().includes('tone')
      ) {
        return HttpResponse.json(mockSentimentResponse);
      } else {
        return HttpResponse.json(mockChatCompletionResponse);
      }
    },
  ),

  // Mock Pinecone API for vector storage
  http.post('*/query', async () => {
    return HttpResponse.json({
      matches: [
        {
          id: 'doc-1',
          score: 0.92,
          values: Array(1536).fill(0.1),
          metadata: {
            content: 'Previous meeting discussed project timeline issues.',
            meetingId: 'prev-meeting-001',
            date: '2023-06-15',
          },
        },
        {
          id: 'doc-2',
          score: 0.87,
          values: Array(1536).fill(0.2),
          metadata: {
            content:
              "Budget concerns were raised in last week's financial review.",
            meetingId: 'prev-meeting-002',
            date: '2023-06-22',
          },
        },
      ],
      namespace: 'meetings',
    });
  }),

  // Mock Pinecone API for vector upsert
  http.post('*/vectors/upsert', async () => {
    return HttpResponse.json({
      upsertedCount: 10,
    });
  }),
];
