import { Injectable, Logger } from "@nestjs/common";
import { AgentFactory } from "../agent.factory";
import { BaseAgent } from "../base-agent";

export interface TeamConfig {
  name: string;
  description: string;
  members: string[]; // Agent types to include
  supervisorEnabled: boolean;
}

export interface Team {
  name: string;
  description: string;
  members: BaseAgent[];
}

@Injectable()
export class TeamFormationService {
  private readonly logger = new Logger(TeamFormationService.name);

  constructor(private readonly agentFactory: AgentFactory) {}

  /**
   * Form a team with the specified configuration
   */
  formTeam(config: TeamConfig): Team {
    this.logger.debug(`Forming team: ${config.name}`);

    const members: BaseAgent[] = [];

    // Add requested agent types to the team
    for (const member of config.members) {
      try {
        let agent: BaseAgent;

        switch (member) {
          case "topic_extraction":
            agent = this.agentFactory.createTopicExtractionAgent();
            break;
          case "action_item":
            agent = this.agentFactory.createActionItemAgent();
            break;
          case "sentiment_analysis":
            agent = this.agentFactory.createSentimentAnalysisAgent();
            break;
          case "summary":
            agent = this.agentFactory.createSummaryAgent();
            break;
          case "participation":
            // Create a basic agent for participation analysis
            agent = this.agentFactory.createBaseAgent({
              name: "ParticipationAgent",
              systemPrompt: "You are a specialized agent for analyzing participant engagement and contributions in meetings.",
              llmOptions: { temperature: 0.3, model: "gpt-4o" }
            });
            break;
          case "context_integration":
            // Create a basic agent for context integration
            agent = this.agentFactory.createBaseAgent({
              name: "ContextIntegrationAgent", 
              systemPrompt: "You are a specialized agent for integrating context from multiple sources to enhance meeting analysis.",
              llmOptions: { temperature: 0.3, model: "gpt-4o" }
            });
            break;
          default:
            this.logger.warn(`Unknown agent type: ${member}`);
            continue;
        }

        members.push(agent);
        this.logger.debug(`Added ${member} agent to team ${config.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to add agent ${member} to team: ${error.message}`,
        );
      }
    }

    // Create the team
    const team: Team = {
      name: config.name,
      description: config.description,
      members,
    };

    return team;
  }

  /**
   * Form a standard analysis team with all agents
   */
  formStandardAnalysisTeam(): Team {
    return this.formTeam({
      name: "Standard Analysis Team",
      description: "A complete team for comprehensive meeting analysis",
      members: [
        "topic_extraction",
        "action_item",
        "sentiment_analysis",
        "participation",
        "context_integration",
        "summary",
      ],
      supervisorEnabled: true,
    });
  }

  /**
   * Form a quick analysis team with only essential agents
   */
  formQuickAnalysisTeam(): Team {
    return this.formTeam({
      name: "Quick Analysis Team",
      description: "A minimal team for quick meeting analysis",
      members: ["topic_extraction", "action_item", "summary"],
      supervisorEnabled: true,
    });
  }

  /**
   * Form a custom team based on specific needs
   */
  formCustomTeam(config: Partial<TeamConfig>): Team {
    const defaultConfig: TeamConfig = {
      name: "Custom Analysis Team",
      description: "A custom team for specialized meeting analysis",
      members: ["topic_extraction"],
      supervisorEnabled: true,
    };

    return this.formTeam({
      ...defaultConfig,
      ...config,
    });
  }
}
