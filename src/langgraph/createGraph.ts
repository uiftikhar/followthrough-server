import { Logger } from '@nestjs/common';

/**
 * Implementation of a simple custom graph
 */
export class CustomGraph {
  private readonly logger = new Logger('CustomGraph');
  nodes: Record<string, Function> = {};
  edges: Array<{
    source: string;
    target: string;
    isConditional?: boolean;
    condition?: Function;
  }> = [];
  stateTransitionHandlers: Array<Function> = [];
  
  /**
   * Add a node to the graph
   * @param name Name of the node
   * @param handler Handler function for the node
   */
  addNode(name: string, handler: Function): void {
    this.nodes[name] = handler;
  }
  
  /**
   * Add an edge between two nodes
   * @param source Source node name
   * @param target Target node name
   * @param condition Optional condition function
   */
  addEdge(source: string, target: string, condition?: Function): void {
    this.edges.push({
      source,
      target,
      isConditional: !!condition,
      condition,
    });
  }
  
  /**
   * Add a state transition handler
   * @param handler Handler function
   */
  addStateTransitionHandler(handler: Function): void {
    this.stateTransitionHandlers.push(handler);
  }
  
  /**
   * Execute the graph with the given initial state
   * @param initialState Initial state
   * @returns Final state
   */
  async execute(initialState: any): Promise<any> {
    let currentState = { ...initialState };
    let currentNode = '__start__';
    
    // Keep track of visited nodes to prevent infinite loops
    const visitedPaths = new Set<string>();
    
    // Execute the graph until we reach the END node or hit an error
    while (currentNode !== '__end__') {
      this.logger.debug(`Processing node: ${currentNode}`);
      
      // Create a path signature to detect loops
      const pathSignature = `${currentNode}`;
      
      // Check for infinite loops
      if (visitedPaths.has(pathSignature)) {
        throw new Error(`Infinite loop detected at node ${currentNode}`);
      }
      
      visitedPaths.add(pathSignature);
      
      // Get the next node
      const nextNodeInfo = this.findNextNode(currentNode, currentState);
      
      if (!nextNodeInfo) {
        throw new Error(`No edge found from node ${currentNode}`);
      }
      
      // Update current node
      currentNode = nextNodeInfo.target;
      
      // Skip execution for START node
      if (currentNode === '__start__') {
        continue;
      }
      
      // Skip execution for END node
      if (currentNode === '__end__') {
        break;
      }
      
      // Execute the current node
      const nodeFn = this.nodes[currentNode];
      if (!nodeFn) {
        throw new Error(`Node ${currentNode} not found in graph`);
      }
      
      try {
        this.logger.debug(`Executing node: ${currentNode}`);
        const prevState = { ...currentState };
        currentState = await nodeFn(currentState);
        
        // Run state transition handlers
        for (const handler of this.stateTransitionHandlers) {
          currentState = await handler(prevState, currentState, currentNode);
        }
      } catch (error) {
        this.logger.error(`Error executing node ${currentNode}: ${error.message}`);
        throw error;
      }
    }
    
    return currentState;
  }
  
  /**
   * Find the next node in the graph
   * @param currentNode Current node name
   * @param state Current state
   * @returns Next node information
   */
  findNextNode(currentNode: string, state: any): { target: string } | null {
    const edges = this.edges.filter(edge => edge.source === currentNode);
    
    if (!edges || edges.length === 0) {
      return null;
    }
    
    // Handle conditional edges
    for (const edge of edges) {
      if (edge.isConditional && edge.condition) {
        const target = edge.condition(state);
        if (target) {
          return { target };
        }
      } else {
        return { target: edge.target };
      }
    }
    
    return null;
  }
}

/**
 * Create a new graph instance
 */
export function createGraph(): CustomGraph {
  return new CustomGraph();
} 