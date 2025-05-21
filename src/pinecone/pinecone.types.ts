import { RecordMetadata } from '@pinecone-database/pinecone';

export interface VectorRecord<T extends RecordMetadata = RecordMetadata> {
  id: string;
  values: number[];
  metadata?: T;
}

export type PineconeFilter = Record<string, any>;

export interface QueryOptions {
  topK?: number;
  filter?: PineconeFilter;
  includeMetadata?: boolean;
  includeValues?: boolean;
}

export interface UpsertOptions {
  batchSize?: number;
  concurrency?: number;
}

export interface IndexStats {
  namespaces: Record<
    string,
    {
      vectorCount: number;
    }
  >;
  dimension: number;
  indexFullness: number;
  totalVectorCount: number;
}
