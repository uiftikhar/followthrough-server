import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AgentFactory } from './agent.factory';
import { TopicExtractionAgent } from './topic-extraction.agent';
import { ActionItemAgent } from './action-item.agent';
import { SentimentAnalysisAgent } from './sentiment-analysis.agent';
import { SummaryAgent } from './summary.agent';
import { ParticipationAgent } from './participation.agent';
import { ContextIntegrationAgent } from './context-integration.agent';
import { MasterSupervisorAgent } from './master-supervisor.agent';
import { SupervisorAgent } from './supervisor/supervisor.agent';
import { TeamFormationService } from './team/team-formation.service';

/**
 * Consolidated agents module that includes all agent-related functionality
 */
@Module({
  imports: [LlmModule],
  providers: [
    // Base agents
    AgentFactory,
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,
    MasterSupervisorAgent,
    
    // Supervisor agents
    SupervisorAgent,
    
    // Team services
    TeamFormationService,
  ],
  exports: [
    // Base agents
    AgentFactory,
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,
    MasterSupervisorAgent,
    
    // Supervisor agents
    SupervisorAgent,
    
    // Team services
    TeamFormationService,
  ],
})
export class AgentsModule {} 