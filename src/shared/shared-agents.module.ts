import { Module } from "@nestjs/common";
import { SharedCoreModule } from "./shared-core.module";

// Shared cross-domain agents
import { MasterSupervisorAgent } from "../langgraph/agents/master-supervisor.agent";
import { AgentFactory } from "../langgraph/agents/agent.factory";

/**
 * SharedAgentsModule
 *
 * Contains agents that are shared across multiple domains:
 * - Master Supervisor Agent (used by all workflows for routing)
 * - Agent Factory (provides centralized agent access)
 *
 * This module is imported by domain-specific modules that need cross-domain agents.
 */
@Module({
  imports: [
    SharedCoreModule, // For base infrastructure services
  ],
  providers: [
    // Cross-domain agents
    MasterSupervisorAgent,
    AgentFactory,
  ],
  exports: [
    // Export shared agents
    MasterSupervisorAgent,
    AgentFactory,
  ],
})
export class SharedAgentsModule {}
