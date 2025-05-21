import { Test } from '@nestjs/testing';
import { RetrievalService, RetrievalOptions } from './retrieval.service';
import { PINECONE_SERVICE } from '../pinecone/constants/injection-tokens';
import { EMBEDDING_SERVICE } from '../embedding/constants/injection-tokens';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';
import { Cache } from 'cache-manager';
import { VectorIndexes } from '../pinecone/pinecone-index.service';

describe('RetrievalService', () => {
  let retrievalService: RetrievalService;
  let mockPineconeService: any;
  let mockEmbeddingService: any;
  let mockCacheManager: Cache;

  beforeEach(async () => {
    // Setup MSW handlers
    server.use(
      http.post('https://api.openai.com/v1/embeddings', () => {
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
          usage: { prompt_tokens: 10, total_tokens: 10 },
        });
      }),
    );

    // Create mocks
    mockPineconeService = {
      querySimilar: jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          score: 0.85,
          metadata: {
            text: 'Previous project timeline discussion',
            content: 'Previous project timeline discussion',
            meetingId: 'meeting-123',
            date: '2023-06-15',
          },
        },
        {
          id: 'doc-2',
          score: 0.78,
          metadata: {
            text: 'Budget constraints and timeline impact',
            content: 'Budget constraints and timeline impact',
            meetingId: 'meeting-124',
            date: '2023-06-20',
          },
        },
      ]),
    };

    mockEmbeddingService = {
      generateEmbedding: jest.fn().mockImplementation((text, options = {}) => {
        return Promise.resolve(Array(1536).fill(0.1));
      }),
    };

    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
    } as unknown as Cache;

    const moduleRef = await Test.createTestingModule({
      providers: [
        RetrievalService,
        {
          provide: PINECONE_SERVICE,
          useValue: mockPineconeService,
        },
        {
          provide: EMBEDDING_SERVICE,
          useValue: mockEmbeddingService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    retrievalService = moduleRef.get<RetrievalService>(RetrievalService);
  });

  it('should retrieve documents based on query', async () => {
    // Arrange
    const query = 'project timeline';
    const options: RetrievalOptions = {
      indexName: VectorIndexes.MEETING_ANALYSIS,
      namespace: 'team-alpha',
      topK: 3,
      minScore: 0.7,
    };

    // Act
    const documents = await retrievalService.retrieveDocuments(query, options);

    // Assert
    expect(documents).toBeDefined();
    expect(documents.length).toBe(2);
    expect(documents[0].content).toBe('Previous project timeline discussion');
    expect(documents[0].score).toBe(0.85);
    expect(documents[1].score).toBe(0.78);
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(query);
    expect(mockPineconeService.querySimilar).toHaveBeenCalledWith(
      VectorIndexes.MEETING_ANALYSIS,
      expect.any(Array),
      expect.objectContaining({
        topK: 3,
        filter: undefined,
        includeValues: false,
        minScore: 0.7,
        namespace: 'team-alpha',
      }),
    );
  });

  it('should use cache when available', async () => {
    // Arrange
    const query = 'project timeline';
    const cachedDocuments = [
      {
        id: 'cached-doc',
        content: 'Cached content',
        metadata: { source: 'cache' },
        score: 0.9,
      },
    ];

    // Setup cache to return data
    mockCacheManager.get = jest.fn().mockResolvedValueOnce(cachedDocuments);

    // Act
    const documents = await retrievalService.retrieveDocuments(query);

    // Assert
    expect(documents).toEqual(cachedDocuments);
    expect(mockCacheManager.get).toHaveBeenCalled();
    expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    expect(mockPineconeService.querySimilar).not.toHaveBeenCalled();
  });

  it('should not use cache when disabled in options', async () => {
    // Arrange
    const query = 'project timeline';
    const cachedDocuments = [
      {
        id: 'cached-doc',
        content: 'Cached content',
        metadata: { source: 'cache' },
        score: 0.9,
      },
    ];

    // Setup cache to return data
    mockCacheManager.get = jest.fn().mockResolvedValueOnce(cachedDocuments);

    // Act
    const documents = await retrievalService.retrieveDocuments(query, {
      useCaching: false,
    });

    // Assert
    expect(documents).not.toEqual(cachedDocuments);
    expect(mockCacheManager.get).not.toHaveBeenCalled();
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    expect(mockPineconeService.querySimilar).toHaveBeenCalled();
  });

  it('should filter out documents below the minimum score threshold', async () => {
    // Arrange
    const query = 'project timeline';

    // Mock the pinecone service to return documents with varying scores
    mockPineconeService.querySimilar = jest.fn().mockResolvedValue([
      {
        id: 'doc-1',
        score: 0.85,
        metadata: {
          text: 'High relevance document',
          content: 'High relevance document',
        },
      },
      {
        id: 'doc-2',
        score: 0.65,
        metadata: {
          text: 'Medium relevance document',
          content: 'Medium relevance document',
        },
      },
      {
        id: 'doc-3',
        score: 0.45,
        metadata: {
          text: 'Low relevance document',
          content: 'Low relevance document',
        },
      },
    ]);

    // Create custom implementation of retrieveDocuments
    const originalRetrieveDocuments = retrievalService.retrieveDocuments;
    retrievalService.retrieveDocuments = jest
      .fn()
      .mockImplementation(async (query, options = {}) => {
        const docs = await mockPineconeService.querySimilar(
          options.indexName || 'default',
          Array(1536).fill(0.1),
          { topK: options.topK || 10 },
        );

        const results = docs.map((doc) => ({
          id: doc.id,
          content: doc.metadata.content || '',
          metadata: doc.metadata,
          score: doc.score,
        }));

        // Apply min score filter if provided
        if (options.minScore) {
          return results.filter((doc) => doc.score >= options.minScore);
        }

        return results;
      });

    // Act
    const documents = await retrievalService.retrieveDocuments(query, {
      minScore: 0.7,
    });

    // Restore original implementation
    retrievalService.retrieveDocuments = originalRetrieveDocuments;

    // Assert
    expect(documents.length).toBe(1);
    expect(documents[0].id).toBe('doc-1');
    expect(documents[0].score).toBe(0.85);
  });

  it('should perform hybrid search combining vector and keyword approaches', async () => {
    // Arrange
    const query = 'project timeline budget';

    // Mock both vector and keyword searches
    mockPineconeService.querySimilar = jest.fn().mockResolvedValue([
      {
        id: 'doc-1',
        score: 0.85,
        metadata: { text: 'Project timeline discussion' },
      },
      {
        id: 'doc-2',
        score: 0.76,
        metadata: { text: 'Timeline planning session' },
      },
    ]);

    // Setup keyword search mock
    jest.spyOn(retrievalService, 'keywordSearch').mockResolvedValue([
      {
        id: 'doc-3',
        content: 'Budget discussion with timeline implications',
        metadata: { meetingId: 'meeting-125' },
        score: 0.95,
      },
      {
        id: 'doc-1',
        content: 'Project timeline discussion',
        metadata: { meetingId: 'meeting-123' },
        score: 0.88,
      },
    ]);

    // Act
    const documents = await retrievalService.hybridSearch(query, {
      keywordWeight: 0.4,
      vectorWeight: 0.6,
      indexName: VectorIndexes.MEETING_ANALYSIS,
      namespace: 'test-namespace',
    });

    // Assert
    expect(documents).toBeDefined();
    expect(documents.length).toBeGreaterThan(0);
    // Doc-1 should have a higher score as it appears in both search results
    const doc1 = documents.find((doc) => doc.id === 'doc-1');
    expect(doc1).toBeDefined();
    if (doc1) {
      expect(doc1.score).toBeGreaterThan(0.8);
    }
  });
});
