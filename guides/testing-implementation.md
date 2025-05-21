
# NestJS Testing Implementation Plan for Phase 7

Based on your requirements, I'll create a comprehensive testing strategy focused on integration tests for the meeting analysis flow using MSW for API mocking. Here's the implementation plan for adding tests to the nestjs-server folder:

## 1. Test Setup and Structure

First, let's create a proper test structure with MSW for API mocking:

```typescript
// src/test/setup-jest.ts
import { server } from './mocks/server';

// Establish API mocking before all tests
beforeAll(() => server.listen());

// Reset any request handlers between tests
afterEach(() => server.resetHandlers());

// Clean up after all tests are done
afterAll(() => server.close());
```

## 2. Test Implementation Strategy

Let's implement the following key test files:

### 2.1. Meeting Analysis Integration Test

```typescript
// src/langgraph/meeting-analysis/meeting-analysis.integration.spec.ts
import { Test } from '@nestjs/testing';
import { MeetingAnalysisService } from './meeting-analysis.service';
import { GraphService } from '../graph/graph.service';
import { StateService } from '../state/state.service';
import { WorkflowService } from '../graph/workflow.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { server } from '../../test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('Meeting Analysis Integration', () => {
  let meetingAnalysisService: MeetingAnalysisService;
  
  beforeEach(async () => {
    // Mock OpenAI API calls for agent responses
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677858242,
          model: 'gpt-4o',
          choices: [{
            message: {
              role: 'assistant',
              content: JSON.stringify({
                topics: [{ name: 'Project Timeline', description: 'Discussion about project milestones' }],
                actionItems: [{ description: 'Finalize Q3 report', assignee: 'John' }]
              })
            },
            index: 0,
            finish_reason: 'stop'
          }]
        });
      })
    );
    
    const moduleRef = await Test.createTestingModule({
      providers: [
        MeetingAnalysisService,
        {
          provide: GraphService,
          useValue: {
            analyzeMeeting: jest.fn().mockResolvedValue({
              topics: [{ name: 'Project Timeline' }],
              actionItems: [{ description: 'Finalize Q3 report' }],
              sentiment: { overall: 'positive' },
              summary: { title: 'Project Planning Meeting' }
            })
          }
        },
        {
          provide: StateService,
          useValue: { createMeetingAnalysisState: jest.fn() }
        },
        {
          provide: WorkflowService,
          useValue: {
            analyzeMeeting: jest.fn().mockResolvedValue({
              sessionId: 'session-123',
              result: {
                topics: [{ name: 'Project Timeline' }],
                actionItems: [{ description: 'Finalize Q3 report' }]
              }
            })
          }
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() }
        }
      ]
    }).compile();
    
    meetingAnalysisService = moduleRef.get<MeetingAnalysisService>(MeetingAnalysisService);
  });
  
  it('should process transcript and return analysis results', async () => {
    // Arrange
    const transcript = 'Alice: Let\'s discuss the project timeline for Q3.\nBob: I think we should finalize the report by next week.';
    
    // Act
    const result = await meetingAnalysisService.analyzeTranscript(transcript);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.sessionId).toBeDefined();
    expect(result.topics).toBeDefined();
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.topics[0].name).toBe('Project Timeline');
  });
});
```

### 2.2. RAG-Enhanced Agent Integration Test

