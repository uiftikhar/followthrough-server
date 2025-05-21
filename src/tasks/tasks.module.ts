import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MCPModule } from '../mcp/mcp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksService } from './tasks.service';
import { LlmExtractionStrategy } from './strategies/llm-extraction-strategy.service';
import { RuleBasedExtractionStrategy } from './strategies/rule-based-extraction-strategy.service';
import { EmailTaskExtractorService } from './extractors/email-task-extractor.service';
import { ApprovalWorkflowService } from './approval/approval-workflow.service';

@Module({
  imports: [
    ConfigModule,
    MCPModule,
    NotificationsModule,
  ],
  providers: [
    TasksService,
    LlmExtractionStrategy,
    RuleBasedExtractionStrategy,
    EmailTaskExtractorService,
    ApprovalWorkflowService,
  ],
  exports: [
    TasksService,
    EmailTaskExtractorService,
    ApprovalWorkflowService,
  ],
})
export class TasksModule {} 