# Embedding Service Implementation

This section covers the implementation of the Embedding Service, which is responsible for converting text content into vector embeddings for storage in Pinecone.

## 1. Setting Up the Embedding Module

Create a dedicated module for embedding services:

```typescript
// src/embedding/embedding.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from '../llm/llm.module';
import { EmbeddingService } from './embedding.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule,
    LlmModule,
    CacheModule.register({
      ttl: 3600, // 1 hour cache time-to-live
      max: 1000, // Maximum number of items in cache
    }),
  ],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
```

## 2. Embedding Service Implementation

Create a service that handles text embedding generation:

```typescript
// src/embedding/embedding.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

export enum EmbeddingModel {
  OPENAI_ADA_002 = 'text-embedding-ada-002',
  OPENAI_3_SMALL = 'text-embedding-3-small',
  OPENAI_3_LARGE = 'text-embedding-3-large',
  ANTHROPIC = 'anthropic',
  LLAMA = 'llama-text-embed-v2',
}

export interface EmbeddingOptions {
  model?: EmbeddingModel;
  batchSize?: number;
  dimensions?: number;
  normalized?: boolean;
  useCaching?: boolean;
}

/**
 * Service for generating text embeddings
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly defaultModel: EmbeddingModel;
  private readonly defaultDimensions: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly llmService: LlmService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.defaultModel = this.configService.get<EmbeddingModel>(
      'EMBEDDING_MODEL',
      EmbeddingModel.OPENAI_3_LARGE,
    );
    this.defaultDimensions = this.configService.get<number>('EMBEDDING_DIMENSIONS', 1536);
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(
    text: string,
    options: EmbeddingOptions = {},
  ): Promise<number[]> {
    const model = options.model || this.defaultModel;
    const useCaching = options.useCaching !== false; // Default to true
    
    // Check cache first if caching is enabled
    if (useCaching) {
      const cacheKey = this.generateCacheKey(text, model);
      const cachedEmbedding = await this.cacheManager.get<number[]>(cacheKey);
      
      if (cachedEmbedding) {
        this.logger.debug(`Cache hit for embedding: ${cacheKey.substring(0, 20)}...`);
        return cachedEmbedding;
      }
    }
    
    try {
      // Generate embedding based on model
      let embedding: number[];
      
      switch (model) {
        case EmbeddingModel.OPENAI_ADA_002:
        case EmbeddingModel.OPENAI_3_SMALL:
        case EmbeddingModel.OPENAI_3_LARGE:
          embedding = await this.llmService.generateOpenAIEmbedding(text, model);
          break;
        case EmbeddingModel.ANTHROPIC:
          embedding = await this.llmService.generateAnthropicEmbedding(text);
          break;
        case EmbeddingModel.LLAMA:
          embedding = await this.llmService.generateLlamaEmbedding(text);
          break;
        default:
          this.logger.warn(`Unknown embedding model: ${model}, using default`);
          embedding = await this.llmService.generateOpenAIEmbedding(text, EmbeddingModel.OPENAI_3_LARGE);
      }
      
      // Normalize if requested
      if (options.normalized) {
        embedding = this.normalizeEmbedding(embedding);
      }
      
      // Cache the result
      if (useCaching) {
        const cacheKey = this.generateCacheKey(text, model);
        await this.cacheManager.set(cacheKey, embedding);
      }
      
      return embedding;
    } catch (error) {
      this.logger.error(`Error generating embedding: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateEmbeddings(
    texts: string[],
    options: EmbeddingOptions = {},
  ): Promise<number[][]> {
    const batchSize = options.batchSize || 20; // Default batch size
    const batches: string[][] = [];
    
    // Split into batches
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
    
    // Process batches
    const embeddings: number[][] = [];
    
    for (const batch of batches) {
      const batchEmbeddings = await Promise.all(
        batch.map((text) => this.generateEmbedding(text, options)),
      );
      embeddings.push(...batchEmbeddings);
    }
    
    return embeddings;
  }

  /**
   * Normalize an embedding vector to unit length
   */
  private normalizeEmbedding(embedding: number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / norm);
  }

  /**
   * Generate a cache key for an embedding
   */
  private generateCacheKey(text: string, model: string): string {
    // Hash the text to create a deterministic key
    const hash = crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
    
    return `embedding:${model}:${hash}`;
  }

  /**
   * Chunk a long text into smaller chunks for embedding
   */
  chunkText(
    text: string,
    options: { 
      chunkSize?: number; 
      chunkOverlap?: number;
      separator?: string;
    } = {},
  ): string[] {
    const chunkSize = options.chunkSize || 1000;
    const chunkOverlap = options.chunkOverlap || 200;
    const separator = options.separator || ' ';
    
    // Simple tokenization by splitting on whitespace
    // For production, consider using a proper tokenizer
    const tokens = text.split(separator);
    
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentChunkLength = 0;
    
    for (const token of tokens) {
      // Add token to current chunk
      currentChunk.push(token);
      currentChunkLength += 1;
      
      // If chunk is full, add it to chunks and start a new one with overlap
      if (currentChunkLength >= chunkSize) {
        chunks.push(currentChunk.join(separator));
        
        // Start new chunk with overlap
        const overlapTokens = currentChunk.slice(-chunkOverlap);
        currentChunk = [...overlapTokens];
        currentChunkLength = overlapTokens.length;
      }
    }
    
    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(separator));
    }
    
    return chunks;
  }

  /**
   * Process a long document for embedding
   */
  async processDocument(
    document: {
      id: string;
      content: string;
      metadata?: Record<string, any>;
    },
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      embeddingOptions?: EmbeddingOptions;
    } = {},
  ): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    embedding: number[];
  }>> {
    const { chunkSize, chunkOverlap, embeddingOptions } = options;
    
    // Chunk the document
    const chunks = this.chunkText(document.content, { 
      chunkSize, 
      chunkOverlap 
    });
    
    // Generate embeddings for each chunk
    const results = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${document.id}-chunk-${i}`;
      const chunkContent = chunks[i];
      
      // Generate embedding
      const embedding = await this.generateEmbedding(
        chunkContent,
        embeddingOptions,
      );
      
      // Create metadata with chunk info
      const metadata = {
        ...document.metadata,
        document_id: document.id,
        chunk_index: i,
        chunk_count: chunks.length,
      };
      
      results.push({
        id: chunkId,
        content: chunkContent,
        metadata,
        embedding,
      });
    }
    
    return results;
  }

  /**
   * Process multiple documents for embedding
   */
  async processDocuments(
    documents: Array<{
      id: string;
      content: string;
      metadata?: Record<string, any>;
    }>,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      embeddingOptions?: EmbeddingOptions;
      concurrency?: number;
    } = {},
  ): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    embedding: number[];
  }>> {
    const concurrency = options.concurrency || 3;
    let results: Array<{
      id: string;
      content: string;
      metadata: Record<string, any>;
      embedding: number[];
    }> = [];
    
    // Process documents with controlled concurrency
    const batches: Array<{
      id: string;
      content: string;
      metadata?: Record<string, any>;
    }>[] = [];
    
    for (let i = 0; i < documents.length; i += concurrency) {
      batches.push(documents.slice(i, i + concurrency));
    }
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((doc) => this.processDocument(doc, options)),
      );
      
      results = results.concat(batchResults.flat());
    }
    
    return results;
  }

  /**
   * Calculate similarity between two embeddings using cosine similarity
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    // Ensure embeddings have the same dimensionality
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }
    
    // Calculate dot product
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    // Prevent division by zero
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    // Return cosine similarity
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}
```

## 3. LLM Service Integration

The Embedding Service depends on the LLM Service for generating embeddings. Update your existing LLM Service to support embedding generation:

```typescript
// src/llm/llm.service.ts
// Add these methods to your existing LlmService

/**
 * Generate embeddings using OpenAI
 */
async generateOpenAIEmbedding(
  text: string,
  model: string = 'text-embedding-3-large',
): Promise<number[]> {
  try {
    const openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    
    const response = await openai.embeddings.create({
      model,
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    this.logger.error(`Error generating OpenAI embedding: ${error.message}`);
    throw error;
  }
}

/**
 * Generate embeddings using Anthropic
 * Note: As of early 2024, Anthropic's embedding API is in preview
 */
async generateAnthropicEmbedding(text: string): Promise<number[]> {
  try {
    const anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
    
    const response = await anthropic.embeddings.create({
      model: 'claude-3-embedding',
      input: text,
    });
    
    return response.embeddings[0];
  } catch (error) {
    this.logger.error(`Error generating Anthropic embedding: ${error.message}`);
    throw error;
  }
}

/**
 * Generate embeddings using Llama
 * This can be customized based on your Llama integration
 */
async generateLlamaEmbedding(text: string): Promise<number[]> {
  // Implementation depends on how you're accessing Llama models
  // This is a placeholder
  throw new Error('Llama embedding not implemented');
}
```

## 4. Document Chunking Strategies

For effective RAG, proper document chunking is crucial. Let's enhance our chunking capabilities:

```typescript
// src/embedding/chunking.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
  splitBy?: 'token' | 'sentence' | 'paragraph';
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  /**
   * Chunk text by tokens (words)
   */
  chunkByTokens(
    text: string,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      separator?: string;
    } = {},
  ): string[] {
    const chunkSize = options.chunkSize || 1000;
    const chunkOverlap = options.chunkOverlap || 200;
    const separator = options.separator || ' ';
    
    const tokens = text.split(separator);
    const chunks: string[] = [];
    
    for (let i = 0; i < tokens.length; i += chunkSize - chunkOverlap) {
      const chunk = tokens.slice(i, i + chunkSize).join(separator);
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Chunk text by sentences
   */
  chunkBySentences(
    text: string,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
    } = {},
  ): string[] {
    const chunkSize = options.chunkSize || 5; // Number of sentences per chunk
    const chunkOverlap = options.chunkOverlap || 1; // Overlap in sentences
    
    // Simple sentence splitting - for production consider a more robust approach
    const sentences = text
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .filter(s => s.trim());
    
    const chunks: string[] = [];
    
    for (let i = 0; i < sentences.length; i += chunkSize - chunkOverlap) {
      const chunk = sentences.slice(i, i + chunkSize).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Chunk text by paragraphs
   */
  chunkByParagraphs(
    text: string,
    options: {
      maxParagraphsPerChunk?: number;
      paragraphSeparator?: string;
    } = {},
  ): string[] {
    const maxParagraphsPerChunk = options.maxParagraphsPerChunk || 3;
    const paragraphSeparator = options.paragraphSeparator || '\n\n';
    
    const paragraphs = text
      .split(paragraphSeparator)
      .filter(p => p.trim());
    
    const chunks: string[] = [];
    
    for (let i = 0; i < paragraphs.length; i += maxParagraphsPerChunk) {
      const chunk = paragraphs
        .slice(i, i + maxParagraphsPerChunk)
        .join('\n\n');
      
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Smart chunking based on content type
   */
  smartChunk(
    text: string,
    options: ChunkingOptions = {},
  ): string[] {
    const splitBy = options.splitBy || 'token';
    
    switch (splitBy) {
      case 'sentence':
        return this.chunkBySentences(text, options);
      case 'paragraph':
        return this.chunkByParagraphs(text, {
          maxParagraphsPerChunk: options.chunkSize || 3,
          paragraphSeparator: options.separator || '\n\n',
        });
      case 'token':
      default:
        return this.chunkByTokens(text, options);
    }
  }

  /**
   * Process document with metadata for each chunk
   */
  chunkDocument(
    document: {
      id: string;
      content: string;
      metadata?: Record<string, any>;
    },
    options: ChunkingOptions = {},
  ): Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
  }> {
    const chunks = this.smartChunk(document.content, options);
    
    return chunks.map((chunk, index) => ({
      id: `${document.id}-chunk-${index}`,
      content: chunk,
      metadata: {
        ...document.metadata,
        document_id: document.id,
        chunk_index: index,
        chunk_count: chunks.length,
      },
    }));
  }
}
```

## 5. Update the Embedding Module

Update the embedding module to include the chunking service:

```typescript
// src/embedding/embedding.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from '../llm/llm.module';
import { EmbeddingService } from './embedding.service';
import { ChunkingService } from './chunking.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule,
    LlmModule,
    CacheModule.register({
      ttl: 3600, // 1 hour cache time-to-live
      max: 1000, // Maximum number of items in cache
    }),
  ],
  providers: [EmbeddingService, ChunkingService],
  exports: [EmbeddingService, ChunkingService],
})
export class EmbeddingModule {}
```

## 6. Document Processing Service

Create a service that combines chunking and embedding for document processing:

```typescript
// src/embedding/document-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService, EmbeddingOptions } from './embedding.service';
import { ChunkingService, ChunkingOptions } from './chunking.service';
import { PineconeService } from '../pinecone/pinecone.service';
import { VectorIndexes } from '../pinecone/pinecone-index.service';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentMetadata {
  title?: string;
  source?: string;
  url?: string;
  author?: string;
  createdAt?: Date;
  tags?: string[];
  [key: string]: any;
}

export interface Document {
  id: string;
  content: string;
  metadata?: DocumentMetadata;
}

export interface ProcessedChunk {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
}

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly chunkingService: ChunkingService,
    private readonly pineconeService: PineconeService,
  ) {}

  /**
   * Process a document and store it in Pinecone
   */
  async processAndStoreDocument(
    document: Document,
    options: {
      indexName?: VectorIndexes | string;
      namespace?: string;
      chunkingOptions?: ChunkingOptions;
      embeddingOptions?: EmbeddingOptions;
    } = {},
  ): Promise<string[]> {
    const indexName = options.indexName || VectorIndexes.MEETING_ANALYSIS;
    const namespace = options.namespace || 'documents';
    
    try {
      // Generate a document ID if not provided
      const docId = document.id || `doc-${uuidv4()}`;
      
      // Chunk the document
      const documentChunks = this.chunkingService.chunkDocument(
        { ...document, id: docId },
        options.chunkingOptions,
      );
      
      // Process chunks with embeddings
      const processedChunks: ProcessedChunk[] = [];
      
      for (const chunk of documentChunks) {
        const embedding = await this.embeddingService.generateEmbedding(
          chunk.content,
          options.embeddingOptions,
        );
        
        processedChunks.push({
          ...chunk,
          embedding,
        });
      }
      
      // Store in Pinecone
      const records = processedChunks.map(chunk => ({
        id: chunk.id,
        vector: chunk.embedding,
        metadata: chunk.metadata,
      }));
      
      await this.pineconeService.storeVectors(indexName, records, namespace);
      
      // Return the IDs of stored chunks
      return processedChunks.map(chunk => chunk.id);
    } catch (error) {
      this.logger.error(`Error processing document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process multiple documents and store them in Pinecone
   */
  async processAndStoreDocuments(
    documents: Document[],
    options: {
      indexName?: VectorIndexes | string;
      namespace?: string;
      chunkingOptions?: ChunkingOptions;
      embeddingOptions?: EmbeddingOptions;
      batchSize?: number;
    } = {},
  ): Promise<string[]> {
    const batchSize = options.batchSize || 5;
    let allChunkIds: string[] = [];
    
    // Process in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchPromises = batch.map(doc =>
        this.processAndStoreDocument(doc, options),
      );
      
      const batchResults = await Promise.all(batchPromises);
      allChunkIds = [...allChunkIds, ...batchResults.flat()];
    }
    
    return allChunkIds;
  }

  /**
   * Delete a document and its chunks from Pinecone
   */
  async deleteDocument(
    documentId: string,
    options: {
      indexName?: VectorIndexes | string;
      namespace?: string;
    } = {},
  ): Promise<void> {
    const indexName = options.indexName || VectorIndexes.MEETING_ANALYSIS;
    const namespace = options.namespace || 'documents';
    
    try {
      // Delete by filter using document_id metadata field
      await this.pineconeService.deleteVectorsByFilter(
        indexName,
        { document_id: documentId },
        namespace,
      );
      
      this.logger.log(`Deleted document ${documentId} from Pinecone`);
    } catch (error) {
      this.logger.error(`Error deleting document: ${error.message}`);
      throw error;
    }
  }
}
```

## 7. Add the Document Processor to the Module

Update the embedding module to include the document processor:

```typescript
// src/embedding/embedding.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from '../llm/llm.module';
import { PineconeModule } from '../pinecone/pinecone.module';
import { EmbeddingService } from './embedding.service';
import { ChunkingService } from './chunking.service';
import { DocumentProcessorService } from './document-processor.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule,
    LlmModule,
    PineconeModule,
    CacheModule.register({
      ttl: 3600, // 1 hour cache time-to-live
      max: 1000, // Maximum number of items in cache
    }),
  ],
  providers: [
    EmbeddingService,
    ChunkingService,
    DocumentProcessorService,
  ],
  exports: [
    EmbeddingService,
    ChunkingService,
    DocumentProcessorService,
  ],
})
export class EmbeddingModule {}
```

## 8. Environment Configuration

Update your `.env` file with embedding-related configuration:

```
# Embedding configuration
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=1536
```

Add validation for these in your configuration schema:

```typescript
// src/config/config.schema.ts
export const configValidationSchema = Joi.object({
  // Other environment variables...
  EMBEDDING_MODEL: Joi.string()
    .valid('text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large', 'anthropic', 'llama-text-embed-v2')
    .default('text-embedding-3-large'),
  EMBEDDING_DIMENSIONS: Joi.number().default(1536),
});
```

## 9. Testing Embeddings

Create a test script to verify your embedding implementation:

```typescript
// src/embedding/embedding.spec.ts
import { Test } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';
import { ChunkingService } from './chunking.service';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from '../llm/llm.module';
import { CacheModule } from '@nestjs/cache-manager';

