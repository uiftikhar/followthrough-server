import { RetrievedDocument, RetrievalOptions } from '../retrieval.service';
import { RetrievedContext, RagOptions } from '../rag.service';
import { VectorIndexes } from '../../pinecone/pinecone-index.service';
import { SemanticChunkingOptions } from '../../embedding/semantic-chunking.service';

export interface IRagService {
  getContext(
    query: string,
    options?: RetrievalOptions,
  ): Promise<RetrievedDocument[]>;

  chunkText(
    text: string,
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      useSemanticChunking?: boolean;
    },
  ): Promise<string[]>;

  processDocumentsForRag(
    documents: Array<{
      id: string;
      content: string;
      metadata?: Record<string, any>;
    }>,
    options?: {
      indexName?: VectorIndexes | string;
      namespace?: string;
      useSemanticChunking?: boolean;
      semanticOptions?: SemanticChunkingOptions;
    },
  ): Promise<string[]>;

  enhanceStateWithContext<T extends Record<string, any>>(
    state: T,
    query: string,
    options?: RetrievalOptions,
  ): Promise<T & { retrievedContext: RetrievedContext }>;

  createRagRetrievalNode<T extends Record<string, any>>(
    queryExtractor: (state: T) => string,
    options?: RetrievalOptions,
  ): (state: T) => Promise<Partial<T>>;

  addRagToGraph(graph: any, options?: RetrievalOptions): void;
}
