import { Injectable, Logger } from '@nestjs/common';
import { EmailTriageManager } from './email-triage.manager';
import { EmailTriageState } from '../dtos/email-triage.dto';

/**
 * EmailTriageGraphBuilder - Graph-based workflow for email triage
 * Follows the pattern of MeetingAnalysisGraphBuilder
 * Provides structured workflow execution for email processing
 */
@Injectable()
export class EmailTriageGraphBuilder {
  private readonly logger = new Logger(EmailTriageGraphBuilder.name);

  // Node names for email triage graph
  private readonly nodeNames = {
    START: '__start__',
    INITIALIZATION: 'initialization',
    PARALLEL_PROCESSING: 'parallel_processing',
    CLASSIFICATION: 'classification',
    SUMMARIZATION: 'summarization',
    COORDINATION: 'coordination',
    REPLY_DRAFT: 'reply_draft',
    FINALIZATION: 'finalization',
    END: '__end__',
  };

  constructor(
    private readonly emailTriageManager: EmailTriageManager,
  ) {}

  /**
   * Build the email triage graph
   */
  async buildGraph(): Promise<any> {
    this.logger.log('Building email triage graph');
    
    // Create a simple graph structure for email triage
    const graph = {
      nodes: this.buildNodes(),
      edges: this.defineEdges(),
      entryPoint: this.nodeNames.START,
      exitPoint: this.nodeNames.END,
    };

    this.logger.log('Email triage graph built successfully');
    return graph;
  }

  /**
   * Build the nodes for the email triage graph
   */
  private buildNodes(): Record<string, Function> {
    return {
      [this.nodeNames.START]: this.startNode.bind(this),
      [this.nodeNames.INITIALIZATION]: this.initializationNode.bind(this),
      [this.nodeNames.PARALLEL_PROCESSING]: this.parallelProcessingNode.bind(this),
      [this.nodeNames.CLASSIFICATION]: this.classificationNode.bind(this),
      [this.nodeNames.SUMMARIZATION]: this.summarizationNode.bind(this),
      [this.nodeNames.COORDINATION]: this.coordinationNode.bind(this),
      [this.nodeNames.REPLY_DRAFT]: this.replyDraftNode.bind(this),
      [this.nodeNames.FINALIZATION]: this.finalizationNode.bind(this),
      [this.nodeNames.END]: this.endNode.bind(this),
    };
  }

  /**
   * Define the edges (connections) between nodes
   */
  private defineEdges(): Array<{ from: string; to: string }> {
    return [
      { from: this.nodeNames.START, to: this.nodeNames.INITIALIZATION },
      { from: this.nodeNames.INITIALIZATION, to: this.nodeNames.PARALLEL_PROCESSING },
      { from: this.nodeNames.PARALLEL_PROCESSING, to: this.nodeNames.CLASSIFICATION },
      { from: this.nodeNames.PARALLEL_PROCESSING, to: this.nodeNames.SUMMARIZATION },
      { from: this.nodeNames.CLASSIFICATION, to: this.nodeNames.COORDINATION },
      { from: this.nodeNames.SUMMARIZATION, to: this.nodeNames.COORDINATION },
      { from: this.nodeNames.COORDINATION, to: this.nodeNames.REPLY_DRAFT },
      { from: this.nodeNames.REPLY_DRAFT, to: this.nodeNames.FINALIZATION },
      { from: this.nodeNames.FINALIZATION, to: this.nodeNames.END },
    ];
  }

  /**
   * Start node - Entry point for email triage
   */
  private async startNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log(`Starting email triage for session: ${state.sessionId}`);
    
    return {
      ...state,
      currentStep: 'started',
      progress: 10,
    };
  }

  /**
   * Initialization node - Prepare email data for processing
   */
  private async initializationNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log('Initializing email triage process');
    
    // Validate email data
    if (!state.emailData || !state.emailData.body || !state.emailData.metadata) {
      throw new Error('Invalid email data structure');
    }

    return {
      ...state,
      currentStep: 'initialized',
      progress: 20,
    };
  }

  /**
   * Parallel processing node - Trigger parallel execution
   */
  private async parallelProcessingNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log('Starting parallel processing of classification and summarization');
    
    return {
      ...state,
      currentStep: 'parallel_processing',
      progress: 30,
    };
  }

  /**
   * Classification node - Classify email priority and category
   */
  private async classificationNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log('Processing email classification');
    
    // This would be handled by the EmailTriageManager in practice
    return {
      ...state,
      currentStep: 'classification',
      progress: 50,
    };
  }

  /**
   * Summarization node - Extract problem, context, and ask
   */
  private async summarizationNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log('Processing email summarization');
    
    // This would be handled by the EmailTriageManager in practice
    return {
      ...state,
      currentStep: 'summarization',
      progress: 50,
    };
  }

  /**
   * Coordination node - Combine results from parallel processing
   */
  private async coordinationNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log('Coordinating classification and summarization results');
    
    // Use EmailTriageManager to process the email with all workers
    const result = await this.emailTriageManager.processEmail(
      state.emailData,
      { sessionId: state.sessionId }
    );

    return {
      ...state,
      classification: result.classification,
      summary: result.summary,
      currentStep: 'coordination',
      progress: 70,
    };
  }

  /**
   * Reply draft node - Generate professional reply draft
   */
  private async replyDraftNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log('Generating reply draft');
    
    // The reply draft should already be generated by EmailTriageManager
    // This node is for graph completeness and future enhancements
    return {
      ...state,
      currentStep: 'reply_draft',
      progress: 90,
    };
  }

  /**
   * Finalization node - Complete the email triage process
   */
  private async finalizationNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log('Finalizing email triage process');
    
    return {
      ...state,
      currentStep: 'completed',
      progress: 100,
    };
  }

  /**
   * End node - Exit point for email triage
   */
  private async endNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log(`Email triage completed for session: ${state.sessionId}`);
    
    return state;
  }

  /**
   * Execute the email triage graph with given state
   */
  async executeGraph(initialState: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log('Executing email triage graph');
    
    try {
      // For now, we'll execute the coordination node directly
      // In a full graph implementation, this would traverse all nodes
      const result = await this.coordinationNode(initialState);
      
      this.logger.log('Email triage graph execution completed');
      return result;
    } catch (error) {
      this.logger.error(`Error executing email triage graph: ${error.message}`, error.stack);
      throw error;
    }
  }
} 