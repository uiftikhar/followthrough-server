import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MeetingAnalysisController } from './meeting-analysis.controller';
import { MeetingAnalysisService } from './meeting-analysis.service';
import { MeetingAnalysisGateway } from './meeting-analysis.gateway';
import { GraphModule } from '../graph/graph.module';
import { StateModule } from '../state/state.module';
import { AgentModule } from '../agents/agent.module';
import { SupervisorModule } from '../agents/supervisor/supervisor.module';
import { TeamModule } from '../agents/team/team.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    GraphModule,
    StateModule,
    AgentModule,
    SupervisorModule,
    TeamModule,
    DatabaseModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [MeetingAnalysisController],
  providers: [MeetingAnalysisService, MeetingAnalysisGateway],
  exports: [MeetingAnalysisService],
})
export class MeetingAnalysisModule {}
