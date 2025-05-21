import { Test } from '@nestjs/testing';
import { RagService } from './rag.service';
import { RetrievalService } from './retrieval.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { LlmService } from '../langgraph/llm/llm.service';
import { StateService } from '../langgraph/state/state.service';
import { RETRIEVAL_SERVICE } from './constants/injection-tokens';
import { EMBEDDING_SERVICE } from '../embedding/constants/injection-tokens';
import { LLM_SERVICE } from '../langgraph/llm/constants/injection-tokens';
import { STATE_SERVICE } from '../langgraph/state/constants/injection-tokens';
import { PINECONE_SERVICE } from '../pinecone/constants/injection-tokens';
import { DimensionAdapterService } from '../embedding/dimension-adapter.service';
import { PineconeService } from '../pinecone/pinecone.service';
import { ConfigService } from '@nestjs/config';
import { SemanticChunkingService } from '../embedding/semantic-chunking.service';

describe('RagService', () => {
  let ragService: RagService;
  let retrievalService: RetrievalService;
  let embeddingService: EmbeddingService;
  let llmService: LlmService;
  let stateService: StateService;
  let pineconeService: PineconeService;
  let dimensionAdapter: DimensionAdapterService;
  let semanticChunking: SemanticChunkingService;
  let configService: ConfigService;

  beforeEach(async () => {
    const mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    };

    const mockRetrievalService = {
      retrieveDocuments: jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          content: 'This is a test document',
          metadata: { source: 'test' },
          score: 0.9,
        },
      ]),
    };

    const mockLlmService = {
      generateText: jest.fn().mockResolvedValue('Generated text'),
    };

    const mockStateService = {
      getState: jest.fn().mockResolvedValue({}),
      saveState: jest.fn().mockResolvedValue({}),
    };

    const mockPineconeService = {
      storeVector: jest.fn().mockResolvedValue(undefined),
    };

    const mockDimensionAdapter = {
      getTargetDimension: jest.fn().mockReturnValue(1024),
      needsAdaptation: jest.fn().mockReturnValue(true),
      adaptDimension: jest.fn().mockImplementation((embedding) => {
        return embedding.slice(0, 1024); // Just return first 1024 dimensions
      }),
    };

    const mockSemanticChunking = {
      chunkTextSemantically: jest
        .fn()
        .mockResolvedValue(['Chunk 1', 'Chunk 2']),
      chunkDocumentSemantically: jest.fn().mockResolvedValue([
        {
          id: 'test-chunk-0',
          content: 'Chunk 1',
          metadata: { chunk_index: 0 },
        },
        {
          id: 'test-chunk-1',
          content: 'Chunk 2',
          metadata: { chunk_index: 1 },
        },
      ]),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key, defaultVal) => {
        if (key === 'USE_SEMANTIC_CHUNKING') return 'true';
        return defaultVal;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: RETRIEVAL_SERVICE,
          useValue: mockRetrievalService,
        },
        {
          provide: EMBEDDING_SERVICE,
          useValue: mockEmbeddingService,
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
          provide: PINECONE_SERVICE,
          useValue: mockPineconeService,
        },
        {
          provide: DimensionAdapterService,
          useValue: mockDimensionAdapter,
        },
        {
          provide: SemanticChunkingService,
          useValue: mockSemanticChunking,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    ragService = moduleRef.get<RagService>(RagService);
    retrievalService = moduleRef.get(RETRIEVAL_SERVICE);
    embeddingService = moduleRef.get(EMBEDDING_SERVICE);
    llmService = moduleRef.get(LLM_SERVICE);
    stateService = moduleRef.get(STATE_SERVICE);
    pineconeService = moduleRef.get(PINECONE_SERVICE);
    dimensionAdapter = moduleRef.get(DimensionAdapterService);
    semanticChunking = moduleRef.get(SemanticChunkingService);
    configService = moduleRef.get(ConfigService);
  });

  describe('getContext', () => {
    it('should return documents from the retrieval service', async () => {
      const result = await ragService.getContext('test query');
      expect(retrievalService.retrieveDocuments).toHaveBeenCalledWith(
        'test query',
        {},
      );
      expect(result).toEqual([
        {
          id: 'doc-1',
          content: 'This is a test document',
          metadata: { source: 'test' },
          score: 0.9,
        },
      ]);
    });
  });

  describe('chunkText', () => {
    it('should use semantic chunking when enabled', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('true');

      const result = await ragService.chunkText('This is a test document');

      expect(semanticChunking.chunkTextSemantically).toHaveBeenCalled();
      expect(result).toEqual(['Chunk 1', 'Chunk 2']);
    });

    it('should use traditional chunking when semantic chunking is disabled', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('false');

      const result = await ragService.chunkText('This is a test document', {
        useSemanticChunking: false,
      });

      expect(semanticChunking.chunkTextSemantically).not.toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('processDocumentsForRag', () => {
    it('should process documents with semantic chunking', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('true');

      const docs = [
        {
          id: 'test-doc',
          content: 'This is a test document',
          metadata: { source: 'test' },
        },
      ];

      await ragService.processDocumentsForRag(docs);

      expect(semanticChunking.chunkDocumentSemantically).toHaveBeenCalled();
      expect(embeddingService.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(pineconeService.storeVector).toHaveBeenCalledTimes(2);
    });

    it('should process documents with traditional chunking when semantic chunking is disabled', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('false');

      const docs = [
        {
          id: 'test-doc',
          content: 'This is a test document',
          metadata: { source: 'test' },
        },
      ];

      await ragService.processDocumentsForRag(docs, {
        useSemanticChunking: false,
      });

      expect(semanticChunking.chunkDocumentSemantically).not.toHaveBeenCalled();
      expect(embeddingService.generateEmbedding).toHaveBeenCalled();
      expect(pineconeService.storeVector).toHaveBeenCalled();
    });
  });

  describe('enhanceStateWithContext', () => {
    it('should add retrieved context to state', async () => {
      const state = { transcript: 'test transcript' };
      const result = await ragService.enhanceStateWithContext(
        state,
        'test query',
      );

      expect(retrievalService.retrieveDocuments).toHaveBeenCalledWith(
        'test query',
        {},
      );
      expect(result).toHaveProperty('retrievedContext');
      expect(result.retrievedContext.documents).toEqual([
        {
          id: 'doc-1',
          content: 'This is a test document',
          metadata: { source: 'test' },
          score: 0.9,
        },
      ]);
    });
  });

  describe('createRagRetrievalNode', () => {
    it('should create a node function that extracts query and retrieves documents', async () => {
      const queryExtractor = (state: any) => state.transcript || '';
      const node = ragService.createRagRetrievalNode(queryExtractor);

      const state = { transcript: 'test transcript' };
      const result = await node(state);

      expect(retrievalService.retrieveDocuments).toHaveBeenCalledWith(
        'test transcript',
        {},
      );
      expect(result).toHaveProperty('retrievedContext');
    });
  });

  describe('addRagToGraph', () => {
    it('should add RAG node to graph', () => {
      const mockGraph = {
        addNode: jest.fn(),
        addEdge: jest.fn(),
        edges: [{ source: '__start__', target: 'topic_extraction' }],
      };

      ragService.addRagToGraph(mockGraph);

      expect(mockGraph.addNode).toHaveBeenCalled();
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        'rag_retrieval',
        'topic_extraction',
      );
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        '__start__',
        'rag_retrieval',
      );
    });
  });
});
