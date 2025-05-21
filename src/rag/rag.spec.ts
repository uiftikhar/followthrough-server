import { Test, TestingModule } from '@nestjs/testing';
import { RagService, RetrievedContext } from './rag.service';
import { RetrievalService, RetrievedDocument } from './retrieval.service';
import { AdaptiveRagService } from './adaptive-rag.service';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  IRetrievalService,
  IRagService,
  IAdaptiveRagService,
  RETRIEVAL_SERVICE,
  RAG_SERVICE,
  ADAPTIVE_RAG_SERVICE,
} from './index';
import { EMBEDDING_SERVICE } from '../embedding/constants/injection-tokens';
import { LLM_SERVICE } from '../langgraph/llm/constants/injection-tokens';
import { STATE_SERVICE } from '../langgraph/state/constants/injection-tokens';
import { PINECONE_SERVICE } from '../pinecone/constants/injection-tokens';
import { ConfigService } from '@nestjs/config';
import { DimensionAdapterService } from '../embedding/dimension-adapter.service';
import { SemanticChunkingService } from '../embedding/semantic-chunking.service';
import { SimilarityUtilsService } from '../embedding/similarity-utils.service';
import { SentenceParserService } from '../embedding/sentence-parser.service';
import { ChunkOptimizationService } from '../embedding/chunk-optimization.service';
import { ChunkingService } from '../embedding/chunking.service';

// Define the state interface with retrieved context
interface TranscriptState {
  transcript: string;
  retrievedContext?: RetrievedContext;
}

