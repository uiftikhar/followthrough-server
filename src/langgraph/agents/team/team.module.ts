import { Module } from '@nestjs/common';
import { AgentModule } from '../agent.module';
import { SupervisorModule } from '../supervisor/supervisor.module';
import { TeamFormationService } from './team-formation.service';

@Module({
  imports: [AgentModule, SupervisorModule],
  providers: [TeamFormationService],
  exports: [TeamFormationService],
})
export class TeamModule {}