```typescript
// src/langgraph/agentic-meeting-analysis/rag-meeting-analysis.integration.spec.ts
import { Test } from '@nestjs/testing';
import { AgenticMeetingAnalysisService } from './agentic-meeting-analysis.service';
import { RagMeetingAnalysisAgent } from './agents/enhanced/rag-meeting-agent';
import { RagTopicExtractionAgent } from './agents/enhanced/rag-topic-extraction-agent';
import { LlmService } from '../llm/llm.service';
import { StateService } from '../state/state.service';
import { RagService } from '../../rag/rag.service';
import { server } from '../../test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('RAG Meeting Analysis Integration', () => {
  let agenticMeetingAnalysisService: AgenticMeetingAnalysisService;
  
  beforeEach(async () => {
    // Mock OpenAI embeddings API
    server.use(
      http.post('https://api.openai.com/v1/embeddings', () => {
        return HttpResponse.json({
          data: [
            {
              embedding: Array(1536).fill(0.1),
              index: 0,
              object: 'embedding'
            }
          ],
          model: 'text-embedding-3-large',
          object: 'list',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        });
      }),
      
      // Mock OpenAI chat completions API
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677858242,
          model: 'gpt-4o',
          choices: [{
            message: {
              role: 'assistant',
              content: JSON.stringify([
                { 
                  name: 'Project Status', 
                  description: 'Discussion about current project status',
                  relevance: 8,
                  subtopics: ['Timeline', 'Budget'],
                  keywords: ['project', 'status', 'timeline', 'budget']
                }
              ])
            },
            index: 0,
            finish_reason: 'stop'
          }]
        });
      })
    );
    
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgenticMeetingAnalysisService,
        RagMeetingAnalysisAgent,
        RagTopicExtractionAgent,
        {
          provide: LlmService,
          useValue: {
            getChatModel: jest.fn().mockReturnValue({
              invoke: jest.fn().mockResolvedValue({
                content: JSON.stringify([{ name: 'Project Status' }])
              })
            })
          }
        },
        {
          provide: StateService,
          useValue: {}
        },
        {
          provide: RagService,
          useValue: {
            getContext: jest.fn().mockResolvedValue([
              {
                id: 'doc-1',
                content: 'Previous meeting discussed project timeline issues.',
                metadata: { meetingId: 'prev-meeting', date: '2023-06-15' },
                score: 0.85
              }
            ])
          }
        }
      ]
    }).compile();
    
    agenticMeetingAnalysisService = moduleRef.get<AgenticMeetingAnalysisService>(AgenticMeetingAnalysisService);
  });
  
  it('should extract topics with RAG enhancement', async () => {
    // Arrange
    const transcript = 'Alice: How are we doing on the project?\nBob: We\'re on track but might need to adjust the timeline.';
    
    // Act
    const topics = await agenticMeetingAnalysisService.extractTopics(transcript, {
      meetingId: 'meeting-123',
      retrievalOptions: {
        includeHistoricalTopics: true
      }
    });
    
    // Assert
    expect(topics).toBeDefined();
    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0].name).toBe('Project Status');
  });
  
  it('should process meeting transcript with multiple analysis types', async () => {
    // Arrange
    const transcript = 'Alice: How are we doing on the project?\nBob: We\'re on track but might need to adjust the timeline.';
    
    // Act
    const result = await agenticMeetingAnalysisService.processMeetingTranscript(transcript, {
      meetingId: 'meeting-123',
      analyzeTopics: true,
      analyzeActionItems: true
    });
    
    // Assert
    expect(result).toBeDefined();
    expect(result.meetingId).toBe('meeting-123');
    expect(result.topics).toBeDefined();
    expect(result.topics.length).toBeGreaterThan(0);
  });
});
```

### 2.3. Retrieval Service Test

```typescript
// src/rag/retrieval.service.spec.ts
import { Test } from '@nestjs/testing';
import { RetrievalService } from './retrieval.service';
import { PINECONE_SERVICE } from '../pinecone/constants/injection-tokens';
import { EMBEDDING_SERVICE } from '../embedding/constants/injection-tokens';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('RetrievalService', () => {
  let retrievalService: RetrievalService;
  let mockPineconeService: any;
  let mockEmbeddingService: any;
  let mockCacheManager: any;
  
  beforeEach(async () => {
    // Setup MSW handlers
    server.use(
      http.post('https://api.openai.com/v1/embeddings', () => {
        return HttpResponse.json({
          data: [
            {
              embedding: Array(1536).fill(0.1),
              index: 0,
              object: 'embedding'
            }
          ],
          model: 'text-embedding-3-large',
          object: 'list',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        });
      })
    );
    
    // Create mocks
    mockPineconeService = {
      querySimilar: jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          score: 0.85,
          metadata: {
            text: 'Previous project timeline discussion',
            meetingId: 'meeting-123',
            date: '2023-06-15'
          }
        }
      ])
    };
    
    mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(Array(1536).fill(0.1))
    };
    
    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined)
    };
    
    const moduleRef = await Test.createTestingModule({
      providers: [
        RetrievalService,
        {
          provide: PINECONE_SERVICE,
          useValue: mockPineconeService
        },
        {
          provide: EMBEDDING_SERVICE,
          useValue: mockEmbeddingService
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager
        }
      ]
    }).compile();
    
    retrievalService = moduleRef.get<RetrievalService>(RetrievalService);
  });
  
  it('should retrieve documents based on query', async () => {
    // Arrange
    const query = 'project timeline';
    
    // Act
    const documents = await retrievalService.retrieveDocuments(query);
    
    // Assert
    expect(documents).toBeDefined();
    expect(documents.length).toBeGreaterThan(0);
    expect(documents[0].content).toBe('Previous project timeline discussion');
    expect(documents[0].score).toBe(0.85);
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(query, expect.any(Object));
    expect(mockPineconeService.querySimilar).toHaveBeenCalled();
  });
  
  it('should use cache when available', async () => {
    // Arrange
    const query = 'project timeline';
    const cachedDocuments = [
      {
        id: 'cached-doc',
        content: 'Cached content',
        metadata: { source: 'cache' },
        score: 0.9
      }
    ];
    mockCacheManager.get.mockResolvedValueOnce(cachedDocuments);
    
    // Act
    const documents = await retrievalService.retrieveDocuments(query);
    
    // Assert
    expect(documents).toEqual(cachedDocuments);
    expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    expect(mockPineconeService.querySimilar).not.toHaveBeenCalled();
  });
  
  it('should perform hybrid search combining vector and keyword approaches', async () => {
    // Arrange
    const query = 'project timeline';
    
    // Act
    const documents = await retrievalService.hybridSearch(query, {
      keywordWeight: 0.3,
      vectorWeight: 0.7
    });
    
    // Assert
    expect(documents).toBeDefined();
    expect(documents.length).toBeGreaterThan(0);
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
  });
});
```

