# RAG and Pinecone Integration Guide

This guide explains how Retrieval Augmented Generation (RAG) with Pinecone vector database is implemented in our meeting analysis system.

## Overview

Our meeting analysis system uses RAG to enhance the quality of insights generated from meeting transcripts. The integration performs the following steps:

1. Extract and chunk text from meeting transcripts
2. Generate embeddings for each chunk using embedding models
3. Store embeddings in Pinecone vector database
4. During analysis, retrieve relevant context from the vector database
5. Use retrieved context to enhance the analysis quality

## Architecture

### Components

- **RagService**: Core service that manages document processing and context retrieval
- **EmbeddingService**: Generates embeddings for text using various models
- **PineconeService**: Interacts with Pinecone vector database
- **RetrievalService**: Retrieves relevant documents based on query
- **DimensionAdapterService**: Adapts embedding dimensions to match Pinecone index requirements

### Flow Diagram

```
Client → RagController → RagService → EmbeddingService → PineconeService
                                    ↓     ↑
                                    ↓     ↓
                       MeetingAnalysisService → Analysis Results
                                    ↑
                        DimensionAdapterService
```

## Configuration

### Environment Variables

```
# Embedding configuration
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=1536
PINECONE_DIMENSIONS=1024  # The dimension of your Pinecone index

# Pinecone configuration 
PINECONE_API_KEY=your-api-key
PINECONE_ENVIRONMENT=your-environment
PINECONE_INDEX=your-index-name

# RAG configuration
RAG_ENABLED=true  # Set to false to disable RAG processing
```

### Supported Embedding Models

- `text-embedding-ada-002` (OpenAI)
- `text-embedding-3-small` (OpenAI)
- `text-embedding-3-large` (OpenAI)
- `llama-text-embed-v2` (mapped to OpenAI's text-embedding-3-large)

TODO: For the llama mapping we have these logs we should address and verify

```
 Mapping unsupported model llama-text-embed-v2 to text-embedding-3-large {"req":{"id":2,"method":"POST","url":"/rag-meeting-analysis","query":{},"params":{"path":["rag-meeting-analysis"]},"headers":{"host":"localhost:3000","connection":"keep-alive","content-length":"3752","sec-ch-ua-platform":"\"macOS\"","user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36","accept":"application/json","sec-ch-ua":"\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"","content-type":"application/json","sec-ch-ua-mobile":"?0","origin":"http://localhost:3000","sec-fetch-site":"same-origin","sec-fetch-mode":"cors","sec-fetch-dest":"empty","referer":"http://localhost:3000/api/docs","accept-encoding":"gzip, deflate, br, zstd","accept-language":"en-GB,en-US;q=0.9,en;q=0.8"},"remoteAddress":"::1","remotePort":65249},"context":"EmbeddingService"}
 ```

## Usage

### Processing Documents for RAG

```typescript
// Inject the RAG service
@Inject(RAG_SERVICE) private readonly ragService: IRagService

// Process documents
await this.ragService.processDocumentsForRag([
  {
    id: "document-id",
    content: "Document text content",
    metadata: {
      title: "Document title",
      source: "meeting_transcript",
      date: "2025-05-17"
    }
  }
]);
```

### Retrieving Context

```typescript
// Get context for a query
const documents = await this.ragService.getContext("What was discussed about the project timeline?");

// Enhance state with context
const enhancedState = await this.ragService.enhanceStateWithContext(
  currentState,
  "What was discussed about the project timeline?"
);
```

## Dimension Adapter

The system includes a dimension adapter to handle mismatches between embedding model dimensions and Pinecone index dimensions:

```typescript
// The DimensionAdapterService automatically adapts embeddings to match Pinecone index dimensions
private readonly dimensionAdapter: DimensionAdapterService

// Adapt vector dimensions
const adaptedVector = this.dimensionAdapter.adaptDimension(originalVector);
```

### How Dimension Adaptation Works

1. The system generates embeddings using the configured model (default: text-embedding-3-large with 1536 dimensions)
2. Before storing in Pinecone, the DimensionAdapterService checks if dimensions match
3. If not, it adapts the embeddings by:
   - Truncating vectors if original dimensions are larger than target
   - Padding with zeros if original dimensions are smaller than target

### Best Practice

It's recommended to create your Pinecone index with dimensions that match your embedding model:
- For OpenAI text-embedding-3-large: 1536 dimensions
- For OpenAI text-embedding-3-small: 1536 dimensions
- For OpenAI text-embedding-ada-002: 1536 dimensions

## Troubleshooting

### Common Errors

#### "Cannot access pineconeService. Service structure may have changed."

This error occurs when the `RagService` cannot access the `PineconeService`. Make sure:

1. The PineconeService is properly injected in the RagService constructor:
   ```typescript
   @Inject(PINECONE_SERVICE) private readonly pineconeService: PineconeService
   ```

2. The PineconeService is registered in the module:
   ```typescript
   @Module({
     providers: [
       {
         provide: PINECONE_SERVICE,
         useClass: PineconeService,
       },
     ],
     exports: [PINECONE_SERVICE],
   })
   ```

#### "Vector dimension X does not match the dimension of the index Y"

This error occurs when there's a mismatch between your embedding dimensions and the Pinecone index dimensions. Solutions:

1. Add the DimensionAdapterService to automatically adapt dimensions (already implemented)
2. Create a new Pinecone index with the correct dimensions (recommended for production)
3. Configure the `PINECONE_DIMENSIONS` environment variable to match your index

#### "Unsupported embedding model"

This occurs when trying to use an embedding model that's not directly supported. The system maps certain models:

- `llama-text-embed-v2` → `text-embedding-3-large`

To fix this, ensure the embedding model is correctly specified in your environment variables.

#### Pinecone Connection Errors

If encountering Pinecone connection issues:

1. Verify your Pinecone API key in the environment variables
2. Check that the Pinecone environment and index names are correct
3. Ensure your index is configured with the correct dimensions (matching EMBEDDING_DIMENSIONS)
4. Verify network connectivity to Pinecone API endpoints

### Logging

Detailed logging has been implemented throughout the RAG integration:

```typescript
// Example of logging in the RagService
this.logger.log(`Processing ${documents.length} documents for RAG storage`);
this.logger.debug(`Using index "${indexName}" and namespace "${namespace}"`);
```

To enable debug-level logging, set the `LOG_LEVEL` environment variable to `debug`.

## Performance Considerations

- **Chunking**: Text is split into chunks of ~1000 tokens with a 200 token overlap
- **Batching**: Embeddings are generated in batches to improve performance
- **Caching**: Embeddings are cached to avoid regenerating for identical text
- **Failover**: If RAG processing fails, the system will continue with standard analysis
- **Dimension Adaptation**: Embedding dimensions are automatically adapted to match Pinecone index

## Future Improvements

1. Support for more embedding models (Claude, Cohere, etc.)
2. Advanced chunking strategies based on semantic boundaries
3. Hybrid search (combining vector and keyword search)
4. More sophisticated context incorporation strategies
5. Client-side visualization of retrieved context
6. Implement more sophisticated dimension reduction techniques (e.g., PCA) 