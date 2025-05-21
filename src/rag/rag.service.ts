import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  RetrievalService,
  RetrievedDocument,
  RetrievalOptions,
} from './retrieval.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { LlmService } from '../langgraph/llm/llm.service';
import { VectorIndexes } from '../pinecone/pinecone-index.service';
import { IRagService } from './interfaces/rag-service.interface';
import { IRetrievalService } from './interfaces/retrieval-service.interface';
import { RETRIEVAL_SERVICE, RAG_SERVICE } from './constants/injection-tokens';
import { EMBEDDING_SERVICE } from '../embedding/constants/injection-tokens';
import { LLM_SERVICE } from '../langgraph/llm/constants/injection-tokens';
import { PineconeService } from '../pinecone/pinecone.service';
import { PINECONE_SERVICE } from '../pinecone/constants/injection-tokens';
import { DimensionAdapterService } from '../embedding/dimension-adapter.service';
import {
  SemanticChunkingService,
  SemanticChunkingOptions,
} from '../embedding/semantic-chunking.service';
import { ConfigService } from '@nestjs/config';

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
export class RagService implements IRagService {
  private readonly logger = new Logger(RagService.name);
  private readonly useSemanticChunking: boolean;

  constructor(
    @Inject(RETRIEVAL_SERVICE)
    private readonly retrievalService: IRetrievalService,
    @Inject(EMBEDDING_SERVICE)
    private readonly embeddingService: EmbeddingService,
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    @Inject(PINECONE_SERVICE) private readonly pineconeService: PineconeService,
    private readonly dimensionAdapter: DimensionAdapterService,
    private readonly semanticChunking: SemanticChunkingService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('RAG Service initialized');
    this.useSemanticChunking =
      this.configService.get<string>('USE_SEMANTIC_CHUNKING', 'true') ===
      'true';
    this.logger.log(
      `Semantic chunking is ${this.useSemanticChunking ? 'enabled' : 'disabled'}`,
    );
  }

