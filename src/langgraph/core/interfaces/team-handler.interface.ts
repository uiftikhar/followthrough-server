/**
 * Interface for team handlers in the system
 * This provides a consistent way for the supervisor to delegate work to specialized teams
 */
export interface TeamHandler<TInput = any, TOutput = any> {
  /**
   * Process a request based on the team's specialization
   * @param input The input state to process
   * @returns Promise resolving to the processed output
   */
  process(input: TInput): Promise<TOutput>;
  
  /**
   * Get the team name
   * @returns The name of the team
   */
  getTeamName(): string;
  
  /**
   * Check if this team can handle the given input
   * @param input The input to check
   * @returns True if this team can handle the input, false otherwise
   */
  canHandle?(input: any): Promise<boolean>;
} 