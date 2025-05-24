import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { RagCoreModule } from '../../rag-core/rag-core.module';
import { WorkflowFrameworkModule } from '../../workflow-framework/workflow-framework.module';
import { EmailAgentsModule } from '../agents/email-agents.module';

// Email-specific workflow services
import { EmailTriageManager } from './email-triage.manager';
import { EmailTriageService } from './email-triage.service';
import { EmailTriageGraphBuilder } from './email-triage-graph.builder';

/**
 * EmailWorkflowModule - Application Services Layer
 * Provides email-specific workflow coordination services
 * Part of Phase 1 of email triage implementation
 * Follows same pattern as MeetingWorkflowModule
 */
@Module({
  imports: [
    InfrastructureModule,    // For database access and events
    RagCoreModule,          // For RAG services (future enhancement)
    WorkflowFrameworkModule, // For supervisor and graph execution
    EmailAgentsModule,       // For email-specific agents
  ],
  providers: [
    EmailTriageManager,     // Coordinates the 3 workers
    EmailTriageService,     // Team handler that registers with supervisor
    EmailTriageGraphBuilder, // Graph-based workflow execution
  ],
  exports: [
    WorkflowFrameworkModule, // Re-export for controllers
    EmailTriageManager,
    EmailTriageService,
    EmailTriageGraphBuilder,
  ],
})
export class EmailWorkflowModule {} 