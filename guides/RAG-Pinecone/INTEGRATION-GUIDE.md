# RAG Pinecone Integration Guide

This guide explains how to use the RAG (Retrieval-Augmented Generation) integration with Pinecone in our NestJS application.

## Overview

The integration consists of several key components:

1. **Pinecone Module**: Manages connections to Pinecone vector database
2. **Embedding Module**: Handles text-to-vector conversion and chunking
3. **RAG Module**: Provides services for retrieval and integration with LangGraph

## Prerequisites

- Pinecone account and API key
- OpenAI API key for embeddings
- NestJS server setup

## Environment Configuration

Add the following environment variables to your `.env` file:

```
# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-environment-region (e.g., us-east-1)
PINECONE_INDEX_NAME=your-index-name

# OpenAI API key for embeddings
OPENAI_API_KEY=your-openai-api-key

# Embedding configuration
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=1536
```

## Usage Guide

### 1. Basic Retrieval

```typescript
import { RetrievalService } from './rag/retrieval.service';

@Injectable()
export class YourService {
  constructor(private readonly retrievalService: RetrievalService) {}

  async findRelevantDocuments(query: string) {
    // Simple retrieval
    const documents = await this.retrievalService.retrieveDocuments(query, {
      topK: 5,
      minScore: 0.7,
      namespace: 'your-namespace',
    });

    return documents;
  }
}
```

### 2. Hybrid Search

```typescript
import { RetrievalService } from './rag/retrieval.service';

@Injectable()
export class YourService {
  constructor(private readonly retrievalService: RetrievalService) {}

  async findRelevantDocumentsHybrid(query: string) {
    // Hybrid search combining vector and keyword search
    const documents = await this.retrievalService.hybridSearch(query, {
      keywordWeight: 0.3,
      vectorWeight: 0.7,
    });

    return documents;
  }
}
```

### 3. Adding Documents to RAG

```typescript
import { RagService } from './rag/rag.service';

@Injectable()
export class YourService {
  constructor(private readonly ragService: RagService) {}

  async addDocumentsToRag(documents: Array<{ id: string; content: string; metadata?: any }>) {
    // Process and store documents in RAG
    const docIds = await this.ragService.processDocumentsForRag(documents, {
      namespace: 'your-namespace',
    });

    return docIds;
  }
}
```

### 4. Enhancing State with Retrieved Context

```typescript
import { RagService } from './rag/rag.service';

@Injectable()
export class YourService {
  constructor(private readonly ragService: RagService) {}

  async enhanceWithContext(state: any, query: string) {
    // Add retrieved context to state
    const enhancedState = await this.ragService.enhanceStateWithContext(state, query);

    return enhancedState;
  }
}
```

### 5. Using Adaptive RAG

```typescript
import { AdaptiveRagService } from './rag/adaptive-rag.service';

@Injectable()
export class YourService {
  constructor(private readonly adaptiveRagService: AdaptiveRagService) {}

  async determineStrategy(query: string) {
    // Let the model decide the best strategy for this query
    const { strategy, settings } = await this.adaptiveRagService.determineRetrievalStrategy(query);

    console.log(`Selected strategy: ${strategy}`);
    console.log(`Recommended settings:`, settings);
    
    return { strategy, settings };
  }
}
```

### 6. Integrating with LangGraph

```typescript
import { RagService } from './rag/rag.service';
import { AdaptiveRagService } from './rag/adaptive-rag.service';

@Injectable()
export class YourGraphService {
  constructor(
    private readonly ragService: RagService,
    private readonly adaptiveRagService: AdaptiveRagService,
  ) {}

  createGraph() {
    // Create your LangGraph
    const graph = new StateGraph({
      channels: {
        transcript: { value: '' },
        topics: { value: [] },
        // other channels...
      }
    });

    // Add nodes
    graph.addNode('topic_extraction', topicExtractionNode);
    // Add other nodes...

    // Add edges
    graph.addEdge('topic_extraction', 'action_item_extraction');
    // Add other edges...

    // Add RAG to the graph
    this.ragService.addRagToGraph(graph, {
      namespace: 'meeting-documents',
    });

    // OR use adaptive RAG
    // this.adaptiveRagService.addAdaptiveRagToGraph(graph);

    // Compile the graph
    const runnable = graph.compile();
    return runnable;
  }
}
```

## Advanced Features

### 1. Filter by Metadata

```typescript
const documents = await retrievalService.retrieveDocuments(query, {
  filter: { 
    document_type: 'meeting_transcript',
    date: { $gte: '2023-01-01' },
  },
});
```

### 2. Custom Chunking

```typescript
// In your service
const chunks = ragService.chunkText(longText, {
  chunkSize: 500,      // Smaller chunks
  chunkOverlap: 100,   // With overlap
});
```

### 3. Caching Retrieval Results

Retrieval caching is enabled by default with a 30-minute TTL. You can disable it:

```typescript
const documents = await retrievalService.retrieveDocuments(query, {
  useCaching: false,  // Disable caching
});
```

## Testing

Run the test script to verify the integration:

```bash
node test-rag-integration.js
```

## Troubleshooting

1. **Empty Results**: If you're getting empty results, check:
   - Is your Pinecone index populated?
   - Is your query relevant to the stored data?
   - Is the minScore threshold too high?

2. **Slow Retrieval**: To improve performance:
   - Use smaller embedding dimensions
   - Enable caching
   - Use more specific queries

3. **Irrelevant Results**: Try:
   - Increasing minScore threshold
   - Using hybrid search
   - Adding more specific metadata filters

## Implementation Architecture

The RAG integration consists of three main services:

1. **RetrievalService**: Handles low-level retrieval operations from Pinecone
2. **RagService**: Provides high-level RAG functionality and integration with LangGraph
3. **AdaptiveRagService**: Adds intelligent retrieval strategy selection

These services rely on:

- **PineconeService**: For vector database operations
- **EmbeddingService**: For text-to-vector conversion
- **StateService**: For LangGraph state management

This modular design allows you to use the components together or independently based on your needs. 