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

@Module({
  imports: [LlmModule],
  providers: [
    AgentFactory,
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,
    MasterSupervisorAgent,
  ],
  exports: [
    AgentFactory,
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,
    MasterSupervisorAgent,
  ],
})
export class AgentModule {}