## 3. MSW Mock Setup

Let's enhance our MSW mock setup for comprehensive API mocking:

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

// Create a reusable mock for OpenAI embedding responses
const mockEmbeddingResponse = (inputCount = 1) => {
  return {
    data: Array(inputCount).fill(0).map((_, i) => ({
      embedding: Array(1536).fill(0.1),
      index: i,
      object: 'embedding'
    })),
    model: 'text-embedding-3-large',
    object: 'list',
    usage: { prompt_tokens: 10 * inputCount, total_tokens: 10 * inputCount }
  };
};

// Create a reusable mock for OpenAI chat completions
const mockChatCompletion = (content) => {
  return {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4o',
    choices: [{
      message: {
        role: 'assistant',
        content: typeof content === 'string' ? content : JSON.stringify(content)
      },
      index: 0,
      finish_reason: 'stop'
    }]
  };
};

export const handlers = [
  // OpenAI Embeddings API
  http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
    const body = await request.json();
    const input = body.input;
    const inputCount = Array.isArray(input) ? input.length : 1;
    return HttpResponse.json(mockEmbeddingResponse(inputCount));
  }),
  
  // OpenAI Chat Completions API
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json();
    
    // Check the input messages to determine what kind of response to return
    const messages = body.messages || [];
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '';
    
    // Determine what kind of response to return based on the content
    if (content.includes('topic')) {
      return HttpResponse.json(mockChatCompletion([
        { name: 'Project Timeline', description: 'Discussion about project milestones' }
      ]));
    } else if (content.includes('action')) {
      return HttpResponse.json(mockChatCompletion([
        { description: 'Finalize Q3 report', assignee: 'John' }
      ]));
    } else if (content.includes('sentiment')) {
      return HttpResponse.json(mockChatCompletion({
        overall: 'positive',
        score: 0.8,
        segments: [{ text: 'Sample text', sentiment: 'positive', score: 0.85 }]
      }));
    } else {
      return HttpResponse.json(mockChatCompletion('This is a default response.'));
    }
  }),
  
  // Pinecone API
  http.post('*/query', () => {
    return HttpResponse.json({
      matches: [
        {
          id: 'doc-1',
          score: 0.85,
          metadata: {
            text: 'Previous discussion about project timeline',
            meetingId: 'meeting-123'
          }
        }
      ]
    });
  }),
  
  http.post('*/vectors/upsert', () => {
    return HttpResponse.json({ upsertedCount: 1 });
  })
];
```

## 4. Test Execution Script

Create a script to run the tests:

```bash
# nestjs-server/run-tests.sh
#!/bin/bash

# Run all tests with coverage
npm run test:cov

