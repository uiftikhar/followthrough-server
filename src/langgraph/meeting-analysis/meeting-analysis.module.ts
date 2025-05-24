import { Module } from '@nestjs/common';
import { SharedCoreModule } from '../../shared/shared-core.module';
import { MeetingAnalysisController } from './meeting-analysis.controller';
import { MeetingAnalysisService } from './meeting-analysis.service';
import { MeetingAnalysisGateway } from './meeting-analysis.gateway';
import { MeetingAnalysisGraphBuilder } from './meeting-analysis-graph.builder';
import { UnifiedWorkflowService } from '../unified-workflow.service';

/**
 * MeetingAnalysisModule - Contains meeting analysis business logic
 * Only imports SharedCoreModule which provides ALL dependencies
 * Simplified architecture eliminates circular dependencies
 */
@Module({
  imports: [
    SharedCoreModule, // Provides ALL dependencies: services, agents, infrastructure
  ],
  controllers: [MeetingAnalysisController],
  providers: [
    MeetingAnalysisService, 
    MeetingAnalysisGateway,
    MeetingAnalysisGraphBuilder,
    UnifiedWorkflowService,
  ],
  exports: [
    MeetingAnalysisService,
    MeetingAnalysisGraphBuilder,
  ],
})
export class MeetingAnalysisModule {}
