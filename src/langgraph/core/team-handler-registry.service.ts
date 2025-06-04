import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { TeamHandler } from "./interfaces/team-handler.interface";

/**
 * Registry service for team handlers
 * Provides a way to register and retrieve team handlers
 */
@Injectable()
export class TeamHandlerRegistry implements OnModuleInit {
  private readonly logger = new Logger(TeamHandlerRegistry.name);
  private readonly handlers: Map<string, TeamHandler> = new Map();

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Initialize the registry after all modules have been initialized
   */
  async onModuleInit() {
    this.logger.log("Initializing team handler registry");
  }

  /**
   * Register a handler for a team
   * @param teamName The name of the team
   * @param handler The handler for the team
   */
  registerHandler(teamName: string, handler: TeamHandler): void {
    this.logger.log(`Registering handler for team "${teamName}"`);

    if (this.handlers.has(teamName)) {
      this.logger.warn(`Overriding existing handler for team "${teamName}"`);
    }

    this.handlers.set(teamName, handler);
  }

  /**
   * Get a handler for a team
   * @param teamName The name of the team
   * @returns The handler for the team, or undefined if not found
   */
  getHandler(teamName: string): TeamHandler | undefined {
    const handler = this.handlers.get(teamName);

    if (!handler) {
      this.logger.warn(`No handler registered for team "${teamName}"`);
    }

    return handler;
  }

  /**
   * Get all registered team handlers
   * @returns An array of registered team handlers
   */
  getAllHandlers(): TeamHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get all registered team names
   * @returns An array of registered team names
   */
  getAllTeamNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Find the appropriate handler for an input
   * @param input The input to find a handler for
   * @returns Promise resolving to the appropriate handler, or undefined if none found
   */
  async findHandlerForInput(input: any): Promise<TeamHandler | undefined> {
    this.logger.debug("Attempting to find handler for input");

    for (const handler of this.handlers.values()) {
      if (handler.canHandle && (await handler.canHandle(input))) {
        this.logger.debug(`Found handler for input: ${handler.getTeamName()}`);
        return handler;
      }
    }

    this.logger.warn("No handler found for input");
    return undefined;
  }
}
