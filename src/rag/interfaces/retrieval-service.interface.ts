import { RetrievalOptions, RetrievedDocument } from '../retrieval.service';

export interface IRetrievalService {
  retrieveDocuments(
    query: string,
    options?: RetrievalOptions,
  ): Promise<RetrievedDocument[]>;

  hybridSearch(
    query: string,
    options?: RetrievalOptions & {
      keywordWeight?: number;
      vectorWeight?: number;
    },
  ): Promise<RetrievedDocument[]>;
}
