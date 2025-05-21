import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AgentFactory } from './agent.factory';
import { TopicExtractionAgent } from './topic-extraction.agent';
import { ActionItemAgent } from './action-item.agent';
import { SentimentAnalysisAgent } from './sentiment-analysis.agent';
import { SummaryAgent } from './summary.agent';
import { ParticipationAgent } from './participation.agent';
import { ContextIntegrationAgent } from './context-integration.agent';

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
  ],
  exports: [
    AgentFactory,
    TopicExtractionAgent,
    ActionItemAgent,
    SentimentAnalysisAgent,
    SummaryAgent,
    ParticipationAgent,
    ContextIntegrationAgent,
  ],
})
export class AgentModule {}