# Run specific integration tests
npx jest --config ./jest.config.js "src/langgraph/meeting-analysis/meeting-analysis.integration.spec.ts" "src/langgraph/agentic-meeting-analysis/rag-meeting-analysis.integration.spec.ts"
```

## 5. Implementation Steps

1. Create the MSW handlers in `src/test/mocks/handlers.ts`
2. Ensure the MSW server setup in `src/test/mocks/server.ts`
3. Update the Jest setup file `src/test/setup-jest.ts`
4. Implement the integration tests starting with meeting analysis flow
5. Add more specialized tests for RAG components
6. Create utility functions for common test operations

## 6. Test Coverage Strategy

- Focus on testing the entire meeting analysis flow from transcript to results
- Test the RAG enhancement specifically for topic extraction and action item detection
- Test the integration between different services (LLM, Embedding, Pinecone)

This testing approach aligns with the NestJS migration plan Phase 7, focusing on integration tests and using MSW for API mocking. The tests will verify that our agentic meeting analysis system works correctly with the RAG enhancements we've implemented.

```typescript
// src/test/setup-jest.ts
import { server } from './mocks/server';

// Establish API mocking before all tests
beforeAll(() => server.listen());

// Reset any request handlers between tests
afterEach(() => server.resetHandlers());

// Clean up after all tests are done
afterAll(() => server.close());
```

```typescript
// src/langgraph/meeting-analysis/meeting-analysis.integration.spec.ts
import { Test } from '@nestjs/testing';
import { MeetingAnalysisService } from './meeting-analysis.service';
import { GraphService } from '../graph/graph.service';
import { StateService } from '../state/state.service';
import { WorkflowService } from '../graph/workflow.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { server } from '../../test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('Meeting Analysis Integration', () => {
  let meetingAnalysisService: MeetingAnalysisService;
  
  beforeEach(async () => {
    // Mock OpenAI API calls for agent responses
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677858242,
          model: 'gpt-4o',
          choices: [{
            message: {
              role: 'assistant',
              content: JSON.stringify({
                topics: [{ name: 'Project Timeline', description: 'Discussion about project milestones' }],
                actionItems: [{ description: 'Finalize Q3 report', assignee: 'John' }]
              })
            },
            index: 0,
            finish_reason: 'stop'
          }]
        });
      })
    );
    
    const moduleRef = await Test.createTestingModule({
      providers: [
        MeetingAnalysisService,
        {
          provide: GraphService,
          useValue: {
            analyzeMeeting: jest.fn().mockResolvedValue({
              topics: [{ name: 'Project Timeline' }],
              actionItems: [{ description: 'Finalize Q3 report' }],
              sentiment: { overall: 'positive' },
              summary: { title: 'Project Planning Meeting' }
            })
          }
        },
        {
          provide: StateService,
          useValue: { createMeetingAnalysisState: jest.fn() }
        },
        {
          provide: WorkflowService,
          useValue: {
            analyzeMeeting: jest.fn().mockResolvedValue({
              sessionId: 'session-123',
              result: {
                topics: [{ name: 'Project Timeline' }],
                actionItems: [{ description: 'Finalize Q3 report' }]
              }
            })
          }
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() }
        }
      ]
    }).compile();
    
    meetingAnalysisService = moduleRef.get<MeetingAnalysisService>(MeetingAnalysisService);
  });
  
  it('should process transcript and return analysis results', async () => {
    // Arrange
    const transcript = 'Alice: Let\'s discuss the project timeline for Q3.\nBob: I think we should finalize the report by next week.';
    
    // Act
    const result = await meetingAnalysisService.analyzeTranscript(transcript);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.sessionId).toBeDefined();
    expect(result.topics).toBeDefined();
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.topics[0].name).toBe('Project Timeline');
  });
});
```

```typescript
// src/langgraph/agentic-meeting-analysis/rag-meeting-analysis.integration.spec.ts
import { Test } from '@nestjs/testing';
import { AgenticMeetingAnalysisService } from './agentic-meeting-analysis.service';
import { RagMeetingAnalysisAgent } from './agents/enhanced/rag-meeting-agent';
import { RagTopicExtractionAgent } from './agents/enhanced/rag-topic-extraction-agent';
import { LlmService } from '../llm/llm.service';
import { StateService } from '../state/state.service';
import { RagService } from '../../rag/rag.service';
import { server } from '../../test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('RAG Meeting Analysis Integration', () => {
  let agenticMeetingAnalysisService: AgenticMeetingAnalysisService;
  
  beforeEach(async () => {
    // Mock OpenAI embeddings API
    server.use(
      http.post('https://api.openai.com/v1/embeddings', () => {
        return HttpResponse.json({
          data: [
            {
              embedding: Array(1536).fill(0.1),
              index: 0,
              object: 'embedding'
            }
          ],
          model: 'text-embedding-3-large',
          object: 'list',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        });
      }),
      
      // Mock OpenAI chat completions API
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677858242,
          model: 'gpt-4o',
          choices: [{
            message: {
              role: 'assistant',
              content: JSON.stringify([
                { 
                  name: 'Project Status', 
                  description: 'Discussion about current project status',
                  relevance: 8,
                  subtopics: ['Timeline', 'Budget'],
                  keywords: ['project', 'status', 'timeline', 'budget']
                }
              ])
            },
            index: 0,
            finish_reason: 'stop'
          }]
        });
      })
    );
    
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgenticMeetingAnalysisService,
        RagMeetingAnalysisAgent,
        RagTopicExtractionAgent,
        {
          provide: LlmService,
          useValue: {
            getChatModel: jest.fn().mockReturnValue({
              invoke: jest.fn().mockResolvedValue({
                content: JSON.stringify([{ name: 'Project Status' }])
              })
            })
          }
        },
        {
          provide: StateService,
          useValue: {}
        },
        {
          provide: RagService,
          useValue: {
            getContext: jest.fn().mockResolvedValue([
              {
                id: 'doc-1',
                content: 'Previous meeting discussed project timeline issues.',
                metadata: { meetingId: 'prev-meeting', date: '2023-06-15' },
                score: 0.85
              }
            ])
          }
        }
      ]
    }).compile();
    
    agenticMeetingAnalysisService = moduleRef.get<AgenticMeetingAnalysisService>(AgenticMeetingAnalysisService);
  });
  
  it('should extract topics with RAG enhancement', async () => {
    // Arrange
    const transcript = 'Alice: How are we doing on the project?\nBob: We\'re on track but might need to adjust the timeline.';
    
    // Act
    const topics = await agenticMeetingAnalysisService.extractTopics(transcript, {
      meetingId: 'meeting-123',
      retrievalOptions: {
        includeHistoricalTopics: true
      }
    });
    
    // Assert
    expect(topics).toBeDefined();
    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0].name).toBe('Project Status');
  });
  
  it('should process meeting transcript with multiple analysis types', async () => {
    // Arrange
    const transcript = 'Alice: How are we doing on the project?\nBob: We\'re on track but might need to adjust the timeline.';
    
    // Act
    const result = await agenticMeetingAnalysisService.processMeetingTranscript(transcript, {
      meetingId: 'meeting-123',
      analyzeTopics: true,
      analyzeActionItems: true
    });
    
    // Assert
    expect(result).toBeDefined();
    expect(result.meetingId).toBe('meeting-123');
    expect(result.topics).toBeDefined();
    expect(result.topics.length).toBeGreaterThan(0);
  });
});
```

```typescript
// src/rag/retrieval.service.spec.ts
import { Test } from '@nestjs/testing';
import { RetrievalService } from './retrieval.service';
import { PINECONE_SERVICE } from '../pinecone/constants/injection-tokens';
import { EMBEDDING_SERVICE } from '../embedding/constants/injection-tokens';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('RetrievalService', () => {
  let retrievalService: RetrievalService;
  let mockPineconeService: any;
  let mockEmbeddingService: any;
  let mockCacheManager: any;
  
  beforeEach(async () => {
    // Setup MSW handlers
    server.use(
      http.post('https://api.openai.com/v1/embeddings', () => {
        return HttpResponse.json({
          data: [
            {
              embedding: Array(1536).fill(0.1),
              index: 0,
              object: 'embedding'
            }
          ],
          model: 'text-embedding-3-large',
          object: 'list',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        });
      })
    );
    
    // Create mocks
    mockPineconeService = {
      querySimilar: jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          score: 0.85,
          metadata: {
            text: 'Previous project timeline discussion',
            meetingId: 'meeting-123',
            date: '2023-06-15'
          }
        }
      ])
    };
    
    mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(Array(1536).fill(0.1))
    };
    
    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined)
    };
    
    const moduleRef = await Test.createTestingModule({
      providers: [
        RetrievalService,
        {
          provide: PINECONE_SERVICE,
          useValue: mockPineconeService
        },
        {
          provide: EMBEDDING_SERVICE,
          useValue: mockEmbeddingService
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager
        }
      ]
    }).compile();
    
    retrievalService = moduleRef.get<RetrievalService>(RetrievalService);
  });
  
  it('should retrieve documents based on query', async () => {
    // Arrange
    const query = 'project timeline';
    
    // Act
    const documents = await retrievalService.retrieveDocuments(query);
    
    // Assert
    expect(documents).toBeDefined();
    expect(documents.length).toBeGreaterThan(0);
    expect(documents[0].content).toBe('Previous project timeline discussion');
    expect(documents[0].score).toBe(0.85);
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(query, expect.any(Object));
    expect(mockPineconeService.querySimilar).toHaveBeenCalled();
  });
  
  it('should use cache when available', async () => {
    // Arrange
    const query = 'project timeline';
    const cachedDocuments = [
      {
        id: 'cached-doc',
        content: 'Cached content',
        metadata: { source: 'cache' },
        score: 0.9
      }
    ];
    mockCacheManager.get.mockResolvedValueOnce(cachedDocuments);
    
    // Act
    const documents = await retrievalService.retrieveDocuments(query);
    
    // Assert
    expect(documents).toEqual(cachedDocuments);
    expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    expect(mockPineconeService.querySimilar).not.toHaveBeenCalled();
  });
  
  it('should perform hybrid search combining vector and keyword approaches', async () => {
    // Arrange
    const query = 'project timeline';
    
    // Act
    const documents = await retrievalService.hybridSearch(query, {
      keywordWeight: 0.3,
      vectorWeight: 0.7
    });
    
    // Assert
    expect(documents).toBeDefined();
    expect(documents.length).toBeGreaterThan(0);
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
  });
});
```

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

// Create a reusable mock for OpenAI embedding responses
const mockEmbeddingResponse = (inputCount = 1) => {
  return {
    data: Array(inputCount).fill(0).map((_, i) => ({
      embedding: Array(1536).fill(0.1),
      index: i,
      object: 'embedding'
    })),
    model: 'text-embedding-3-large',
    object: 'list',
    usage: { prompt_tokens: 10 * inputCount, total_tokens: 10 * inputCount }
  };
};

// Create a reusable mock for OpenAI chat completions
const mockChatCompletion = (content) => {
  return {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4o',
    choices: [{
      message: {
        role: 'assistant',
        content: typeof content === 'string' ? content : JSON.stringify(content)
      },
      index: 0,
      finish_reason: 'stop'
    }]
  };
};

export const handlers = [
  // OpenAI Embeddings API
  http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
    const body = await request.json();
    const input = body.input;
    const inputCount = Array.isArray(input) ? input.length : 1;
    return HttpResponse.json(mockEmbeddingResponse(inputCount));
  }),
  
  // OpenAI Chat Completions API
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json();
    
    // Check the input messages to determine what kind of response to return
    const messages = body.messages || [];
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '';
    
    // Determine what kind of response to return based on the content
    if (content.includes('topic')) {
      return HttpResponse.json(mockChatCompletion([
        { name: 'Project Timeline', description: 'Discussion about project milestones' }
      ]));
    } else if (content.includes('action')) {
      return HttpResponse.json(mockChatCompletion([
        { description: 'Finalize Q3 report', assignee: 'John' }
      ]));
    } else if (content.includes('sentiment')) {
      return HttpResponse.json(mockChatCompletion({
        overall: 'positive',
        score: 0.8,
        segments: [{ text: 'Sample text', sentiment: 'positive', score: 0.85 }]
      }));
    } else {
      return HttpResponse.json(mockChatCompletion('This is a default response.'));
    }
  }),
  
  // Pinecone API
  http.post('*/query', () => {
    return HttpResponse.json({
      matches: [
        {
          id: 'doc-1',
          score: 0.85,
          metadata: {
            text: 'Previous discussion about project timeline',
            meetingId: 'meeting-123'
          }
        }
      ]
    });
  }),
  
  http.post('*/vectors/upsert', () => {
    return HttpResponse.json({ upsertedCount: 1 });
  })
];
```

```shellscript
# nestjs-server/run-tests.sh
#!/bin/bash

# Run all tests with coverage
npm run test:cov

# Run specific integration tests
npx jest --config ./jest.config.js "src/langgraph/meeting-analysis/meeting-analysis.integration.spec.ts" "src/langgraph/agentic-meeting-analysis/rag-meeting-analysis.integration.spec.ts"
```

