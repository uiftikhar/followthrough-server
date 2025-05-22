import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { StateService } from '../state/state.service';
import { AgentFactory } from '../agents/agent.factory';
import { Topic } from '../agents/topic-extraction.agent';
import { ActionItem } from '../agents/action-item.agent';
import { SentimentAnalysis } from '../agents/sentiment-analysis.agent';
import { MeetingSummary } from '../agents/summary.agent';
import { ConfigService } from '@nestjs/config';
import { CustomGraph } from '../createGraph';
import { AnalysisDelegationService } from '../meeting-analysis/analysis-delegation.service';

/**
 * Result interface for meeting analysis
 */
interface MeetingAnalysisResult {
  transcript: string;
  topics: Topic[];
  actionItems: ActionItem[];
  sentiment: SentimentAnalysis | null;
  summary: MeetingSummary | null;
  errors: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;
  currentPhase: string;
}

// LangGraph constants
const START = '__start__';
const END = '__end__';

/**
 * Service for building and executing LangGraph workflows
 */
@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  // Node names for graph execution
  private readonly nodeNames = {
    START: '__start__',
    INITIALIZATION: 'initialization',
    CONTEXT_RETRIEVAL: 'context_retrieval',
    TOPIC_EXTRACTION: 'topic_extraction',
    ACTION_ITEM_EXTRACTION: 'action_item_extraction',
    SENTIMENT_ANALYSIS: 'sentiment_analysis',
    SUMMARY_GENERATION: 'summary_generation',
    SUPERVISION: 'supervision',
    POST_PROCESSING: 'post_processing',
    END: '__end__',
  };

  // Node names for master supervisor graph
  private readonly masterNodeNames = {
    START: '__start__',
    SUPERVISOR: 'supervisor',
    MEETING_ANALYSIS_TEAM: 'meeting_analysis_team',
    EMAIL_TRIAGE_TEAM: 'email_triage_team',
    END: '__end__',
  };

  constructor(
    private readonly stateService: StateService,
    private readonly agentFactory: AgentFactory,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AnalysisDelegationService))
    private readonly analysisDelegationService: AnalysisDelegationService,
  ) {
    this.logger.log('GraphService initialized');
  }

  /**
   * Create a graph for execution
   */
  createGraph(): any {
    this.logger.log('Creating a new agent graph');
    
    // Use the CustomGraph implementation
    return new CustomGraph();
  }
  
  /**
   * Execute a graph with the given initial state
   */
  async executeGraph(graph: any, initialState: any): Promise<any> {
    this.logger.log('Executing agent graph');
    
    // Check if the graph is a CustomGraph
    if (graph.execute && typeof graph.execute === 'function') {
      this.logger.log('Using CustomGraph execute method');
      return await graph.execute(initialState);
    }
    
    // Original implementation for backward compatibility
    let currentState = { ...initialState };
    let currentNode = this.nodeNames.START;
    
    // Keep track of visited nodes to prevent infinite loops
    const visitedNodes = new Set<string>();
    
    // Execute the graph until we reach the END node or hit an error
    while (currentNode !== this.nodeNames.END) {
      // Prevent infinite loops
      if (visitedNodes.has(currentNode)) {
        this.logger.warn(`Loop detected in graph execution at node ${currentNode}`);
        break;
      }
      visitedNodes.add(currentNode);
      
      // Find the next node based on edges
      const nextNodeInfo = graph.edges.find((edge: any) => edge.source === currentNode);
      
      if (!nextNodeInfo) {
        this.logger.error(`No edge found from node ${currentNode}`);
        break;
      }
      
      // Determine the next node
      let nextNode: string;
      if (nextNodeInfo.isConditional) {
        // Call the condition function to get the next node
        nextNode = nextNodeInfo.targetFn(currentState);
      } else {
        nextNode = nextNodeInfo.target;
      }
      
      // Skip processing for START node
      if (currentNode !== this.nodeNames.START) {
        // Execute the current node
        const nodeFn = graph.nodes[currentNode];
        if (nodeFn) {
          try {
            this.logger.log(`Executing node: ${currentNode}`);
            const prevState = { ...currentState };
            currentState = await nodeFn(currentState);
            
            // Call state transition handler if defined
            if (graph.stateTransitionHandler) {
              currentState = await graph.stateTransitionHandler(prevState, currentState, currentNode);
            }
          } catch (error) {
            this.logger.error(`Error executing node ${currentNode}: ${error.message}`);
            // Add error to state
            currentState.errors = currentState.errors || [];
            currentState.errors.push({
              step: currentNode,
              error: error.message,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      // Update current node
      currentNode = nextNode;
    }
    
    return currentState;
  }

  /**
   * Build a standard meeting analysis graph with agent nodes
   */
  async buildMeetingAnalysisGraph(): Promise<any> {
    this.logger.log('Building standard meeting analysis graph');
    
    // Create agent wrappers using shared method
    const agentNodes = await this.createAgentNodes();
    
    // Create a new graph
    const graph = this.createGraph();
    
    // Add nodes to the graph
    graph.addNode(this.nodeNames.INITIALIZATION, agentNodes.initialization);
    graph.addNode(this.nodeNames.TOPIC_EXTRACTION, agentNodes.topicExtraction);
    graph.addNode(this.nodeNames.ACTION_ITEM_EXTRACTION, agentNodes.actionItemExtraction);
    graph.addNode(this.nodeNames.SENTIMENT_ANALYSIS, agentNodes.sentimentAnalysis);
    graph.addNode(this.nodeNames.SUMMARY_GENERATION, agentNodes.summaryGeneration);
    graph.addNode(this.nodeNames.SUPERVISION, agentNodes.supervision);
    graph.addNode(this.nodeNames.POST_PROCESSING, agentNodes.postProcessing);
    
    // Create standard edges for the graph
    graph.addEdge(this.nodeNames.START, this.nodeNames.INITIALIZATION);
    graph.addEdge(this.nodeNames.INITIALIZATION, this.nodeNames.TOPIC_EXTRACTION);
    graph.addEdge(this.nodeNames.TOPIC_EXTRACTION, this.nodeNames.ACTION_ITEM_EXTRACTION);
    graph.addEdge(this.nodeNames.ACTION_ITEM_EXTRACTION, this.nodeNames.SENTIMENT_ANALYSIS);
    graph.addEdge(this.nodeNames.SENTIMENT_ANALYSIS, this.nodeNames.SUMMARY_GENERATION);
    graph.addEdge(this.nodeNames.SUMMARY_GENERATION, this.nodeNames.SUPERVISION);
    graph.addEdge(this.nodeNames.SUPERVISION, this.nodeNames.POST_PROCESSING);
    graph.addEdge(this.nodeNames.POST_PROCESSING, this.nodeNames.END);
    
    // Add conditional edge from SUPERVISION for rework
    graph.addConditionalEdge(
      this.nodeNames.SUPERVISION,
      (state: any) => {
        // If supervisor requests topic rework
        if (state.rework?.includes('topic')) return this.nodeNames.TOPIC_EXTRACTION;
        // If supervisor requests action item rework
        if (state.rework?.includes('action')) return this.nodeNames.ACTION_ITEM_EXTRACTION;
        // If supervisor requests summary rework
        if (state.rework?.includes('summary')) return this.nodeNames.SUMMARY_GENERATION;
        // Default to post-processing if no rework needed
        return this.nodeNames.POST_PROCESSING;
      }
    );
    
    this.logger.log(`Built meeting analysis graph with ${Object.keys(graph.nodes).length} nodes`);
    return graph;
  }
  
  /**
   * Build a RAG-enhanced meeting analysis graph with agent nodes
   */
  async buildRagMeetingAnalysisGraph(): Promise<any> {
    this.logger.log('Building RAG-enhanced meeting analysis graph');
    
    // Create agent wrappers using shared method
    const agentNodes = await this.createAgentNodes();
    
    // Create a new graph
    const graph = this.createGraph();
    
    // Create a context retrieval node
    const contextRetrievalNode = async (state: any) => {
      this.logger.log('Retrieving context for RAG enhancement');
      // This would typically use a retrieval service to fetch relevant contexts
      return { 
        ...state, 
        retrievedContext: { 
          documents: [],
          query: state.transcript?.substring(0, 200) || '',
          timestamp: new Date().toISOString()
        } 
      };
    };
    
    // Add nodes to the graph
    graph.addNode(this.nodeNames.INITIALIZATION, agentNodes.initialization);
    graph.addNode(this.nodeNames.CONTEXT_RETRIEVAL, contextRetrievalNode);
    graph.addNode(this.nodeNames.TOPIC_EXTRACTION, agentNodes.topicExtraction);
    graph.addNode(this.nodeNames.ACTION_ITEM_EXTRACTION, agentNodes.actionItemExtraction);
    graph.addNode(this.nodeNames.SENTIMENT_ANALYSIS, agentNodes.sentimentAnalysis);
    graph.addNode(this.nodeNames.SUMMARY_GENERATION, agentNodes.summaryGeneration);
    graph.addNode(this.nodeNames.SUPERVISION, agentNodes.supervision);
    graph.addNode(this.nodeNames.POST_PROCESSING, agentNodes.postProcessing);
    
    // Create RAG-specific edges for the graph
    graph.addEdge(this.nodeNames.START, this.nodeNames.INITIALIZATION);
    graph.addEdge(this.nodeNames.INITIALIZATION, this.nodeNames.CONTEXT_RETRIEVAL);
    graph.addEdge(this.nodeNames.CONTEXT_RETRIEVAL, this.nodeNames.TOPIC_EXTRACTION);
    graph.addEdge(this.nodeNames.TOPIC_EXTRACTION, this.nodeNames.ACTION_ITEM_EXTRACTION);
    graph.addEdge(this.nodeNames.ACTION_ITEM_EXTRACTION, this.nodeNames.SENTIMENT_ANALYSIS);
    graph.addEdge(this.nodeNames.SENTIMENT_ANALYSIS, this.nodeNames.SUMMARY_GENERATION);
    graph.addEdge(this.nodeNames.SUMMARY_GENERATION, this.nodeNames.SUPERVISION);
    graph.addEdge(this.nodeNames.SUPERVISION, this.nodeNames.POST_PROCESSING);
    graph.addEdge(this.nodeNames.POST_PROCESSING, this.nodeNames.END);
    
    // Add conditional edge from SUPERVISION for rework
    graph.addConditionalEdge(
      this.nodeNames.SUPERVISION,
      (state: any) => {
        // If supervisor requests topic rework
        if (state.rework?.includes('topic')) return this.nodeNames.TOPIC_EXTRACTION;
        // If supervisor requests action item rework
        if (state.rework?.includes('action')) return this.nodeNames.ACTION_ITEM_EXTRACTION;
        // If supervisor requests summary rework
        if (state.rework?.includes('summary')) return this.nodeNames.SUMMARY_GENERATION;
        // Default to post-processing if no rework needed
        return this.nodeNames.POST_PROCESSING;
      }
    );
    
    this.logger.log(`Built RAG-enhanced meeting analysis graph with ${Object.keys(graph.nodes).length} nodes`);
    return graph;
  }
  
  /**
   * Create agent node functions for use in the graph
   * This extracts the common agent initialization logic
   */
  private async createAgentNodes(): Promise<Record<string, Function>> {
    // Get agent instances from factory
    const topicAgent = this.agentFactory.getTopicExtractionAgent();
    const actionItemAgent = this.agentFactory.getActionItemAgent();
    const sentimentAgent = this.agentFactory.getSentimentAnalysisAgent();
    const summaryAgent = this.agentFactory.getSummaryAgent();
    
    // Define initialization node to handle state prep
    const initialization = async (state: any) => {
      this.logger.log('Executing initialization node');
      // Just pass through the state after logging
      return { ...state, initialized: true };
    };
    
    // Create wrapper functions for each agent
    const topicExtraction = async (state: any) => {
      this.logger.log('Running topic extraction');
      const topics = await topicAgent.extractTopics(state.transcript);
      return { ...state, topics };
    };
    
    const actionItemExtraction = async (state: any) => {
      this.logger.log('Running action item extraction');
      const actionItems = await actionItemAgent.extractActionItems(state.transcript);
      return { ...state, actionItems };
    };
    
    const sentimentAnalysis = async (state: any) => {
      this.logger.log('Running sentiment analysis');
      const sentiment = await sentimentAgent.analyzeSentiment(state.transcript);
      return { ...state, sentiment };
    };
    
    const summaryGeneration = async (state: any) => {
      this.logger.log('Generating summary');
      const summary = await summaryAgent.generateSummary(state.transcript, state.topics, state.actionItems);
      return { ...state, summary };
    };
    
    const supervision = async (state: any) => {
      this.logger.log('Running supervisor review');
      try {
        // We'll implement a simple review directly here
        // Check quality of topics
        const needsTopicRework = state.topics?.length < 2;
        
        // Check quality of action items
        const needsActionItemRework = state.actionItems?.length < 2;
        
        // Check quality of summary
        const needsSummaryRework = !state.summary?.summary || state.summary.summary.length < 50;
        
        // Build a rework array if needed
        const rework: string[] = [];
        if (needsTopicRework) rework.push('topic');
        if (needsActionItemRework) rework.push('action');
        if (needsSummaryRework) rework.push('summary');
        
        this.logger.log(`Supervisor review complete. Rework needed: ${rework.length > 0 ? rework.join(', ') : 'none'}`);
        
        return { ...state, supervised: true, rework };
      } catch (error) {
        this.logger.error(`Error in supervisor review: ${error.message}`);
        return { ...state, supervised: true, rework: [], supervisorError: error.message };
      }
    };
    
    const postProcessing = async (state: any) => {
      // Finalize any state processing before completion
      this.logger.log('Post-processing state');
      return { ...state, postProcessed: true };
    };
    
    return {
      initialization,
      topicExtraction,
      actionItemExtraction,
      sentimentAnalysis,
      summaryGeneration,
      supervision,
      postProcessing
    };
  }

  /**
   * Analyze a meeting transcript using the Graph approach
   */
  async analyzeMeeting(transcript: string, useRag: boolean = false): Promise<any> {
    this.logger.log(`Starting meeting analysis with LangGraph approach, RAG enabled: ${useRag}`);
    
    // Create the graph
    const graph = useRag 
      ? await this.buildRagMeetingAnalysisGraph()
      : await this.buildMeetingAnalysisGraph();
    
    // Create initial state
    const initialState = {
      transcript,
      startTime: new Date().toISOString(),
      sessionId: `session-${Date.now()}`,
      topics: [],
      actionItems: [],
      errors: [],
    };
    
    // Execute the graph
    this.logger.log('Executing meeting analysis graph...');
    const result = await this.executeGraph(graph, initialState);
    
    this.logger.log('Meeting analysis completed');
    return result;
  }

  /**
   * Build the master supervisor graph that routes between different workflows
   */
  async buildMasterSupervisorGraph(): Promise<any> {
    this.logger.log('Building master supervisor graph');
    
    // Create a new graph
    const graph = this.createGraph();
    
    // Add nodes to the graph
    graph.addNode(this.masterNodeNames.SUPERVISOR, async (state: any) => {
      try {
        const masterSupervisorAgent = this.agentFactory.getMasterSupervisorAgent();
        
        // Ensure state.input exists, use transcript if available
        if (!state.input && state.transcript) {
          state.input = {
            type: 'meeting_transcript',
            transcript: state.transcript,
            metadata: state.metadata || {}
          };
          this.logger.log(`Created input object from transcript: ${state.input.transcript.length} characters`);
        }
        
        if (!state.input) {
          this.logger.error('No input found in state for supervisor');
          return {
            ...state,
            routing: {
              team: 'unknown',
              reason: 'No input provided',
              priority: 'low'
            }
          };
        }
        
        // Get routing decision from master supervisor
        this.logger.log(`Getting routing decision for input of type: ${state.input.type || 'unknown'}`);
        const routingDecision = await masterSupervisorAgent.determineTeam(state.input);
        this.logger.log(`Master Supervisor decision: ${JSON.stringify(routingDecision)}`);
        
        // Return updated state with routing information
        return {
          ...state,
          routing: routingDecision
        };
      } catch (error) {
        this.logger.error(`Error in supervisor node: ${error.message}`, error.stack);
        return {
          ...state,
          routing: {
            team: 'unknown',
            reason: `Error: ${error.message}`,
            priority: 'low'
          },
          errors: [
            ...(state.errors || []),
            {
              step: 'supervisor',
              error: error.message,
              timestamp: new Date().toISOString()
            }
          ]
        };
      }
    });
    
    graph.addNode(this.masterNodeNames.MEETING_ANALYSIS_TEAM, async (state: any) => {
      try {
        this.logger.log('Routing to Meeting Analysis Team');
        
        // Debug state contents
        this.logger.log(`Meeting Analysis Team input state keys: ${Object.keys(state).join(', ')}`);
        this.logger.log(`Input transcript length: ${state.input?.transcript?.length || state.transcript?.length || 0}`);
        
        // Delegate to the MeetingAnalysisService via AnalysisDelegationService
        // This breaks the circular dependency and properly uses RAG
        return await this.analysisDelegationService.delegateMeetingAnalysis(state);
      } catch (error) {
        this.logger.error(`Error in meeting analysis team node: ${error.message}`, error.stack);
        return {
          ...state,
          result: null,
          resultType: 'meeting_analysis',
          errors: [
            ...(state.errors || []),
            {
              step: 'meeting_analysis_team',
              error: error.message,
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }
    });
    
    graph.addNode(this.masterNodeNames.EMAIL_TRIAGE_TEAM, async (state: any) => {
      // Email triage implementation will be added later
      this.logger.log('Routing to Email Triage Team (not implemented yet)');
      return {
        ...state,
        result: {
          message: 'Email triage team not implemented yet',
          timestamp: new Date().toISOString(),
        },
        resultType: 'email_triage',
      };
    });
    
    // Add edges with explicit logging
    this.logger.log(`Adding edge from ${this.masterNodeNames.START} to ${this.masterNodeNames.SUPERVISOR}`);
    graph.addEdge(this.masterNodeNames.START, this.masterNodeNames.SUPERVISOR);
    
    // Add conditional edge from SUPERVISOR based on routing decision
    this.logger.log(`Adding conditional edge from ${this.masterNodeNames.SUPERVISOR}`);
    graph.addConditionalEdge(
      this.masterNodeNames.SUPERVISOR,
      (state: any) => {
        const team = state.routing?.team;
        this.logger.log(`Evaluating routing decision: team=${team}`);
        
        if (team === 'meeting_analysis') {
          this.logger.log(`Routing to ${this.masterNodeNames.MEETING_ANALYSIS_TEAM}`);
          return this.masterNodeNames.MEETING_ANALYSIS_TEAM;
        } else if (team === 'email_triage') {
          this.logger.log(`Routing to ${this.masterNodeNames.EMAIL_TRIAGE_TEAM}`);
          return this.masterNodeNames.EMAIL_TRIAGE_TEAM;
        } else {
          // Unknown team, go to END
          this.logger.log(`Unknown team, routing to ${this.masterNodeNames.END}`);
          return this.masterNodeNames.END;
        }
      }
    );
    
    // Add final edges
    this.logger.log(`Adding edge from ${this.masterNodeNames.MEETING_ANALYSIS_TEAM} to ${this.masterNodeNames.END}`);
    graph.addEdge(this.masterNodeNames.MEETING_ANALYSIS_TEAM, this.masterNodeNames.END);
    
    this.logger.log(`Adding edge from ${this.masterNodeNames.EMAIL_TRIAGE_TEAM} to ${this.masterNodeNames.END}`);
    graph.addEdge(this.masterNodeNames.EMAIL_TRIAGE_TEAM, this.masterNodeNames.END);
    
    this.logger.log('Master supervisor graph built successfully');
    return graph;
  }
}