async function testEmbeddings() {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot(),
      LlmModule,
      CacheModule.register(),
    ],
    providers: [EmbeddingService, ChunkingService],
  }).compile();

  const embeddingService = moduleRef.get<EmbeddingService>(EmbeddingService);
  const chunkingService = moduleRef.get<ChunkingService>(ChunkingService);

  console.log('Testing embedding generation...');
  
  const testText = 'This is a test text for generating embeddings.';
  const embedding = await embeddingService.generateEmbedding(testText);
  
  console.log(`Generated embedding of dimension: ${embedding.length}`);
  console.log(`First few values: ${embedding.slice(0, 5).join(', ')}`);
  
  console.log('\nTesting text chunking...');
  
  const longText = 'This is a long text. ' + 'It has multiple sentences. '.repeat(10);
  
  const chunks = chunkingService.smartChunk(longText, {
    splitBy: 'sentence',
    chunkSize: 3,
  });
  
  console.log(`Split into ${chunks.length} chunks`);
  console.log('First chunk: ', chunks[0]);
}

testEmbeddings()
  .then(() => {
    console.log('Tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Tests failed:', error);
    process.exit(1);
  });
```

This completes the Embedding Service implementation. In the next part, we'll cover the RAG Service implementation that leverages both the Pinecone and Embedding services. 