import { Injectable, Logger } from '@nestjs/common';
import { AgentFactory } from '../agent.factory';
import { BaseAgent } from '../base-agent';
import { SupervisorAgent } from '../supervisor/supervisor.agent';

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
  supervisor?: SupervisorAgent;
}

@Injectable()
export class TeamFormationService {
  private readonly logger = new Logger(TeamFormationService.name);

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly supervisorAgent: SupervisorAgent,
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
          case 'topic_extraction':
            agent = this.agentFactory.getTopicExtractionAgent();
            break;
          case 'action_item':
            agent = this.agentFactory.getActionItemAgent();
            break;
          case 'sentiment_analysis':
            agent = this.agentFactory.getSentimentAnalysisAgent();
            break;
          case 'summary':
            agent = this.agentFactory.getSummaryAgent();
            break;
          case 'participation':
            agent = this.agentFactory.getParticipationAgent();
            break;
          case 'context_integration':
            agent = this.agentFactory.getContextIntegrationAgent();
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

    // Add supervisor if enabled
    if (config.supervisorEnabled) {
      team.supervisor = this.supervisorAgent;
      this.logger.debug(`Added supervisor to team ${config.name}`);
    }

    return team;
  }

  /**
   * Form a standard analysis team with all agents
   */
  formStandardAnalysisTeam(): Team {
    return this.formTeam({
      name: 'Standard Analysis Team',
      description: 'A complete team for comprehensive meeting analysis',
      members: [
        'topic_extraction',
        'action_item',
        'sentiment_analysis',
        'participation',
        'context_integration',
        'summary',
      ],
      supervisorEnabled: true,
    });
  }

  /**
   * Form a quick analysis team with only essential agents
   */
  formQuickAnalysisTeam(): Team {
    return this.formTeam({
      name: 'Quick Analysis Team',
      description: 'A minimal team for quick meeting analysis',
      members: ['topic_extraction', 'action_item', 'summary'],
      supervisorEnabled: true,
    });
  }

  /**
   * Form a custom team based on specific needs
   */
  formCustomTeam(config: Partial<TeamConfig>): Team {
    const defaultConfig: TeamConfig = {
      name: 'Custom Analysis Team',
      description: 'A custom team for specialized meeting analysis',
      members: ['topic_extraction'],
      supervisorEnabled: true,
    };

    return this.formTeam({
      ...defaultConfig,
      ...config,
    });
  }
}