  /**
   * Get relevant context for a query
   */
  async getContext(
    query: string,
    options: RetrievalOptions = {},
  ): Promise<RetrievedDocument[]> {
    this.logger.log(
      `Getting context for query: "${query.substring(0, 50)}..."`,
    );
    this.logger.log(`Retrieval options: ${JSON.stringify(options)}`);

    try {
      const documents = await this.retrievalService.retrieveDocuments(
        query,
        options,
      );
      this.logger.log(`Retrieved ${documents.length} documents for context`);

      if (documents.length > 0) {
        this.logger.log(
          `First document sample: ${JSON.stringify(documents[0]?.metadata || {})}`,
        );
      } else {
        this.logger.log('No documents found for context');
      }

      return documents;
    } catch (error) {
      this.logger.error(
        `Error retrieving context: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Simple text chunking method
   * Kept for backward compatibility but uses the semantic chunking if enabled
   */
  async chunkText(
    text: string,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      useSemanticChunking?: boolean;
    } = {},
  ): Promise<string[]> {
    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided to chunkText');
      return [''];
    }

    try {
      const useSemanticForThisRequest =
        options.useSemanticChunking !== undefined
          ? options.useSemanticChunking
          : this.useSemanticChunking;

      if (useSemanticForThisRequest) {
        this.logger.log(
          `Using semantic chunking for text of length ${text.length}`,
        );

        // Use semantic chunking with appropriate options
        const semanticChunks =
          await this.semanticChunking.chunkTextSemantically(text, {
            maxChunkSize: options.chunkSize || 10,
            minChunkSize: 2,
            rebalanceChunks: true,
            addContextPrefix: true,
          });

        this.logger.log(
          `Semantic chunking completed: ${semanticChunks.length} chunks created`,
        );
        return semanticChunks;
      }

      // Fall back to original chunking method
      this.logger.log('Using traditional chunking method');
      const chunkSize = options.chunkSize || 1000;
      const chunkOverlap = options.chunkOverlap || 200;

      this.logger.log(
        `Chunking text of length ${text.length} with chunkSize=${chunkSize}, overlap=${chunkOverlap}`,
      );

      // Split text into tokens (words)
      const tokens = text.split(' ');
      const chunks: string[] = [];

      // Process chunks with overlap
      for (let i = 0; i < tokens.length; i += chunkSize - chunkOverlap) {
        const chunk = tokens.slice(i, i + chunkSize).join(' ');
        if (chunk.trim()) {
          chunks.push(chunk);
        }
      }

      this.logger.log(`Created ${chunks.length} traditional chunks`);
      return chunks.length > 0 ? chunks : [text];
    } catch (error) {
      this.logger.error(`Error in chunkText: ${error.message}`, error.stack);

      // Provide a simple fallback chunking method in case of error
      this.logger.warn('Using fallback chunking method due to error');

      const simpleChunks: string[] = [];
      const maxChunkLength = 1000;

      for (let i = 0; i < text.length; i += maxChunkLength) {
        simpleChunks.push(text.substring(i, i + maxChunkLength));
      }

      return simpleChunks.length > 0 ? simpleChunks : [text];
    }
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
      useSemanticChunking?: boolean;
      semanticOptions?: SemanticChunkingOptions;
    } = {},
  ): Promise<string[]> {
    const indexName = options.indexName || VectorIndexes.MEETING_ANALYSIS;
    const namespace = options.namespace || 'documents';
    const useSemanticForThisRequest =
      options.useSemanticChunking !== undefined
        ? options.useSemanticChunking
        : this.useSemanticChunking;

    this.logger.log(`Processing ${documents.length} documents for RAG storage`);
    this.logger.log(`Using index "${indexName}" and namespace "${namespace}"`);
    this.logger.log(
      `Semantic chunking: ${useSemanticForThisRequest ? 'enabled' : 'disabled'}`,
    );

    try {
      // Process each document
      const processedDocIds: string[] = [];
      let totalChunks = 0;
      let errorCount = 0;

      for (const doc of documents) {
        try {
          this.logger.log(
            `Processing document: ${doc.id}, content length: ${doc.content.length}`,
          );

          if (!doc.content || doc.content.trim().length === 0) {
            this.logger.warn(`Document ${doc.id} has empty content, skipping`);
            continue;
          }

          this.logger.log(
            `Document metadata: ${JSON.stringify(doc.metadata || {})}`,
          );

          let chunkedDocs;

          if (useSemanticForThisRequest) {
            // Use semantic chunking
            this.logger.log(`Using semantic chunking for document ${doc.id}`);
            chunkedDocs = await this.semanticChunking.chunkDocumentSemantically(
              doc,
              options.semanticOptions,
            );
            this.logger.log(
              `Generated ${chunkedDocs.length} semantic chunks for document ${doc.id}`,
            );
          } else {
            // Use traditional chunking
            this.logger.log(
              `Using traditional chunking for document ${doc.id}`,
            );
            const chunks = await this.chunkText(doc.content, {
              chunkSize: 1000,
              chunkOverlap: 200,
              useSemanticChunking: false, // Explicitly disable to avoid recursion
            });

            this.logger.log(
              `Generated ${chunks.length} traditional chunks for document ${doc.id}`,
            );

            // Create chunked documents with metadata
            chunkedDocs = chunks.map((chunk, idx) => ({
              id: `${doc.id}-chunk-${idx}`,
              content: chunk,
              metadata: {
                ...doc.metadata,
                document_id: doc.id,
                chunk_index: idx,
                chunk_count: chunks.length,
                chunking_method: 'traditional',
              },
            }));
          }

          if (chunkedDocs.length === 0) {
            this.logger.warn(`No chunks generated for document ${doc.id}`);
            continue;
          }

          totalChunks += chunkedDocs.length;

          // Process each chunk
          const chunkResults = await Promise.allSettled(
            chunkedDocs.map(async (chunkedDoc) => {
              const chunkId = chunkedDoc.id;
              this.logger.log(`Generating embedding for chunk ${chunkId}`);

              try {
                // Generate embedding
                const originalEmbedding =
                  await this.embeddingService.generateEmbedding(
                    chunkedDoc.content,
                  );
                this.logger.log(
                  `Generated embedding of length ${originalEmbedding.length} for chunk ${chunkId}`,
                );

                // Check if dimension adaptation is needed
                let embeddingToStore = originalEmbedding;
                const targetDimension =
                  this.dimensionAdapter.getTargetDimension();

                if (
                  this.dimensionAdapter.needsAdaptation(
                    originalEmbedding.length,
                  )
                ) {
                  this.logger.log(
                    `Adapting embedding dimension from ${originalEmbedding.length} to ${targetDimension}`,
                  );
                  embeddingToStore =
                    this.dimensionAdapter.adaptDimension(originalEmbedding);
                  this.logger.log(
                    `Adapted embedding has length ${embeddingToStore.length}`,
                  );
                }

                // Store in Pinecone
                this.logger.log(
                  `Storing vector in Pinecone for chunk ${chunkId}`,
                );
                this.logger.log(
                  `Vector dimensions: ${embeddingToStore.length}, target dimensions: ${targetDimension}`,
                );

                await this.storeVectorInPinecone(
                  indexName,
                  chunkId,
                  embeddingToStore,
                  chunkedDoc.metadata,
                  namespace,
                );

                this.logger.log(
                  `Successfully stored vector for chunk ${chunkId}`,
                );
                return chunkId;
              } catch (chunkError) {
                this.logger.error(
                  `Error processing chunk ${chunkId} of document ${doc.id}: ${chunkError.message}`,
                  chunkError.stack,
                );
                throw chunkError;
              }
            }),
          );

          // Count successes and failures
          const successfulChunks = chunkResults.filter(
            (result) => result.status === 'fulfilled',
          ).length;
          const failedChunks = chunkResults.filter(
            (result) => result.status === 'rejected',
          ).length;

          this.logger.log(
            `Chunk processing results for document ${doc.id}: ${successfulChunks} successful, ${failedChunks} failed`,
          );

          if (failedChunks > 0) {
            errorCount += failedChunks;
            this.logger.warn(
              `Some chunks failed processing for document ${doc.id}: ${failedChunks}/${chunkedDocs.length} chunks`,
            );
          } else {
            this.logger.log(
              `Successfully processed all chunks for document ${doc.id}`,
            );
          }

          processedDocIds.push(doc.id);
        } catch (docError) {
          this.logger.error(
            `Error processing document ${doc.id}: ${docError.message}`,
            docError.stack,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `Completed processing documents for RAG: ${processedDocIds.join(', ')}`,
      );
      this.logger.log(
        `Processing summary: ${processedDocIds.length} documents, ${totalChunks} total chunks, ${errorCount} errors`,
      );

      return processedDocIds;
    } catch (error) {
      this.logger.error(
        `Error processing documents for RAG: ${error.message}`,
        error.stack,
      );
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
  ): Promise<T & { retrievedContext: RetrievedContext }> {
    if (!query || query.trim().length === 0) {
      this.logger.warn('Empty query provided to enhanceStateWithContext');
      return {
        ...state,
        retrievedContext: {
          query: '',
          documents: [],
          timestamp: new Date().toISOString(),
        },
      };
    }

    this.logger.log(
      `Enhancing state with RAG context for query: "${query.substring(0, 50)}..."`,
    );

    try {
      // Retrieve context
      this.logger.log(
        `Retrieving documents with options: ${JSON.stringify(options)}`,
      );
      const documents = await this.retrievalService.retrieveDocuments(
        query,
        options,
      );

      if (documents.length === 0) {
        this.logger.log(
          `No relevant context found for query: ${query.substring(0, 30)}...`,
        );
        // Create empty context if no documents found
        return {
          ...state,
          retrievedContext: {
            query,
            documents: [],
            timestamp: new Date().toISOString(),
          },
        };
      }

      this.logger.log(
        `Retrieved ${documents.length} documents for context enhancement`,
      );

      if (documents.length > 0) {
        const sources = documents
          .map((d) => d.metadata?.source || 'unknown')
          .join(', ');
        this.logger.log(`Document sources: ${sources}`);
      }

      // Add retrieved context to state
      const retrievedContext: RetrievedContext = {
        query,
        documents,
        timestamp: new Date().toISOString(),
      };

      // Create a new state with the retrieved context
      this.logger.log(
        `Enhancing state with ${documents.length} context documents`,
      );
      return {
        ...state,
        retrievedContext,
      };
    } catch (error) {
      this.logger.error(
        `Error enhancing state with context: ${error.message}`,
        error.stack,
      );
      // Return state with empty context on error
      return {
        ...state,
        retrievedContext: {
          query,
          documents: [],
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Create a RAG node for LangGraph
   */
  createRagRetrievalNode<T extends Record<string, any>>(
    queryExtractor: (state: T) => string,
    options: RetrievalOptions = {},
  ): (state: T) => Promise<Partial<T>> {
    this.logger.log('Creating RAG retrieval node for LangGraph');
    this.logger.log(`Retrieval options: ${JSON.stringify(options)}`);

    return async (state: T): Promise<Partial<T>> => {
      try {
        if (!state) {
          this.logger.warn('Invalid state provided to RAG retrieval node');
          return {};
        }

        // Extract query from state
        const query = queryExtractor(state);

        if (!query) {
          this.logger.warn('No query extracted from state in RAG node');
          return {};
        }

        this.logger.log(
          `RAG node executing with query: "${query?.substring(0, 30)}..."`,
        );
        this.logger.log(`State keys: ${Object.keys(state).join(', ')}`);

        // Retrieve context
        this.logger.log(
          `Retrieving documents for query: "${query.substring(0, 30)}..."`,
        );
        const documents = await this.retrievalService.retrieveDocuments(
          query,
          options,
        );

        this.logger.log(`RAG node retrieved ${documents.length} documents`);

        // Create retrieved context
        const retrievedContext: RetrievedContext = {
          query,
          documents,
          timestamp: new Date().toISOString(),
        };

        this.logger.log(
          `RAG node returning context with ${documents.length} documents`,
        );
        // The type assertion is necessary here because we can't statically ensure
        // that retrievedContext is a valid key of T
        return { retrievedContext } as unknown as Partial<T>;
      } catch (error) {
        this.logger.error(
          `Error in RAG retrieval node: ${error.message}`,
          error.stack,
        );
        return {};
      }
    };
  }

  /**
   * Add RAG capabilities to a LangGraph flow
   */
  addRagToGraph(graph: any, options: RetrievalOptions = {}): void {
    if (!graph) {
      this.logger.error('Invalid graph provided to addRagToGraph');
      return;
    }

    this.logger.log('Adding RAG node to graph flow');

    try {
      // Add RAG node
      graph.addNode(
        'rag_retrieval',
        this.createRagRetrievalNode((state) => {
          // Default query extractor uses transcript
          const query = state.transcript || '';
          this.logger.log(
            `Extracted query from transcript: "${query.substring(0, 30)}..."`,
          );
          return query;
        }, options),
      );

      this.logger.log('Modifying graph edges to include RAG node');

      // Modify graph edges - should be called after initial graph setup
      // but before compilation
      graph.addEdge('rag_retrieval', 'topic_extraction');

      // Move the start edge to point to RAG retrieval
      // This requires replacing the existing START -> topic_extraction edge
      const edges = graph['edges'];
      const startEdges = edges.filter((e) => e.source === '__start__');

      for (const edge of startEdges) {
        if (edge.target === 'topic_extraction') {
          // Remove the original edge
          graph['edges'] = edges.filter((e) => e !== edge);

          // Add the new edge
          graph.addEdge('__start__', 'rag_retrieval');
          this.logger.log(
            'Updated graph flow: __start__ -> rag_retrieval -> topic_extraction',
          );
          break;
        }
      }

      this.logger.log('Successfully added RAG capabilities to graph');
    } catch (error) {
      this.logger.error(
        `Error adding RAG to graph: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Helper method to store a vector in Pinecone
   */
  private async storeVectorInPinecone(
    indexName: string,
    id: string,
    vector: number[],
    metadata: Record<string, any>,
    namespace?: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Storing vector in Pinecone: index=${indexName}, id=${id}, namespace=${namespace || 'default'}`,
      );

      if (!vector || vector.length === 0) {
        throw new Error('Invalid vector provided to storeVectorInPinecone');
      }

      // Sanitize metadata to ensure it doesn't contain any non-JSON-serializable values
      const sanitizedMetadata = this.sanitizeMetadata(metadata || {});

      // Use directly injected pineconeService instead of trying to access it through embeddingService
      await this.pineconeService.storeVector(
        indexName,
        id,
        vector,
        sanitizedMetadata,
        namespace,
      );
      this.logger.log(`Successfully stored vector ${id} in Pinecone`);
    } catch (error) {
      this.logger.error(
        `Error storing vector in Pinecone: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Helper to sanitize metadata for Pinecone storage
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Skip null or undefined values
      if (value === null || value === undefined) {
        continue;
      }

      // Handle different value types
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        result[key] = value;
      } else if (Array.isArray(value)) {
        // For arrays, only include if they contain primitive values
        const sanitizedArray = value.filter(
          (item) =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean',
        );
        if (sanitizedArray.length > 0) {
          result[key] = sanitizedArray;
        }
      } else if (typeof value === 'object') {
        // For objects, convert to JSON string
        try {
          result[key] = JSON.stringify(value);
        } catch (err) {
          this.logger.warn(
            `Could not stringify metadata field ${key}, skipping`,
          );
        }
      }
    }

    return result;
  }
}
