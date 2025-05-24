import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RagCoreModule } from '../rag-core/rag-core.module';

// Non-domain-specific agents only
import { ContextIntegrationAgent } from '../langgraph/agents/context-integration.agent';
import { MasterSupervisorAgent } from '../langgraph/agents/master-supervisor.agent';

/**
 * AgentFrameworkModule - Platform Services Layer
 * Provides base agent framework and non-domain-specific agents only
 * Part of Phase 2 migration from SharedCoreModule
 * Domain-specific agents and factories moved to domain modules
 */
@Module({
  imports: [
    LlmModule,
    RagCoreModule,
  ],
  providers: [
    // Non-domain-specific agents only
    ContextIntegrationAgent,
    MasterSupervisorAgent,
    
    // Framework configurations
    {
      provide: 'AGENT_FACTORY_CONFIG',
      useValue: {
        defaultLlmOptions: { model: 'gpt-4o', temperature: 0.3 },
      },
    },
  ],
  exports: [
    ContextIntegrationAgent,
    MasterSupervisorAgent,
  ],
})
export class AgentFrameworkModule {} 