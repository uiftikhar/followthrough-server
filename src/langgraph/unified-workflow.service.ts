import { Injectable, Logger } from '@nestjs/common';
import { StateService } from './state/state.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { SessionRepository } from '../database/repositories/session.repository';
import { Session } from '../database/schemas/session.schema';
import { EnhancedGraphService } from './core/enhanced-graph.service';

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
    private readonly stateService: StateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionRepository: SessionRepository,
    private readonly enhancedGraphService: EnhancedGraphService,
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

      // Add transcript to session if available
      if (input.transcript) {
        sessionData.transcript = input.transcript;
      } else if (typeof input === 'string') {
        sessionData.transcript = input;
      }

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
      
      // Use the enhanced graph service which now has a pre-built supervisor graph
      this.logger.log('Using enhanced graph service for hierarchical agent analysis');
      this.runEnhancedGraphAnalysis(
        sessionId,
        typeof input === 'string' ? input : input.transcript,
        metadata,
        actualUserId
      );

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
   * Run analysis using enhanced graph service with pre-built supervisor graph
   */
  private async runEnhancedGraphAnalysis(
    sessionId: string, 
    transcript: string,
    metadata?: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      this.logger.log(`Executing hierarchical agent analysis for session ${sessionId}`);
      
      // Update session status to in_progress
      await this.sessionRepository.updateSession(sessionId, {
        status: 'in_progress',
      });
      
      // Publish progress update - starting analysis
      this.publishProgressUpdate(
        sessionId,
        'initialization',
        10,
        'in_progress',
        'Starting hierarchical agent analysis',
      );
      
      // Execute the analysis using the enhanced graph service
      // The supervisor graph is now pre-built during application initialization
      // which improves performance by eliminating redundant graph construction
      const result = await this.enhancedGraphService.analyzeMeeting(transcript);
      
      this.logger.log(`Analysis completed for session ${sessionId}`);
      
      // Update session with results - ensure proper typing
      const updates: any = {
        status: 'completed',
        endTime: new Date(),
        transcript: transcript,
        // Store properly typed objects
        topics: result.topics || [],
        actionItems: result.actionItems || [],
        sentiment: result.sentiment,
        summary: result.summary,
        metadata: { 
          ...metadata,
          results: {
            // Include all details in the results
            meetingId: sessionId,
            transcript: transcript,
            context: metadata || {},
            topics: result.topics || [],
            stage: result.stage || 'completed',
            actionItems: result.actionItems || [],
            sentiment: result.sentiment,
            summary: result.summary
          },
        },
      };
      
      // Add errors if any
      if (result.errors && result.errors.length > 0) {
        updates.errors = result.errors;
      }
      
      await this.sessionRepository.updateSession(sessionId, updates);
      
      // Final progress update
      this.publishProgressUpdate(
        sessionId,
        'completed',
        100,
        'completed',
        'Analysis completed successfully',
      );
    } catch (error) {
      this.logger.error(`Error executing hierarchical agent analysis: ${error.message}`, error.stack);
      
      // Update session with error
      await this.sessionRepository.updateSession(sessionId, {
        status: 'failed',
        endTime: new Date(),
        errors: [{
          step: 'hierarchical_agent_analysis',
          error: error.message,
          timestamp: new Date().toISOString(),
        }],
      });
      
      // Final error progress update
      this.publishProgressUpdate(
        sessionId,
        'failed',
        100,
        'failed',
        `Analysis failed: ${error.message}`,
      );
    }
  }

  /**
   * Get results for a session
   */
  async getResults(sessionId: string, userId?: string): Promise<any> {
    this.logger.log(`Retrieving workflow results for session: ${sessionId}`);
    
    try {
      let session;
      
      if (userId) {
        // Get session with user verification
        session = await this.sessionRepository.getSessionByIdAndUserId(sessionId, userId);
      } else {
        // Get session without user verification
        session = await this.sessionRepository.getSessionById(sessionId);
      }
      
      // Format the results to match the expected format
      return {
        sessionId: session.sessionId,
        status: session.status,
        createdAt: session.startTime,
        completedAt: session.endTime,
        transcript: session.transcript,
        topics: session.topics,
        actionItems: session.actionItems,
        summary: session.summary,
        sentiment: session.sentiment,
        errors: session.errors,
        metadata: session.metadata,
      };
    } catch (error) {
      this.logger.error(`Error retrieving workflow results: ${error.message}`, error.stack);
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
      'initialization': 5,
      'routing': 15,
      'processing': 50,
      'finalization': 90,
      'topic_extraction': 35,
      'action_item_extraction': 55,
      'sentiment_analysis': 70,
      'summary_generation': 85,
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
    
    // Update session in database with progress
    this.sessionRepository.updateSession(sessionId, {
      progress: progress,
      status: status
    }).catch(error => {
      this.logger.error(`Error updating session progress: ${error.message}`, error.stack);
    });
    
    // Emit event
    this.eventEmitter.emit('workflow.progress', event);
    this.logger.log(`Emitted workflow.progress event for session ${sessionId}: ${progress}%`);
  }
} 