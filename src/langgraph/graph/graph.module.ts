import { Module } from '@nestjs/common';
import { GraphService } from './graph.service';
import { StateModule } from '../state/state.module';
import { AgentModule } from '../agents/agent.module';
import { SupervisorModule } from '../agents/supervisor/supervisor.module';

@Module({
  imports: [StateModule, AgentModule, SupervisorModule],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
