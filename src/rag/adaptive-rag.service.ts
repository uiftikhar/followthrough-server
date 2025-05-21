import { Injectable, Logger, Inject } from '@nestjs/common';
import { RagService } from './rag.service';
import { RetrievalService } from './retrieval.service';
import { LlmService } from '../langgraph/llm/llm.service';
import { RetrievalOptions } from './retrieval.service';
import { IAdaptiveRagService } from './interfaces/adaptive-rag.interface';
import { IRagService } from './interfaces/rag-service.interface';
import { IRetrievalService } from './interfaces/retrieval-service.interface';
import {
  RAG_SERVICE,
  RETRIEVAL_SERVICE,
  ADAPTIVE_RAG_SERVICE,
} from './constants/injection-tokens';
import { LLM_SERVICE } from '../langgraph/llm/constants/injection-tokens';

@Injectable()
export class AdaptiveRagService implements IAdaptiveRagService {
  private readonly logger = new Logger(AdaptiveRagService.name);

  constructor(
    @Inject(RAG_SERVICE) private readonly ragService: IRagService,
    @Inject(RETRIEVAL_SERVICE)
    private readonly retrievalService: IRetrievalService,
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
  ) {}

  /**
   * Determine the best retrieval strategy for a query
   */
  async determineRetrievalStrategy(query: string): Promise<{
    strategy: 'semantic' | 'keyword' | 'hybrid' | 'none';
    settings: Partial<RetrievalOptions>;
  }> {
    try {
      const model = this.llmService.getChatModel();

      const response = await model.invoke([
        {
          role: 'system',
          content: `
            You are a retrieval strategy selector. Analyze the query and determine the best retrieval approach:
            - 'semantic': For conceptual, abstract, or complex queries requiring understanding of meaning
            - 'keyword': For specific fact lookups, names, or direct references 
            - 'hybrid': For queries that benefit from both approaches
            - 'none': For queries that don't need external context
            
            Also suggest retrieval parameters (topK, minScore).
            
            Output JSON only with keys: strategy, topK, minScore.
          `,
        },
        {
          role: 'user',
          content: `Analyze this query: "${query}"`,
        },
      ]);

      // Parse the response
      try {
        const content = response.content.toString();
        const jsonMatch =
          content.match(/```json\n([\s\S]*?)\n```/) ||
          content.match(/```\n([\s\S]*?)\n```/) ||
          content.match(/(\{[\s\S]*\})/);

        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        const result = JSON.parse(jsonStr);

        return {
          strategy: result.strategy,
          settings: {
            topK: result.topK || 5,
            minScore: result.minScore || 0.7,
          },
        };
      } catch (error) {
        // Default if parsing fails
        return {
          strategy: 'hybrid',
          settings: { topK: 5, minScore: 0.7 },
        };
      }
    } catch (error) {
      this.logger.error(
        `Error determining retrieval strategy: ${error.message}`,
      );
      return {
        strategy: 'semantic',
        settings: {},
      };
    }
  }

  /**
   * Create an adaptive RAG node for LangGraph
   */
  createAdaptiveRagNode<T extends Record<string, any>>(
    queryExtractor: (state: T) => string,
    baseOptions: RetrievalOptions = {},
  ): (state: T) => Promise<Partial<T>> {
    return async (state: T): Promise<Partial<T>> => {
      try {
        // Extract query from state
        const query = queryExtractor(state);

        if (!query) {
          this.logger.warn('No query extracted from state');
          return {};
        }

        // Determine retrieval strategy
        const { strategy, settings } =
          await this.determineRetrievalStrategy(query);

        // Merge settings with base options
        const options: RetrievalOptions = {
          ...baseOptions,
          ...settings,
        };

        // Retrieve based on strategy
        let documents;
        switch (strategy) {
          case 'semantic':
            documents = await this.retrievalService.retrieveDocuments(
              query,
              options,
            );
            break;
          case 'keyword':
            documents = await this.retrievalService['keywordSearch'](
              query,
              options,
            );
            break;
          case 'hybrid':
            documents = await this.retrievalService.hybridSearch(
              query,
              options,
            );
            break;
          case 'none':
            documents = [];
            break;
          default:
            documents = await this.retrievalService.retrieveDocuments(
              query,
              options,
            );
        }

        // Create retrieved context
        const retrievedContext = {
          query,
          documents,
          strategy,
          timestamp: new Date().toISOString(),
        };

        return { retrievedContext } as unknown as Partial<T>;
      } catch (error) {
        this.logger.error(`Error in adaptive RAG node: ${error.message}`);
        return {};
      }
    };
  }

  /**
   * Add adaptive RAG to a LangGraph
   */
  addAdaptiveRagToGraph(graph: any, options: RetrievalOptions = {}): void {
    // Add adaptive RAG node
    graph.addNode(
      'adaptive_rag',
      this.createAdaptiveRagNode((state) => state.transcript || '', options),
    );

    // Modify graph edges
    graph.addEdge('adaptive_rag', 'topic_extraction');

    // Replace start edge
    const edges = graph['edges'];
    const startEdges = edges.filter((e) => e.source === '__start__');

    for (const edge of startEdges) {
      if (edge.target === 'topic_extraction') {
        graph['edges'] = edges.filter((e) => e !== edge);
        graph.addEdge('__start__', 'adaptive_rag');
        break;
      }
    }
  }
}
