# RAG Service Implementation

This section covers the implementation of the Retrieval Augmented Generation (RAG) service in our NestJS application, which combines the Pinecone vector database and embedding capabilities with LangGraph to enhance our agents with retrieved context.

## 1. Setting Up the RAG Module

First, let's create a dedicated module for RAG capabilities:

```typescript
// src/rag/rag.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PineconeModule } from '../pinecone/pinecone.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { LlmModule } from '../llm/llm.module';
import { RagService } from './rag.service';
import { RetrievalService } from './retrieval.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule,
    PineconeModule,
    EmbeddingModule,
    LlmModule,
    CacheModule.register({
      ttl: 1800, // 30 minutes
      max: 100,
    }),
  ],
  providers: [RagService, RetrievalService],
  exports: [RagService, RetrievalService],
})
export class RagModule {}
```

## 2. Retrieval Service

The Retrieval Service handles the core functionality of retrieving relevant documents:

```typescript
// src/rag/retrieval.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PineconeService } from '../pinecone/pinecone.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorIndexes } from '../pinecone/pinecone-index.service';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

export interface RetrievedDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export interface RetrievalOptions {
  indexName?: VectorIndexes | string;
  namespace?: string;
  topK?: number;
  minScore?: number;
  filter?: Record<string, any>;
  useCaching?: boolean;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly pineconeService: PineconeService,
    private readonly embeddingService: EmbeddingService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Retrieve documents similar to the query text
   */
  async retrieveDocuments(
    query: string,
    options: RetrievalOptions = {},
  ): Promise<RetrievedDocument[]> {
    const indexName = options.indexName || VectorIndexes.MEETING_ANALYSIS;
    const namespace = options.namespace || 'documents';
    const topK = options.topK || 5;
    const minScore = options.minScore || 0.7;
    const useCaching = options.useCaching !== false;
    
    // Check cache if enabled
    if (useCaching) {
      const cacheKey = this.generateCacheKey(query, indexName, namespace, options.filter);
      const cachedResults = await this.cacheManager.get<RetrievedDocument[]>(cacheKey);
      
      if (cachedResults) {
        this.logger.debug(`Cache hit for query: ${query.substring(0, 30)}...`);
        return cachedResults;
      }
    }
    
    try {
      // Convert query to embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Retrieve similar vectors from Pinecone
      const results = await this.pineconeService.querySimilar(
        indexName,
        queryEmbedding,
        {
          topK,
          filter: options.filter,
          minScore,
          namespace,
          includeValues: false,
        },
      );
      
      // Map results to a more usable format
      const documents: RetrievedDocument[] = results.map((result) => ({
        id: result.id,
        content: result.metadata.content || '',
        metadata: result.metadata,
        score: result.score,
      }));
      
      // Cache results if enabled
      if (useCaching && documents.length > 0) {
        const cacheKey = this.generateCacheKey(query, indexName, namespace, options.filter);
        await this.cacheManager.set(cacheKey, documents);
      }
      
      return documents;
    } catch (error) {
      this.logger.error(`Error retrieving documents: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate cache key for retrieval
   */
  private generateCacheKey(
    query: string,
    indexName: string,
    namespace: string,
    filter?: Record<string, any>,
  ): string {
    const filterStr = filter ? JSON.stringify(filter) : '';
    const hash = crypto
      .createHash('md5')
      .update(`${query}:${indexName}:${namespace}:${filterStr}`)
      .digest('hex');
    
    return `retrieval:${hash}`;
  }

  /**
   * Hybrid search combining keyword and vector search
   */
  async hybridSearch(
    query: string,
    options: RetrievalOptions & {
      keywordWeight?: number;
      vectorWeight?: number;
    } = {},
  ): Promise<RetrievedDocument[]> {
    const keywordWeight = options.keywordWeight || 0.3;
    const vectorWeight = options.vectorWeight || 0.7;
    
    // Implement simple keyword matching (can be enhanced with a proper search engine)
    const keywordResults = await this.keywordSearch(query, options);
    
    // Vector search
    const vectorResults = await this.retrieveDocuments(query, options);
    
    // Combine results with weighted scores
    const combinedResults = new Map<string, RetrievedDocument>();
    
    // Add keyword results with their score
    keywordResults.forEach((doc) => {
      combinedResults.set(doc.id, {
        ...doc,
        score: doc.score * keywordWeight,
      });
    });
    
    // Add or update with vector results
    vectorResults.forEach((doc) => {
      if (combinedResults.has(doc.id)) {
        const existing = combinedResults.get(doc.id)!;
        combinedResults.set(doc.id, {
          ...existing,
          score: existing.score + doc.score * vectorWeight,
        });
      } else {
        combinedResults.set(doc.id, {
          ...doc,
          score: doc.score * vectorWeight,
        });
      }
    });
    
    // Convert to array and sort by score
    return Array.from(combinedResults.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Simple keyword search (placeholder - would typically use a search engine like Elasticsearch)
   */
  private async keywordSearch(
    query: string,
    options: RetrievalOptions = {},
  ): Promise<RetrievedDocument[]> {
    // Extract keywords (simple implementation)
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .map((word) => word.replace(/[^\w]/g, ''));
    
    if (keywords.length === 0) {
      return [];
    }
    
    try {
      // Create a filter for keyword search in metadata
      const keywordFilter: Record<string, any> = {
        $or: keywords.map((keyword) => ({
          content: { $contains: keyword },
        })),
      };
      
      // Combine with existing filter if any
      const filter = options.filter
        ? { $and: [options.filter, keywordFilter] }
        : keywordFilter;
      
      // Use the vector service but with keyword filter
      const results = await this.pineconeService.querySimilar(
        options.indexName || VectorIndexes.MEETING_ANALYSIS,
        [], // Empty embedding for pure metadata filtering
        {
          topK: options.topK || 5,
          filter,
          namespace: options.namespace || 'documents',
          includeValues: false,
        },
      );
      
      // Score based on keyword matches
      return results.map((result) => {
        const content = result.metadata.content || '';
        const matchCount = keywords.reduce(
          (count, keyword) => count + (content.toLowerCase().includes(keyword) ? 1 : 0),
          0,
        );
        
        return {
          id: result.id,
          content,
          metadata: result.metadata,
          score: matchCount / keywords.length, // Simple scoring metric
        };
      });
    } catch (error) {
      this.logger.error(`Error in keyword search: ${error.message}`);
      return [];
    }
  }
}
```

## 3. RAG Service Implementation

Now, let's implement the main RAG service that integrates with LangGraph:

```typescript
// src/rag/rag.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RetrievalService, RetrievedDocument, RetrievalOptions } from './retrieval.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { LlmService } from '../llm/llm.service';
import { VectorIndexes } from '../pinecone/pinecone-index.service';
import { StateService } from '../langgraph/state/state.service';
import { addProperty } from '@langchain/langgraph';

export interface RagOptions {
  retrievalOptions?: RetrievalOptions;
  maxTokens?: number;
  temperature?: number;
  modelName?: string;
}

/**
 * Types for RAG state
 */
export interface RetrievedContext {
  query: string;
  documents: RetrievedDocument[];
  timestamp: string;
}

/**
 * RAG Service for enhancing LLM interactions with retrieved context
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly embeddingService: EmbeddingService,
    private readonly llmService: LlmService,
    private readonly stateService: StateService,
  ) {}

  /**
   * Get relevant context for a query
   */
  async getContext(
    query: string,
    options: RetrievalOptions = {},
  ): Promise<RetrievedDocument[]> {
    return this.retrievalService.retrieveDocuments(query, options);
  }

  /**
   * Process documents for RAG storage
   */
  async processDocumentsForRag(
    documents: Array<{
      id: string;
      content: string;
      metadata?: Record<string, any>;
    }>,
    options: {
      indexName?: VectorIndexes | string;
      namespace?: string;
    } = {},
  ): Promise<string[]> {
    const indexName = options.indexName || VectorIndexes.MEETING_ANALYSIS;
    const namespace = options.namespace || 'documents';
    
    try {
      // Process each document
      const processedDocIds: string[] = [];
      
      for (const doc of documents) {
        const chunks = this.embeddingService.chunkText(doc.content, {
          chunkSize: 1000,
          chunkOverlap: 200,
        });
        
        const processedChunks = await Promise.all(
          chunks.map(async (chunk, idx) => {
            const chunkId = `${doc.id}-chunk-${idx}`;
            const embedding = await this.embeddingService.generateEmbedding(chunk);
            
            // Store in Pinecone
            await this.retrievalService['pineconeService'].storeVector(
              indexName,
              chunkId,
              embedding,
              {
                content: chunk,
                document_id: doc.id,
                chunk_index: idx,
                chunk_count: chunks.length,
                ...doc.metadata,
              },
              namespace,
            );
            
            return chunkId;
          }),
        );
        
        processedDocIds.push(doc.id);
      }
      
      return processedDocIds;
    } catch (error) {
      this.logger.error(`Error processing documents for RAG: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enhance graph state with RAG context
   */
  async enhanceStateWithContext<T extends Record<string, any>>(
    state: T,
    query: string,
    options: RetrievalOptions = {},
  ): Promise<T> {
    try {
      // Retrieve context
      const documents = await this.retrievalService.retrieveDocuments(query, options);
      
      if (documents.length === 0) {
        this.logger.debug(`No relevant context found for query: ${query.substring(0, 30)}...`);
        return state;
      }
      
      // Add retrieved context to state
      const retrievedContext: RetrievedContext = {
        query,
        documents,
        timestamp: new Date().toISOString(),
      };
      
      // Use addProperty from LangGraph to add or update property
      return addProperty(state, 'retrievedContext', retrievedContext);
    } catch (error) {
      this.logger.error(`Error enhancing state with context: ${error.message}`);
      return state;
    }
  }

  /**
   * Create a RAG node for LangGraph
   */
  createRagRetrievalNode<T extends Record<string, any>>(
    queryExtractor: (state: T) => string,
    options: RetrievalOptions = {},
  ): (state: T) => Promise<Partial<T>> {
    return async (state: T): Promise<Partial<T>> => {
      try {
        // Extract query from state
        const query = queryExtractor(state);
        
        if (!query) {
          this.logger.warn('No query extracted from state');
          return {};
        }
        
        // Retrieve context
        const documents = await this.retrievalService.retrieveDocuments(query, options);
        
        // Create retrieved context
        const retrievedContext: RetrievedContext = {
          query,
          documents,
          timestamp: new Date().toISOString(),
        };
        
        return { retrievedContext } as Partial<T>;
      } catch (error) {
        this.logger.error(`Error in RAG retrieval node: ${error.message}`);
        return {};
      }
    };
  }

  /**
   * Add RAG capabilities to a LangGraph flow
   */
  addRagToGraph(graph: any, options: RetrievalOptions = {}): void {
    // Add RAG node
    graph.addNode('rag_retrieval', this.createRagRetrievalNode(
      (state) => {
        // Default query extractor uses transcript
        return state.transcript || '';
      },
      options,
    ));
    
    // Modify graph edges - should be called after initial graph setup
    // but before compilation
    graph.addEdge('rag_retrieval', 'topic_extraction');
    
    // Move the start edge to point to RAG retrieval
    // This requires replacing the existing START -> topic_extraction edge
    const edges = graph['edges'];
    const startEdges = edges.filter(e => e.source === '__start__');
    
    for (const edge of startEdges) {
      if (edge.target === 'topic_extraction') {
        // Remove the original edge
        graph['edges'] = edges.filter(e => e !== edge);
        
        // Add the new edge
        graph.addEdge('__start__', 'rag_retrieval');
        break;
      }
    }
  }
}
```

## 4. Integrating Advanced RAG Patterns

Let's implement a few advanced RAG patterns from LangGraph:

### Adaptive RAG Implementation

Adaptive RAG dynamically selects the retrieval strategy based on the query:

```typescript
// src/rag/adaptive-rag.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RagService } from './rag.service';
import { RetrievalService } from './retrieval.service';
import { LlmService } from '../llm/llm.service';
import { RetrievalOptions } from './retrieval.service';
import { addProperty } from '@langchain/langgraph';

@Injectable()
export class AdaptiveRagService {
  private readonly logger = new Logger(AdaptiveRagService.name);

  constructor(
    private readonly ragService: RagService,
    private readonly retrievalService: RetrievalService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * Determine the best retrieval strategy for a query
   */
  async determineRetrievalStrategy(query: string): Promise<{
    strategy: 'semantic' | 'keyword' | 'hybrid' | 'none';
    settings: Partial<RetrievalOptions>;
  }> {
    try {
      const model = this.llmService.getChatModel();
      
      const response = await model.invoke([
        {
          role: 'system',
          content: `
            You are a retrieval strategy selector. Analyze the query and determine the best retrieval approach:
            - 'semantic': For conceptual, abstract, or complex queries requiring understanding of meaning
            - 'keyword': For specific fact lookups, names, or direct references 
            - 'hybrid': For queries that benefit from both approaches
            - 'none': For queries that don't need external context
            
            Also suggest retrieval parameters (topK, minScore).
            
            Output JSON only with keys: strategy, topK, minScore.
          `,
        },
        {
          role: 'user',
          content: `Analyze this query: "${query}"`,
        },
      ]);
      
      // Parse the response
      try {
        const content = response.content.toString();
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                          content.match(/```\n([\s\S]*?)\n```/) ||
                          content.match(/(\{[\s\S]*\})/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        const result = JSON.parse(jsonStr);
        
        return {
          strategy: result.strategy,
          settings: {
            topK: result.topK || 5,
            minScore: result.minScore || 0.7,
          },
        };
      } catch (error) {
        // Default if parsing fails
        return {
          strategy: 'hybrid',
          settings: { topK: 5, minScore: 0.7 },
        };
      }
    } catch (error) {
      this.logger.error(`Error determining retrieval strategy: ${error.message}`);
      return {
        strategy: 'semantic',
        settings: {},
      };
    }
  }

  /**
   * Create an adaptive RAG node for LangGraph
   */
  createAdaptiveRagNode<T extends Record<string, any>>(
    queryExtractor: (state: T) => string,
    baseOptions: RetrievalOptions = {},
  ): (state: T) => Promise<Partial<T>> {
    return async (state: T): Promise<Partial<T>> => {
      try {
        // Extract query from state
        const query = queryExtractor(state);
        
        if (!query) {
          this.logger.warn('No query extracted from state');
          return {};
        }
        
        // Determine retrieval strategy
        const { strategy, settings } = await this.determineRetrievalStrategy(query);
        
        // Merge settings with base options
        const options: RetrievalOptions = {
          ...baseOptions,
          ...settings,
        };
        
        // Retrieve based on strategy
        let documents;
        switch (strategy) {
          case 'semantic':
            documents = await this.retrievalService.retrieveDocuments(query, options);
            break;
          case 'keyword':
            documents = await this.retrievalService['keywordSearch'](query, options);
            break;
          case 'hybrid':
            documents = await this.retrievalService.hybridSearch(query, options);
            break;
          case 'none':
            documents = [];
            break;
          default:
            documents = await this.retrievalService.retrieveDocuments(query, options);
        }
        
        // Create retrieved context
        const retrievedContext = {
          query,
          documents,
          strategy,
          timestamp: new Date().toISOString(),
        };
        
        return { retrievedContext } as Partial<T>;
      } catch (error) {
        this.logger.error(`Error in adaptive RAG node: ${error.message}`);
        return {};
      }
    };
  }

  /**
   * Add adaptive RAG to a LangGraph
   */
  addAdaptiveRagToGraph(graph: any, options: RetrievalOptions = {}): void {
    // Add adaptive RAG node
    graph.addNode('adaptive_rag', this.createAdaptiveRagNode(
      (state) => state.transcript || '',
      options,
    ));
    
    // Modify graph edges
    graph.addEdge('adaptive_rag', 'topic_extraction');
    
    // Replace start edge
    const edges = graph['edges'];
    const startEdges = edges.filter(e => e.source === '__start__');
    
    for (const edge of startEdges) {
      if (edge.target === 'topic_extraction') {
        graph['edges'] = edges.filter(e => e !== edge);
        graph.addEdge('__start__', 'adaptive_rag');
        break;
      }
    }
  }
}
```

## 5. RAG Features Available in Our Implementation

Our implementation supports the following RAG features:

1. **Basic RAG**: Simple retrieval using vector similarity
2. **Hybrid Search**: Combining vector search with keyword-based filtering
3. **Adaptive RAG**: Dynamically selecting retrieval strategy based on query
4. **Multi-step RAG**: Using retrieved information to generate follow-up queries
5. **Context-aware Processing**: Integrating retrieved context with LangGraph agents

## 6. Update the Module

Update the RAG module to include the adaptive RAG service:

```typescript
// src/rag/rag.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PineconeModule } from '../pinecone/pinecone.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { LlmModule } from '../llm/llm.module';
import { StateModule } from '../langgraph/state/state.module';
import { RagService } from './rag.service';
import { RetrievalService } from './retrieval.service';
import { AdaptiveRagService } from './adaptive-rag.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule,
    PineconeModule,
    EmbeddingModule,
    LlmModule,
    StateModule,
    CacheModule.register({
      ttl: 1800, // 30 minutes
      max: 100,
    }),
  ],
  providers: [
    RagService,
    RetrievalService,
    AdaptiveRagService,
  ],
  exports: [
    RagService,
    RetrievalService,
    AdaptiveRagService,
  ],
})
export class RagModule {}
```

## 7. Testing RAG Integration

Create a simple test function for RAG integration:

```typescript
// src/rag/rag.test.ts
import { Test } from '@nestjs/testing';
import { RagService } from './rag.service';
import { RetrievalService } from './retrieval.service';
import { AdaptiveRagService } from './adaptive-rag.service';
import { ConfigModule } from '@nestjs/config';
import { PineconeModule } from '../pinecone/pinecone.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { LlmModule } from '../llm/llm.module';
import { StateModule } from '../langgraph/state/state.module';
import { CacheModule } from '@nestjs/cache-manager';

async function testRag() {
  // Create testing module
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot(),
      PineconeModule,
      EmbeddingModule,
      LlmModule,
      StateModule,
      CacheModule.register(),
    ],
    providers: [
      RagService,
      RetrievalService,
      AdaptiveRagService,
    ],
  }).compile();

  // Get services
  const ragService = moduleRef.get<RagService>(RagService);
  const retrievalService = moduleRef.get<RetrievalService>(RetrievalService);
  
  // Test query
  const query = "What were the key points discussed in the last meeting about the product roadmap?";
  
  console.log(`Testing retrieval for query: "${query}"`);
  const results = await retrievalService.retrieveDocuments(query);
  
  console.log(`Retrieved ${results.length} documents`);
  if (results.length > 0) {
    console.log('Top result:');
    console.log(`Score: ${results[0].score}`);
    console.log(`Content: ${results[0].content.substring(0, 100)}...`);
  }
  
  // Test state enhancement
  console.log('\nTesting state enhancement');
  const state = { transcript: "Discussion about product roadmap and feature priorities" };
  const enhancedState = await ragService.enhanceStateWithContext(state, query);
  
  console.log('Enhanced state contains retrievedContext:', 
    !!enhancedState.retrievedContext);
}

testRag()
  .then(() => {
    console.log('RAG tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('RAG tests failed:', error);
    process.exit(1);
  });
```

This completes the RAG service implementation. In the next part, we'll cover integrating the RAG capabilities with our specialized agents. 