describe('RAG Services Integration', () => {
  let ragService: IRagService;
  let retrievalService: IRetrievalService;
  let adaptiveRagService: IAdaptiveRagService;
  let moduleRef: TestingModule;

  // Create mock services
  const mockCacheManager = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const mockStateService = {
    createStateGraph: jest.fn(),
  };

  const mockEmbeddingService = {
    generateEmbedding: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
    chunkText: jest.fn().mockReturnValue(['chunk1', 'chunk2']),
  };

  const mockPineconeService = {
    querySimilar: jest.fn().mockResolvedValue([
      {
        id: 'test-doc-1',
        score: 0.95,
        metadata: {
          content: 'This is a test document content for the product roadmap',
          document_id: 'doc-123',
        },
      },
      {
        id: 'test-doc-2',
        score: 0.85,
        metadata: {
          content:
            'The product roadmap includes several key features planned for Q3',
          document_id: 'doc-456',
        },
      },
    ]),
    storeVector: jest.fn().mockResolvedValue(undefined),
  };

  const mockLlmService = {
    getChatModel: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue({
        content:
          '```json\n{"strategy": "hybrid", "topK": 5, "minScore": 0.8}\n```',
      }),
    }),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key, defaultValue) => {
      if (key === 'PINECONE_DIMENSIONS') return 1024;
      if (key === 'USE_SEMANTIC_CHUNKING') return 'true';
      return defaultValue;
    }),
  };

  const mockDimensionAdapter = {
    getTargetDimension: jest.fn().mockReturnValue(1024),
    needsAdaptation: jest.fn().mockReturnValue(true),
    adaptDimension: jest.fn().mockImplementation((embedding) => {
      return embedding.slice(0, 1024); // Just return first 1024 dimensions
    }),
  };

  // Mock services for semantic chunking
  const mockChunkingService = {
    smartChunk: jest.fn().mockReturnValue(['chunk1', 'chunk2']),
  };

  const mockSimilarityUtilsService = {
    calculateCosineSimilarity: jest.fn().mockReturnValue(0.8),
    computeSimilarityMatrix: jest.fn().mockReturnValue([
      [1, 0.8],
      [0.8, 1],
    ]),
    adjustThreshold: jest.fn().mockReturnValue(0.75),
  };

  const mockSentenceParserService = {
    parseSentences: jest.fn().mockReturnValue(['Sentence 1', 'Sentence 2']),
    parseAdvancedSentences: jest
      .fn()
      .mockReturnValue(['Sentence 1', 'Sentence 2']),
    splitBySemanticBoundaries: jest
      .fn()
      .mockReturnValue(['Sentence 1', 'Sentence 2']),
  };

  const mockChunkOptimizationService = {
    createInitialChunks: jest.fn().mockReturnValue([[0, 1]]),
    optimizeAndRebalanceChunks: jest.fn().mockReturnValue([[0, 1]]),
    applyContextPrefixToChunks: jest
      .fn()
      .mockReturnValue(['Chunk 1 with context']),
  };

  const mockSemanticChunkingService = {
    chunkTextSemantically: jest.fn().mockResolvedValue(['Chunk 1', 'Chunk 2']),
    chunkDocumentSemantically: jest.fn().mockResolvedValue([
      { id: 'test-chunk-0', content: 'Chunk 1', metadata: { chunk_index: 0 } },
      { id: 'test-chunk-1', content: 'Chunk 2', metadata: { chunk_index: 1 } },
    ]),
    batchProcessDocuments: jest.fn().mockResolvedValue([
      { id: 'test-chunk-0', content: 'Chunk 1', metadata: { chunk_index: 0 } },
      { id: 'test-chunk-1', content: 'Chunk 2', metadata: { chunk_index: 1 } },
    ]),
  };

  beforeAll(async () => {
    // Setup MSW handlers for external API calls
    server.use(
      // Mock OpenAI Embeddings API
      http.post('https://api.openai.com/v1/embeddings', async () => {
        return HttpResponse.json({
          data: [
            {
              embedding: Array(1536).fill(0.1),
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
        });
      }),

      // Mock Pinecone query API
      http.post('*/query', async () => {
        return HttpResponse.json({
          matches: [
            {
              id: 'test-doc-1',
              score: 0.95,
              metadata: {
                content:
                  'This is a test document content for the product roadmap',
                document_id: 'doc-123',
                chunk_index: 0,
                chunk_count: 2,
              },
            },
            {
              id: 'test-doc-2',
              score: 0.85,
              metadata: {
                content:
                  'The product roadmap includes several key features planned for Q3',
                document_id: 'doc-456',
                chunk_index: 1,
                chunk_count: 3,
              },
            },
          ],
          namespace: 'documents',
        });
      }),

      // Mock Pinecone upsert API
      http.post('*/vectors/upsert', async () => {
        return HttpResponse.json({
          upsertedCount: 1,
        });
      }),

      // Mock chat completion API response for strategy determination
      http.post('https://api.openai.com/v1/chat/completions', async () => {
        return HttpResponse.json({
          id: 'chatcmpl-mock-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content:
                  '```json\n{"strategy": "hybrid", "topK": 5, "minScore": 0.8}\n```',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 10,
            total_tokens: 30,
          },
        });
      }),
    );

    // Create testing module using NestJS testing utilities
    moduleRef = await Test.createTestingModule({
      providers: [
        // Concrete service implementations
        RetrievalService,
        RagService,
        AdaptiveRagService,

        // Token-based providers
        {
          provide: RETRIEVAL_SERVICE,
          useClass: RetrievalService,
        },
        {
          provide: RAG_SERVICE,
          useClass: RagService,
        },
        {
          provide: ADAPTIVE_RAG_SERVICE,
          useClass: AdaptiveRagService,
        },

        // Mock dependencies
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: EMBEDDING_SERVICE,
          useValue: mockEmbeddingService,
        },
        {
          provide: PINECONE_SERVICE,
          useValue: mockPineconeService,
        },
        {
          provide: LLM_SERVICE,
          useValue: mockLlmService,
        },
        {
          provide: STATE_SERVICE,
          useValue: mockStateService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DimensionAdapterService,
          useFactory: () => mockDimensionAdapter,
        },
        {
          provide: ChunkingService,
          useValue: mockChunkingService,
        },
        {
          provide: SimilarityUtilsService,
          useValue: mockSimilarityUtilsService,
        },
        {
          provide: SentenceParserService,
          useValue: mockSentenceParserService,
        },
        {
          provide: ChunkOptimizationService,
          useValue: mockChunkOptimizationService,
        },
        {
          provide: SemanticChunkingService,
          useValue: mockSemanticChunkingService,
        },
      ],
    }).compile();

    // Get service instances through the module ref
    retrievalService = moduleRef.get<IRetrievalService>(RETRIEVAL_SERVICE);
    ragService = moduleRef.get<IRagService>(RAG_SERVICE);
    adaptiveRagService =
      moduleRef.get<IAdaptiveRagService>(ADAPTIVE_RAG_SERVICE);

    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await moduleRef.close();
    jest.clearAllMocks();
  });

  describe('RetrievalService', () => {
    it('should retrieve relevant documents for a query', async () => {
      // Test query
      const query =
        'What were the key points discussed in the last meeting about the product roadmap?';

      // Mock the implementation for this specific test
      mockPineconeService.querySimilar.mockResolvedValueOnce([
        {
          id: 'test-doc-1',
          score: 0.95,
          metadata: {
            content: 'This is a test document content for the product roadmap',
            document_id: 'doc-123',
          },
        },
      ]);

      const results = await retrievalService.retrieveDocuments(query);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check structure of the first result
      expect(results[0]).toHaveProperty('id', 'test-doc-1');
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('metadata');
      expect(results[0]).toHaveProperty('score', 0.95);

      // Verify content has been properly extracted
      expect(results[0].content).toContain('product roadmap');

      // Verify embedding service was called
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        query,
      );
    });
  });

  describe('RagService', () => {
    it('should enhance state with retrieved context', async () => {
      const query =
        'What were the key points discussed in the last meeting about the product roadmap?';
      const state: TranscriptState = {
        transcript: 'Discussion about product roadmap and feature priorities',
      };

      // Setup mock documents that will be returned
      const mockDocuments: RetrievedDocument[] = [
        {
          id: 'test-doc-1',
          content: 'This is a test document content for the product roadmap',
          metadata: { document_id: 'doc-123' },
          score: 0.95,
        },
      ];

      // Create a one-time mock implementation by getting the interface
      const retrievalServiceRef =
        moduleRef.get<IRetrievalService>(RETRIEVAL_SERVICE);
      jest
        .spyOn(retrievalServiceRef, 'retrieveDocuments')
        .mockResolvedValueOnce(mockDocuments);

      const enhancedState = await ragService.enhanceStateWithContext(
        state,
        query,
      );

      expect(enhancedState).toBeDefined();
      expect(enhancedState).toHaveProperty('transcript');
      expect(enhancedState).toHaveProperty('retrievedContext');

      if (enhancedState.retrievedContext) {
        expect(enhancedState.retrievedContext).toHaveProperty('query', query);
        expect(enhancedState.retrievedContext).toHaveProperty('documents');
        expect(Array.isArray(enhancedState.retrievedContext.documents)).toBe(
          true,
        );

        // Use the exact mock documents array for comparison to avoid unexpected changes
        expect(enhancedState.retrievedContext.documents).toEqual(mockDocuments);
      }
    });
  });

  describe('AdaptiveRagService', () => {
    it('should determine appropriate retrieval strategy for a query', async () => {
      const query =
        'What were the key points discussed in the last meeting about the product roadmap?';

      const result = await adaptiveRagService.determineRetrievalStrategy(query);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('strategy', 'hybrid');
      expect(result).toHaveProperty('settings');
      expect(result.settings).toHaveProperty('topK', 5);
      expect(result.settings).toHaveProperty('minScore', 0.8);

      // Verify LLM service was called
      expect(mockLlmService.getChatModel).toHaveBeenCalled();
    });
  });
});
