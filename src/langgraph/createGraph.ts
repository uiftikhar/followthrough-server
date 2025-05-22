import { Logger } from '@nestjs/common';

/**
 * Custom graph implementation that supports conditional edges
 */
export class CustomGraph {
  private readonly logger = new Logger('CustomGraph');
  private nodes: Record<string, Function> = {};
  private edges: Array<{
    source: string;
    target?: string;
    condition?: (state: any) => string;
    isConditional: boolean;
  }> = [];
  private stateTransitionHandlers: Array<(prevState: any, newState: any, nodeName: string) => Promise<any>> = [];

  /**
   * Add a node to the graph
   */
  addNode(name: string, fn: Function): CustomGraph {
    this.nodes[name] = fn;
    return this;
  }

  /**
   * Add a direct edge between nodes
   */
  addEdge(from: string, to: string): CustomGraph {
    this.edges.push({
      source: from,
      target: to,
      isConditional: false,
    });
    return this;
  }

  /**
   * Add a conditional edge that determines the next node based on state
   */
  addConditionalEdge(from: string, conditionFn: (state: any) => string): CustomGraph {
    this.edges.push({
      source: from,
      condition: conditionFn,
      isConditional: true,
    });
    return this;
  }

  /**
   * Add a handler that will be called on every state transition
   */
  addStateTransitionHandler(handler: (prevState: any, newState: any, nodeName: string) => Promise<any>): CustomGraph {
    this.stateTransitionHandlers.push(handler);
    return this;
  }

  /**
   * Compile the graph (not needed in this implementation but kept for compatibility)
   */
  compile(): CustomGraph {
    return this;
  }

  /**
   * Execute the graph with the given initial state
   */
  async execute(initialState: any): Promise<any> {
    this.logger.log('CustomGraph: Starting graph execution');
    let currentState = { ...initialState };
    let currentNode = '__start__';
    
    // Keep track of visited nodes to prevent infinite loops
    const visitedPaths = new Set<string>();
    const visitedNodes = new Set<string>();
    
    // Execute the graph until we reach the end node or hit an error
    while (currentNode !== '__end__') {
      this.logger.log(`CustomGraph: Processing node: ${currentNode}`);
      
      // Skip processing for START node
      if (currentNode !== '__start__') {
        // Execute the current node
        const nodeFn = this.nodes[currentNode];
        if (nodeFn) {
          try {
            this.logger.log(`CustomGraph: Executing node: ${currentNode}`);
            const prevState = { ...currentState };
            currentState = await nodeFn(currentState);
            
            // Call state transition handlers
            for (const handler of this.stateTransitionHandlers) {
              currentState = await handler(prevState, currentState, currentNode);
            }
          } catch (error) {
            this.logger.error(`CustomGraph: Error executing node ${currentNode}: ${error.message}`);
            this.logger.error(`CustomGraph: Error stack: ${error.stack}`);
            // Add error to state
            currentState.errors = currentState.errors || [];
            currentState.errors.push({
              step: currentNode,
              error: error.message,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          this.logger.error(`CustomGraph: Node function not found for ${currentNode}`);
        }
      }
      
      // Mark this node as visited
      visitedNodes.add(currentNode);
      
      // Find the next node based on edges
      const nextNodeInfo = this.findNextNode(currentNode, currentState);
      
      if (!nextNodeInfo) {
        this.logger.error(`CustomGraph: No edge found from node ${currentNode}`);
        break;
      }
      
      this.logger.log(`CustomGraph: Next node will be: ${nextNodeInfo.target}`);
      
      // Create a path identifier to detect loops
      const pathId = `${currentNode}->${nextNodeInfo.target}`;
      
      // Prevent infinite loops
      if (visitedPaths.has(pathId) && visitedNodes.has(nextNodeInfo.target)) {
        this.logger.warn(`CustomGraph: Loop detected in graph execution at path ${pathId}`);
        break;
      }
      visitedPaths.add(pathId);
      
      // Update current node
      currentNode = nextNodeInfo.target;
    }
    
    this.logger.log('CustomGraph: Graph execution completed');
    return currentState;
  }

  /**
   * Find the next node based on the current node and state
   */
  private findNextNode(currentNode: string, state: any): { target: string } | null {
    // Find all edges from the current node
    const relevantEdges = this.edges.filter(edge => edge.source === currentNode);
    
    if (relevantEdges.length === 0) {
      return null;
    }
    
    // Handle conditional edges
    for (const edge of relevantEdges) {
      if (edge.isConditional && edge.condition) {
        // Get the target from the condition function
        const target = edge.condition(state);
        if (target) {
          this.logger.log(`Conditional routing from ${currentNode} to ${target}`);
          return { target };
        }
      } else if (!edge.isConditional && edge.target) {
        // Direct edge
        return { target: edge.target };
      }
    }
    
    // Add fallback to log and return empty result for debugging
    this.logger.error(`Failed to find next node for ${currentNode}. State keys: ${Object.keys(state).join(', ')}`);
    if (state.routing) {
      this.logger.error(`Routing info: ${JSON.stringify(state.routing)}`);
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