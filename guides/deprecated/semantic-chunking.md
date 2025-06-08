# Semantic Chunking for RAG Implementation

## Overview

This document explains the semantic chunking implementation for our Retrieval Augmented Generation (RAG) system. Semantic chunking is a technique that improves the quality of document chunking by ensuring that related content stays together based on meaning rather than just character or token count.

## Components

Our semantic chunking implementation consists of the following components:

1. **SemanticChunkingService**: Orchestrates the entire semantic chunking process
2. **SimilarityUtilsService**: Calculates cosine similarity and manages similarity matrices
3. **SentenceParserService**: Breaks text into sentences or semantic units
4. **ChunkOptimizationService**: Optimizes chunks for size and coherence

## How It Works

The semantic chunking process follows these steps:

1. **Text Parsing**: Break the document into individual sentences or semantic units
2. **Embedding Generation**: Generate vector embeddings for each sentence using OpenAI
3. **Similarity Calculation**: Compute a similarity matrix between all sentences
4. **Initial Chunking**: Group similar sentences together based on a similarity threshold
5. **Chunk Optimization**: Balance chunks to ensure optimal size distribution
6. **Context Enhancement**: Add contextual information to improve chunk coherence

## Configuration Options

You can configure semantic chunking through environment variables:

- `USE_SEMANTIC_CHUNKING`: Enable or disable semantic chunking (default: "true")

Or through options in code:

```typescript
await ragService.processDocumentsForRag(documents, {
  useSemanticChunking: true,
  semanticOptions: {
    similarityThreshold: 0.75,  // Higher values mean more similar content per chunk
    minChunkSize: 3,            // Minimum sentences per chunk
    maxChunkSize: 15,           // Maximum sentences per chunk
    rebalanceChunks: true,      // Apply chunk optimization
    addContextPrefix: true,     // Add context from previous chunks
    parsingStrategy: 'advanced' // 'basic', 'advanced', or 'semantic'
  }
});
```

## Benefits of Semantic Chunking

1. **Improved Relevance**: Chunks contain semantically related content
2. **Better Context Preservation**: Related information stays together
3. **Reduced Redundancy**: Similar content is grouped appropriately
4. **Adaptive Chunking**: Chunks adapt to content complexity

## Integration with RAG

The semantic chunking is integrated with our RAG system in the following ways:

1. **RagService**: Updated to use semantic chunking for document processing
2. **Embedding Generation**: Uses our OpenAI embedding service
3. **Vector Storage**: Properly stores chunks with metadata in Pinecone
4. **Retrieval**: Enhanced context retrieval using semantic chunks

## Performance Considerations

- Semantic chunking is more computationally expensive than basic chunking
- Embedding generation is the most resource-intensive part
- Batch processing is used to optimize embedding generation
- Fallback to basic chunking is available if needed

## Fallback Mechanism

If semantic chunking fails (e.g., due to embedding service issues), the system automatically falls back to traditional chunking to ensure the RAG process continues.

## Example

Input text:
```
In the last meeting, we discussed project timelines. The Acme project needs to be completed by June. This includes all frontend work.

We also need to address the database performance issues. Users have reported slow query responses. The database team suggested index optimization.
```

With traditional chunking (character-based), this might become:
```
Chunk 1: "In the last meeting, we discussed project timelines. The Acme project needs to be completed by June. This includes all frontend work."
Chunk 2: "We also need to address the database performance issues. Users have reported slow query responses. The database team suggested index optimization."
```

With semantic chunking:
```
Chunk 1: "In the last meeting, we discussed project timelines. The Acme project needs to be completed by June. This includes all frontend work."
Chunk 2: "We also need to address the database performance issues. Users have reported slow query responses. The database team suggested index optimization."
```

In this simple example, both approaches would produce similar results. However, with more complex content, semantic chunking would group sentences about the same topic together, even if they were separated by other content.

## Testing

You can run tests for the semantic chunking implementation using:

```bash
npm run test:unit -- src/embedding/semantic-chunking.service.spec.ts
```
