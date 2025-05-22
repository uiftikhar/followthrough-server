import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MeetingAnalysisController } from './meeting-analysis.controller';
import { MeetingAnalysisService } from './meeting-analysis.service';
import { MeetingAnalysisGateway } from './meeting-analysis.gateway';
import { DatabaseModule } from '../../database/database.module';
import { AnalysisDelegationService } from './analysis-delegation.service';
import { LanggraphModule } from '../langgraph.module';
import { AgentsModule } from '../agents/agents.module';
import { MeetingAnalysisGraphBuilder } from './meeting-analysis-graph.builder';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    DatabaseModule,
    EventEmitterModule.forRoot(),
    LanggraphModule,
    AgentsModule,
    LlmModule,
  ],
  controllers: [MeetingAnalysisController],
  providers: [
    MeetingAnalysisService, 
    MeetingAnalysisGateway,
    AnalysisDelegationService,
    MeetingAnalysisGraphBuilder,
  ],
  exports: [
    MeetingAnalysisService,
    AnalysisDelegationService,
    MeetingAnalysisGraphBuilder,
  ],
})
export class MeetingAnalysisModule {}
