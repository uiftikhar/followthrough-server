import { Injectable, Logger, Optional } from "@nestjs/common";
import { AgentFactory } from "../agent.factory";
import { BaseAgent } from "../base-agent";
import { MeetingAnalysisAgentFactory } from "../../meeting-analysis/meeting-analysis-agent.factory";

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

/**
 * TeamFormationService
 *
 * Service for dynamically forming teams of agents for analysis workflows.
 * Now uses domain-specific factories to access specialized agents.
 */
@Injectable()
export class TeamFormationService {
  private readonly logger = new Logger(TeamFormationService.name);

  constructor(
    private readonly agentFactory: AgentFactory,
    @Optional()
    private readonly meetingAnalysisAgentFactory?: MeetingAnalysisAgentFactory,
  ) {}

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
            if (this.meetingAnalysisAgentFactory) {
              agent =
                this.meetingAnalysisAgentFactory.getTopicExtractionAgent();
            } else {
              // Fallback to basic agent creation
              agent = this.agentFactory.createBaseAgent({
                name: "TopicExtractionAgent",
                systemPrompt:
                  "You are a specialized agent for extracting key topics from meeting transcripts.",
                llmOptions: { temperature: 0.3, model: "gpt-4o" },
              });
            }
            break;
          case "action_item":
            if (this.meetingAnalysisAgentFactory) {
              agent = this.meetingAnalysisAgentFactory.getActionItemAgent();
            } else {
              agent = this.agentFactory.createBaseAgent({
                name: "ActionItemAgent",
                systemPrompt:
                  "You are a specialized agent for extracting action items from meeting transcripts.",
                llmOptions: { temperature: 0.2, model: "gpt-4o" },
              });
            }
            break;
          case "sentiment_analysis":
            if (this.meetingAnalysisAgentFactory) {
              agent =
                this.meetingAnalysisAgentFactory.getSentimentAnalysisAgent();
            } else {
              agent = this.agentFactory.createBaseAgent({
                name: "SentimentAnalysisAgent",
                systemPrompt:
                  "You are a specialized agent for analyzing sentiment in meeting transcripts.",
                llmOptions: { temperature: 0.3, model: "gpt-4o" },
              });
            }
            break;
          case "summary":
            if (this.meetingAnalysisAgentFactory) {
              agent = this.meetingAnalysisAgentFactory.getSummaryAgent();
            } else {
              agent = this.agentFactory.createBaseAgent({
                name: "SummaryAgent",
                systemPrompt:
                  "You are a specialized agent for creating meeting summaries.",
                llmOptions: { temperature: 0.4, model: "gpt-4o" },
              });
            }
            break;
          case "participation":
            if (this.meetingAnalysisAgentFactory) {
              agent = this.meetingAnalysisAgentFactory.getParticipationAgent();
            } else {
              agent = this.agentFactory.createBaseAgent({
                name: "ParticipationAgent",
                systemPrompt:
                  "You are a specialized agent for analyzing participant engagement and contributions in meetings.",
                llmOptions: { temperature: 0.3, model: "gpt-4o" },
              });
            }
            break;
          case "context_integration":
            if (this.meetingAnalysisAgentFactory) {
              agent =
                this.meetingAnalysisAgentFactory.getContextIntegrationAgent();
            } else {
              agent = this.agentFactory.createBaseAgent({
                name: "ContextIntegrationAgent",
                systemPrompt:
                  "You are a specialized agent for integrating context from multiple sources to enhance meeting analysis.",
                llmOptions: { temperature: 0.3, model: "gpt-4o" },
              });
            }
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
