import { Module } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module';
import { AgentModule } from '../agent.module';
import { SupervisorAgent } from './supervisor.agent';

@Module({
  imports: [LlmModule, AgentModule],
  providers: [SupervisorAgent],
  exports: [SupervisorAgent],
})
export class SupervisorModule {}
