import { Test } from '@nestjs/testing';
import {
  RagTopicExtractionAgent,
  RAG_TOPIC_EXTRACTION_CONFIG,
} from './rag-topic-extraction-agent';
import { LlmService } from '../../../llm/llm.service';
import { StateService } from '../../../state/state.service';
import { RagService } from '../../../../rag/rag.service';
import { LLM_SERVICE } from '../../../llm/constants/injection-tokens';
import { STATE_SERVICE } from '../../../state/constants/injection-tokens';
import { RAG_SERVICE } from '../../../../rag/constants/injection-tokens';
import { server } from '../../../../test/mocks/server';
import { http, HttpResponse } from 'msw';
import { Topic } from '../../interfaces/state.interface';
import { IRagService } from '../../../../rag/interfaces/rag-service.interface';
import { AgentExpertise } from '../../interfaces/agent.interface';
import { RagMeetingAnalysisConfig } from './rag-meeting-agent';

describe('RagTopicExtractionAgent', () => {
  let ragTopicExtractionAgent: RagTopicExtractionAgent;
  let mockLlmService: any;
  let mockStateService: any;
  let mockRagService: any;
  let mockTopicConfig: RagMeetingAnalysisConfig;

  beforeEach(async () => {
    // Mock OpenAI chat completions API
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677858242,
          model: 'gpt-4o',
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify([
                  {
                    name: 'Project Status',
                    description: 'Discussion about current project status',
                    relevance: 8,
                    subtopics: ['Timeline', 'Budget'],
                    keywords: ['project', 'status', 'timeline', 'budget'],
                  },
                  {
                    name: 'Resource Allocation',
                    description: 'Discussion about team resource allocation',
                    relevance: 7,
                    subtopics: ['Team Members', 'Budget Constraints'],
                    keywords: ['resources', 'allocation', 'team', 'budget'],
                  },
                ]),
              },
              index: 0,
              finish_reason: 'stop',
            },
          ],
        });
      }),
    );

    // Create mocks
    mockLlmService = {
      getChatModel: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: JSON.stringify([
            {
              name: 'Project Status',
              description: 'Discussion about current project status',
              relevance: 8,
              subtopics: ['Timeline', 'Budget'],
              keywords: ['project', 'status', 'timeline', 'budget'],
            },
            {
              name: 'Resource Allocation',
              description: 'Discussion about team resource allocation',
              relevance: 7,
              subtopics: ['Team Members', 'Budget Constraints'],
              keywords: ['resources', 'allocation', 'team', 'budget'],
            },
          ]),
        }),
      }),
    };

    mockStateService = {};

    mockRagService = {
      getContext: jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          content: 'Previous meeting discussed project timeline issues.',
          metadata: { meetingId: 'prev-meeting', date: '2023-06-15' },
          score: 0.85,
        },
      ]),
      enhanceStateWithContext: jest
        .fn()
        .mockImplementation(async (state, query, options = {}) => {
          return {
            ...state,
            retrievedContext: {
              query,
              documents: [
                {
                  id: 'doc-1',
                  content:
                    'Previous meeting discussed project timeline issues.',
                  metadata: { meetingId: 'prev-meeting', date: '2023-06-15' },
                  score: 0.85,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          };
        }),
    };

    // Create config for topic extraction agent
    mockTopicConfig = {
      name: 'topic-extraction',
      systemPrompt: 'You are a topic extraction agent',
      ragOptions: {
        includeRetrievedContext: true,
        retrievalOptions: {
          indexName: 'meeting-analysis',
          namespace: 'topics',
          topK: 5,
          minScore: 0.7,
        },
      },
      expertise: [AgentExpertise.TOPIC_ANALYSIS],
      specializedQueries: {
        [AgentExpertise.TOPIC_ANALYSIS]:
          'What are the main topics discussed in this meeting transcript?',
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RagTopicExtractionAgent,
        {
          provide: LLM_SERVICE,
          useValue: mockLlmService,
        },
        {
          provide: STATE_SERVICE,
          useValue: mockStateService,
        },
        {
          provide: RAG_SERVICE,
          useValue: mockRagService,
        },
        {
          provide: RAG_TOPIC_EXTRACTION_CONFIG,
          useValue: mockTopicConfig,
        },
      ],
    }).compile();

    ragTopicExtractionAgent = moduleRef.get<RagTopicExtractionAgent>(
      RagTopicExtractionAgent,
    );
  });

  it('should extract topics from transcript with RAG enhancement', async () => {
    // Arrange
    const transcript =
      "Alice: How are we doing on the project?\nBob: We're on track but might need to adjust the timeline.";
    const options = {
      meetingId: 'meeting-123',
      participantNames: ['Alice', 'Bob'],
      retrievalOptions: {
        includeHistoricalTopics: true,
        topK: 5,
        minScore: 0.7,
      },
    };

    // Spy on the enhanceStateWithContext method to verify it's called
    const enhanceStateWithContextSpy = jest.spyOn(
      mockRagService,
      'enhanceStateWithContext',
    );

    // Spy on the analyzeTranscript method while preserving its behavior
    const analyzeTranscriptSpy = jest
      .spyOn(ragTopicExtractionAgent, 'analyzeTranscript')
      .mockResolvedValue([
        {
          name: 'Project Status',
          description: 'Discussion about current project status',
          relevance: 8,
          subtopics: ['Timeline', 'Budget'],
          keywords: ['project', 'status', 'timeline', 'budget'],
        },
        {
          name: 'Resource Allocation',
          description: 'Discussion about team resource allocation',
          relevance: 7,
          subtopics: ['Team Members', 'Budget Constraints'],
          keywords: ['resources', 'allocation', 'team', 'budget'],
        },
      ]);

    // Act
    const topics = await ragTopicExtractionAgent.extractTopics(
      transcript,
      options,
    );

    // Assert
    expect(topics).toBeDefined();
    expect(topics.length).toBe(2);
    expect(topics[0].name).toBe('Project Status');
    expect(topics[1].name).toBe('Resource Allocation');

    // Check that enhanceStateWithContext was called
    expect(enhanceStateWithContextSpy).toHaveBeenCalled();
    expect(enhanceStateWithContextSpy).toHaveBeenCalledWith(
      expect.objectContaining({ transcript }),
      expect.any(String),
      expect.any(Object),
    );

    // Check that analyzeTranscript was called with the correct parameters
    expect(analyzeTranscriptSpy).toHaveBeenCalledWith(
      transcript,
      expect.objectContaining({
        meetingId: options.meetingId,
        participantNames: options.participantNames,
        expertise: AgentExpertise.TOPIC_ANALYSIS,
        retrievalOptions: expect.any(Object),
      }),
    );

    // Restore the original implementation
    analyzeTranscriptSpy.mockRestore();
  });

  it('should validate topics and filter out invalid ones', async () => {
    // Arrange
    const transcript =
      "Alice: How are we doing on the project?\nBob: We're on track but might need to adjust the timeline.";

    // Spy on analyzeTranscript method to return some invalid topics
    jest
      .spyOn(ragTopicExtractionAgent, 'analyzeTranscript')
      .mockResolvedValueOnce([
        {
          name: 'Project Status',
          description: 'Discussion about current project status',
          relevance: 8,
        },
        {
          // Missing name field
          description: 'Discussion about team resource allocation',
          relevance: 7,
        },
        {
          name: '', // Empty name
          description: 'Empty topic',
          relevance: 5,
        },
        {
          name: 'Valid Topic',
          description: 'A valid topic',
          relevance: 6,
        },
      ]);

    // Act
    const topics = await ragTopicExtractionAgent.extractTopics(transcript);

    // Assert
    expect(topics).toBeDefined();
    expect(topics.length).toBe(2); // Only 2 valid topics should remain
    expect(topics[0].name).toBe('Project Status');
    expect(topics[1].name).toBe('Valid Topic');

    // Restore original method
    jest.restoreAllMocks();
  });

  it('should format retrieved context correctly', async () => {
    // Arrange
    const context = {
      query: 'project timeline',
      documents: [
        {
          id: 'doc-1',
          content: 'Previous meeting discussed project timeline issues.',
          metadata: { meetingId: 'prev-meeting', date: '2023-06-15' },
          score: 0.85,
        },
        {
          id: 'doc-2',
          content: 'Budget constraints affecting project timeline.',
          metadata: { meetingId: 'prev-meeting-2', date: '2023-06-20' },
          score: 0.78,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    // Since formatRetrievedContext is protected, we need to use a workaround
    // Create a subclass that exposes the protected method for testing
    class TestableAgent extends RagTopicExtractionAgent {
      public testFormatContext(context: any): string {
        return this.formatRetrievedContext(context);
      }
    }

    // Create an instance of the testable agent with the same dependencies
    const testableAgent = new TestableAgent(
      mockLlmService,
      mockStateService,
      mockRagService,
      mockTopicConfig,
    );

    // Act
    const formatted = testableAgent.testFormatContext(context);

    // Assert
    expect(formatted).toBeDefined();
    expect(formatted).toContain(
      'Previous meeting discussed project timeline issues.',
    );
    expect(formatted).toContain(
      'Budget constraints affecting project timeline.',
    );
    expect(formatted).toContain('Meeting prev-meeting (2023-06-15)');
    expect(formatted).toContain('Meeting prev-meeting-2 (2023-06-20)');
  });
});
