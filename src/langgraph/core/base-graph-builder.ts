import { Logger } from "@nestjs/common";
import { CustomGraph } from "../createGraph";

/**
 * Abstract base class for building agent graphs
 * @template TState The type of state used in the graph
 */
export abstract class BaseGraphBuilder<TState = any> {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Node names for the graph
   * These are the default node names that all graphs should have
   */
  protected readonly baseNodeNames = {
    START: "__start__",
    END: "__end__",
  };

  /**
   * Create a new graph
   */
  protected createGraph(): any {
    this.logger.debug("Creating a new agent graph");
    return new CustomGraph();
  }

  /**
   * Build all node functions for this graph
   * @returns Record of node names to handler functions
   */
  protected abstract buildNodes(): Record<string, Function>;

  /**
   * Define graph edges
   * @param graph The graph to define edges on
   */
  protected abstract defineEdges(graph: any): void;

  /**
   * Add all nodes to the graph
   * @param graph The graph to add nodes to
   * @param nodes Record of node names to handler functions
   */
  protected addNodesToGraph(graph: any, nodes: Record<string, Function>): void {
    for (const [nodeName, nodeHandler] of Object.entries(nodes)) {
      this.logger.debug(`Adding node ${nodeName} to graph`);
      graph.addNode(nodeName, nodeHandler);
    }
  }

  /**
   * Build and return a complete graph for execution
   * @returns Promise resolving to the built graph
   */
  public async buildGraph(): Promise<any> {
    this.logger.log("Building agent graph");

    // Create a new graph
    const graph = this.createGraph();

    // Build nodes and add them to the graph
    const nodes = this.buildNodes();
    this.addNodesToGraph(graph, nodes);

    // Define edges between nodes
    this.defineEdges(graph);

    this.logger.log("Agent graph built successfully");
    return graph;
  }
}
