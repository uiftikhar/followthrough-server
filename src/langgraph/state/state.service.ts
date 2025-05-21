import { Injectable, Logger } from '@nestjs/common';
import { StateStorageService } from '../persistence/state-storage.service';
import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Generic state management service for LangGraph
 */
@Injectable()
export class StateService {
  private readonly logger = new Logger(StateService.name);

  constructor(private readonly stateStorage: StateStorageService) {}

  /**
   * Create an annotation for a base message array
   */
  createMessagesAnnotation() {
    return Annotation<BaseMessage[]>({
      reducer: (x, y) => [...x, ...y],
      default: () => [],
    });
  }

  /**
   * Create a complete state definition for meeting analysis
   */
  createMeetingAnalysisState() {
    return {
      messages: this.createMessagesAnnotation(),
      transcript: this.createStringAnnotation(),
      topics: this.createArrayAnnotation(),
      actionItems: this.createArrayAnnotation(),
      sentiment: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
      }),
      summary: Annotation({
        reducer: (x, y) => y ?? x,
        default: () => null,
      }),
      currentPhase: this.createStringAnnotation('initialization'),
      errors: this.createArrayAnnotation(),
    };
  }

  /**
   * Create an annotation for a string
   */
  createStringAnnotation(defaultValue = '') {
    return Annotation<string>({
      reducer: (x, y) => y ?? x,
      default: () => defaultValue,
    });
  }

  /**
   * Create an annotation for an array of objects
   */
  createArrayAnnotation<T>() {
    return Annotation<T[]>({
      reducer: (x, y) => [...x, ...y],
      default: () => [],
    });
  }

  /**
   * Create an annotation for a record object
   */
  createRecordAnnotation<T>() {
    return Annotation<Record<string, T>>({
      reducer: (x, y) => ({ ...x, ...y }),
      default: () => ({}),
    });
  }

  /**
   * Create an annotation for a routing value
   */
  createRoutingAnnotation(defaultNode = 'start') {
    return Annotation<string>({
      reducer: (x, y) => y ?? x,
      default: () => defaultNode,
    });
  }

  /**
   * Create initial state for graph execution
   */
  async createInitialState(options: {
    transcript: string;
    sessionId: string;
    userId: string;
    startTime: string;
    metadata?: Record<string, any>;
    useRAG?: boolean;
  }): Promise<any> {
    this.logger.log(`Creating initial state for graph execution for session ${options.sessionId}`);
    
    return {
      transcript: options.transcript,
      sessionId: options.sessionId,
      userId: options.userId,
      startTime: options.startTime,
      metadata: options.metadata || {},
      useRAG: options.useRAG || false,
      initialized: false,
      topics: [],
      actionItems: [],
      summary: null,
      sentiment: null,
      errors: [],
    };
  }

  /**
   * Save state to persistent storage
   */
  async saveState(sessionId: string, state: any): Promise<void> {
    this.logger.log(`Saving state for session ${sessionId}`);
    // Implementation would typically save to a database
  }

  /**
   * Get saved state from persistent storage
   */
  async getState(sessionId: string): Promise<any | null> {
    this.logger.log(`Getting state for session ${sessionId}`);
    // Implementation would typically retrieve from a database
    return null;
  }

  /**
   * Save state checkpoint
   */
  async saveStateCheckpoint(
    sessionId: string,
    checkpointId: string,
    state: any,
  ): Promise<void> {
    try {
      await this.stateStorage.saveState(sessionId, checkpointId, state);
    } catch (error) {
      this.logger.error(`Failed to save state: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Load state checkpoint
   */
  async loadState(sessionId: string, checkpointId: string): Promise<any> {
    try {
      return await this.stateStorage.loadState(sessionId, checkpointId);
    } catch (error) {
      this.logger.error(`Failed to load state: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Delete state checkpoint
   */
  async deleteState(sessionId: string, checkpointId: string): Promise<void> {
    try {
      await this.stateStorage.deleteState(sessionId, checkpointId);
    } catch (error) {
      this.logger.error(
        `Failed to delete state: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * List checkpoints for a session
   */
  async listCheckpoints(sessionId: string): Promise<string[]> {
    try {
      return await this.stateStorage.listCheckpoints(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to list checkpoints: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }
}
