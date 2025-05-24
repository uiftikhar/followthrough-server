/**
 * Represents the state for the supervisor agent
 */
export interface SupervisorState {
  /**
   * Session ID for tracking
   */
  sessionId: string;
  
  /**
   * Input data to be processed
   */
  input: {
    /**
     * Type of input being processed
     */
    type: 'meeting_transcript' | 'email' | 'customer_inquiry' | 'other';
    
    /**
     * Content of the input
     */
    content: string;
    
    /**
     * Additional metadata for the input
     */
    metadata?: Record<string, any>;
  };
  
  /**
   * Routing decision made by the supervisor
   */
  routing?: {
    /**
     * Team to handle the input
     */
    team: string;
    
    /**
     * Confidence level in the routing decision
     */
    confidence: number;
    
    /**
     * Explanation for the routing decision
     */
    explanation?: string;
  };
  
  /**
   * Results from the team that processed the input
   */
  results?: Record<string, any>;
  
  /**
   * Current status of the processing
   */
  status: 'pending' | 'routing' | 'processing' | 'completed' | 'failed';
  
  /**
   * Error information, if any
   */
  error?: {
    message: string;
    stage: string;
    timestamp: string;
  };
} 