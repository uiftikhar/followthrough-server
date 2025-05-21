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
  createdAt?: Date | string;
  updatedAt?: Date | string;
  tags?: string[];
  type?: string;
  category?: string;
  summary?: string;
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

/**
 * Service for processing documents, generating embeddings, and storing in Pinecone
 */
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

      this.logger.log(`Processing document: ${docId}`);

      // Chunk the document
      const documentChunks = this.chunkingService.chunkDocument(
        { ...document, id: docId },
        options.chunkingOptions,
      );

      this.logger.debug(
        `Document ${docId} split into ${documentChunks.length} chunks`,
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
      const records = processedChunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.embedding,
        metadata: {
          ...chunk.metadata,
          text: chunk.content, // Include text in metadata for retrieval
        },
      }));

      await this.pineconeService.storeVectors(indexName, records, namespace);

      this.logger.log(
        `Document ${docId} processed and stored in Pinecone index ${indexName}`,
      );

      // Return the IDs of stored chunks
      return processedChunks.map((chunk) => chunk.id);
    } catch (error) {
      this.logger.error(
        `Error processing document: ${error.message}`,
        error.stack,
      );
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
      concurrency?: number;
    } = {},
  ): Promise<string[]> {
    const batchSize = options.batchSize || 5;
    const concurrency = options.concurrency || 3;
    let allChunkIds: string[] = [];

    this.logger.log(
      `Processing ${documents.length} documents in batches of ${batchSize}`,
    );

    // Process in batches with controlled concurrency
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      this.logger.debug(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(documents.length / batchSize)}`,
      );

      // Process documents with controlled concurrency
      const batches: Document[][] = [];
      for (let j = 0; j < batch.length; j += concurrency) {
        batches.push(batch.slice(j, j + concurrency));
      }

      for (const concurrentBatch of batches) {
        const batchPromises = concurrentBatch.map((doc) =>
          this.processAndStoreDocument(doc, options),
        );

        const batchResults = await Promise.all(batchPromises);
        allChunkIds = [...allChunkIds, ...batchResults.flat()];
      }
    }

    this.logger.log(
      `Completed processing ${documents.length} documents, created ${allChunkIds.length} chunks`,
    );

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
      this.logger.log(
        `Deleting document ${documentId} from Pinecone index ${indexName}`,
      );

      // Delete by filter using document_id metadata field
      await this.pineconeService.deleteVectorsByFilter(
        indexName,
        { document_id: documentId },
        namespace,
      );

      this.logger.log(
        `Successfully deleted document ${documentId} from Pinecone`,
      );
    } catch (error) {
      this.logger.error(
        `Error deleting document ${documentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Retrieve similar documents from Pinecone
   */
  async retrieveSimilarDocuments(
    query: string,
    options: {
      indexName?: VectorIndexes | string;
      namespace?: string;
      topK?: number;
      minScore?: number;
      filter?: Record<string, any>;
      embeddingOptions?: EmbeddingOptions;
    } = {},
  ): Promise<
    Array<{
      id: string;
      content: string;
      metadata: Record<string, any>;
      score: number;
    }>
  > {
    const indexName = options.indexName || VectorIndexes.MEETING_ANALYSIS;
    const namespace = options.namespace || 'documents';
    const topK = options.topK || 10;
    const minScore = options.minScore || 0.7;

    try {
      this.logger.log(
        `Retrieving documents similar to query from Pinecone index ${indexName}`,
      );

      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        query,
        options.embeddingOptions,
      );

      // Query Pinecone
      const results = await this.pineconeService.querySimilar(
        indexName,
        queryEmbedding,
        {
          topK,
          filter: options.filter,
          minScore,
          namespace,
        },
      );

      this.logger.debug(`Retrieved ${results.length} similar documents`);

      // Format results
      return results.map((result) => ({
        id: result.id,
        content:
          typeof result.metadata.text === 'string' ? result.metadata.text : '',
        metadata: { ...result.metadata, text: undefined }, // Remove text from returned metadata to avoid duplication
        score: result.score,
      }));
    } catch (error) {
      this.logger.error(
        `Error retrieving similar documents: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Reindex a document with updated content
   */
  async reindexDocument(
    documentId: string,
    newContent: string,
    newMetadata?: DocumentMetadata,
    options: {
      indexName?: VectorIndexes | string;
      namespace?: string;
      chunkingOptions?: ChunkingOptions;
      embeddingOptions?: EmbeddingOptions;
    } = {},
  ): Promise<string[]> {
    try {
      this.logger.log(`Reindexing document ${documentId}`);

      // First delete the existing document
      await this.deleteDocument(documentId, options);

      // Then process and store the updated document
      return await this.processAndStoreDocument(
        {
          id: documentId,
          content: newContent,
          metadata: newMetadata,
        },
        options,
      );
    } catch (error) {
      this.logger.error(
        `Error reindexing document ${documentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
