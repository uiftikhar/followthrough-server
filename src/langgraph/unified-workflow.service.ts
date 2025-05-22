import { Injectable, Logger } from '@nestjs/common';
import { GraphService } from './graph/graph.service';
import { StateService } from './state/state.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { SessionRepository } from '../database/repositories/session.repository';
import { Session } from '../database/schemas/session.schema';

/**
 * Event type for workflow progress updates
 */
export interface WorkflowProgressEvent {
  sessionId: string;
  phase: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  timestamp: string;
}

/**
 * Service for handling unified workflow processing with routing to specialized teams
 */
@Injectable()
export class UnifiedWorkflowService {
  private readonly logger = new Logger(UnifiedWorkflowService.name);
  private readonly progressMap: Map<string, number> = new Map();

  constructor(
    private readonly graphService: GraphService,
    private readonly stateService: StateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionRepository: SessionRepository,
  ) {
    this.logger.log('UnifiedWorkflowService initialized');
  }

  /**
   * Process an input and route it to the appropriate team
   */
  async processInput(
    input: any,
    metadata?: Record<string, any>,
    userId?: string,
  ): Promise<{
    sessionId: string;
    status: string;
  }> {
    // Generate session ID
    const sessionId = uuidv4();
    const actualUserId = userId || 'system';
    
    this.logger.log(`Created new workflow session: ${sessionId} for user: ${actualUserId}`);

    try {
      // Create initial session object for MongoDB
      const sessionData: Partial<Session> = {
        sessionId,
        userId: actualUserId,
        status: 'pending',
        startTime: new Date(),
        metadata: metadata || {},
      };

      // Store the session in MongoDB
      await this.sessionRepository.createSession(sessionData);
      this.logger.log(`Session ${sessionId} stored in MongoDB for user ${actualUserId}`);
      
      // Initialize progress
      this.initProgress(sessionId);

      // Publish initial progress update
      this.publishProgressUpdate(
        sessionId,
        'initialization',
        0,
        'pending',
        'Starting workflow',
      );
      
      // Initialize state
      const initialState = await this.stateService.createInitialState({
        transcript: input.transcript || JSON.stringify(input),
        sessionId,
        userId: actualUserId,
        startTime: new Date().toISOString(),
        metadata: metadata || {},
      });
      initialState.input = input;
      
      this.logger.log(` *******************\n Created initial state for graph execution:\n ${JSON.parse(JSON.stringify(Object.keys(initialState)))}\n *******************`);
      
      // Start processing (non-blocking)
      this.runSupervisorGraph(sessionId, initialState);

      return {
        sessionId,
        status: 'pending',
      };
    } catch (error) {
      this.logger.error(`Error initiating workflow: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Run the supervisor graph to route the input
   */
  private async runSupervisorGraph(sessionId: string, initialState: any): Promise<void> {
    try {
      // Update session status to in_progress
      await this.sessionRepository.updateSession(sessionId, {
        status: 'in_progress',
      });
      
      this.publishProgressUpdate(
        sessionId,
        'routing',
        5,
        'in_progress',
        'Building supervisor graph',
      );
      
      // Build the master supervisor graph
      const graph = await this.graphService.buildMasterSupervisorGraph();
      
      // Add state transition handler for progress tracking
      this.attachProgressTracker(graph, sessionId);
      
      this.publishProgressUpdate(
        sessionId,
        'routing',
        15,
        'in_progress',
        'Starting supervisor execution',
      );
      
      // Execute the graph with initial state
      this.logger.log(`Executing supervisor graph for session ${sessionId}`);
      const finalState = await this.graphService.executeGraph(graph, initialState);
      
      this.logger.log(`Graph execution completed for session ${sessionId}`);
      this.logger.log(`Final state keys: ${Object.keys(finalState).join(', ')}`);
      
      // Add more detailed logging for debugging
      this.logger.log(`Result type: ${finalState.resultType}`);
      this.logger.log(`Routing: ${JSON.stringify(finalState.routing || {})}`);
      
      if (finalState.result) {
        this.logger.log(`Result keys: ${Object.keys(finalState.result).join(', ')}`);
        
        if (finalState.resultType === 'meeting_analysis') {
          this.logger.log(`Topics count: ${finalState.result.topics?.length || 0}`);
          this.logger.log(`Action items count: ${finalState.result.actionItems?.length || 0}`);
          this.logger.log(`Has summary: ${!!finalState.result.summary}`);
          this.logger.log(`Has sentiment: ${!!finalState.result.sentiment}`);
        }
      } else {
        this.logger.log(`Result is null or undefined`);
      }
      
      // Update session with results
      await this.saveResults(sessionId, finalState);
      
      // Final progress update
      this.publishProgressUpdate(
        sessionId,
        'completion',
        100,
        'completed',
        `Workflow completed with result type: ${finalState.resultType || 'unknown'}`,
      );
    } catch (error) {
      this.logger.error(`Error in supervisor graph execution: ${error.message}`, error.stack);
      
      // Update session with error
      await this.sessionRepository.updateSession(sessionId, {
        status: 'failed',
        errors: [
          {
            step: 'supervisor_graph',
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      
      // Error progress update
      this.publishProgressUpdate(
        sessionId,
        'error',
        100,
        'failed',
        `Workflow failed: ${error.message}`,
      );
    }
  }

  /**
   * Save workflow results to database
   */
  private async saveResults(sessionId: string, state: any): Promise<void> {
    this.logger.log(`Saving results for session ${sessionId}`);
    
    try {
      const updates: Partial<Session> = {
        status: 'completed',
        endTime: new Date(),
      };
      
      // Add result-specific fields based on result type
      if (state.resultType === 'meeting_analysis') {
        updates.transcript = state.result?.transcript;
        updates.topics = state.result?.topics;
        updates.actionItems = state.result?.actionItems;
        updates.sentiment = state.result?.sentiment;
        updates.summary = state.result?.summary;
      } else if (state.resultType === 'email_triage') {
        // We'll add email-specific fields later
        updates.metadata = {
          ...(updates.metadata || {}),
          emailTriageResult: state.result,
        };
      }
      
      // Add any errors
      if (state.errors && state.errors.length > 0) {
        updates.errors = state.errors;
      }
      
      // Update the session in the database
      await this.sessionRepository.updateSession(sessionId, updates);
      this.logger.log(`Results saved for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error saving results: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Initialize progress tracking for a new session
   */
  private initProgress(sessionId: string): void {
    this.progressMap.set(sessionId, 0);
    this.logger.log(`Initialized progress tracking for session ${sessionId}`);
  }

  /**
   * Attach progress tracker to a graph
   */
  private attachProgressTracker(graph: any, sessionId: string): void {
    graph.addStateTransitionHandler(async (prevState: any, newState: any, nodeName: string) => {
      // Skip tracking for start node
      if (nodeName === '__start__') {
        return newState;
      }
      
      const progress = this.calculateProgressForNode(nodeName);
      
      this.logger.log(`Progress update for session ${sessionId}: ${progress}% at node ${nodeName}`);
      
      // Publish progress update
      this.publishProgressUpdate(
        sessionId,
        nodeName,
        progress,
        'in_progress',
        `Executing ${nodeName}`,
      );
      
      return newState;
    });
  }

  /**
   * Calculate progress percentage based on node name
   */
  private calculateProgressForNode(nodeName: string): number {
    // Define progress points for each node
    const progressMap: Record<string, number> = {
      'supervisor': 25,
      'meeting_analysis_team': 75,
      'email_triage_team': 75,
      '__end__': 95,
    };
    
    return progressMap[nodeName] || 50;
  }

  /**
   * Publish a progress update event
   */
  private publishProgressUpdate(
    sessionId: string,
    phase: string,
    progress: number,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    message?: string,
  ): void {
    // Update internal progress tracking
    this.progressMap.set(sessionId, progress);
    
    // Create event object
    const event: WorkflowProgressEvent = {
      sessionId,
      phase,
      progress,
      status,
      message,
      timestamp: new Date().toISOString(),
    };
    
    // Emit event
    this.eventEmitter.emit('workflow.progress', event);
    this.logger.log(`Emitted workflow.progress event for session ${sessionId}: ${progress}%`);
  }
} 