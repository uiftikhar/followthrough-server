import { RetrievalOptions } from '../retrieval.service';

export interface IAdaptiveRagService {
  determineRetrievalStrategy(query: string): Promise<{
    strategy: 'semantic' | 'keyword' | 'hybrid' | 'none';
    settings: Partial<RetrievalOptions>;
  }>;

  createAdaptiveRagNode<T extends Record<string, any>>(
    queryExtractor: (state: T) => string,
    baseOptions?: RetrievalOptions,
  ): (state: T) => Promise<Partial<T>>;

  addAdaptiveRagToGraph(graph: any, options?: RetrievalOptions): void;
}
