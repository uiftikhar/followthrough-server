import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { AgentFrameworkModule } from "../agent-framework/agent-framework.module";
import { LanggraphCoreModule } from "../langgraph/core/core.module";
import { SharedCoreModule } from "src/shared/shared-core.module";

// Only workflow framework services (not duplicating LanggraphCore services)
import { UnifiedWorkflowService } from "../langgraph/unified-workflow.service";

/**
 * WorkflowFrameworkModule - Platform Services Layer
 * Provides workflow coordination services and re-exports LanggraphCoreModule
 * Part of Phase 2 migration from SharedCoreModule
 * Uses LanggraphCoreModule instead of duplicating its services
 */
@Module({
  imports: [
    InfrastructureModule,
    LanggraphCoreModule, // Use existing core services
    AgentFrameworkModule,
    SharedCoreModule
  ],
  providers: [
    UnifiedWorkflowService, // Only framework-level services
  ],
  exports: [
    LanggraphCoreModule, // Re-export core services
    UnifiedWorkflowService,
  ],
})
export class WorkflowFrameworkModule {}
