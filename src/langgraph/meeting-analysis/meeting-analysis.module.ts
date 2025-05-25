import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module";
import { MeetingWorkflowModule } from "../../meeting/workflow/meeting-workflow.module";
import { AuthModule } from "../../auth/auth.module";
import { MeetingAnalysisController } from "./meeting-analysis.controller";
import { MeetingAnalysisGateway } from "./meeting-analysis.gateway";

/**
 * MeetingAnalysisModule - API Layer
 * Uses the new modular architecture instead of SharedCoreModule
 * Part of Phase 4 migration from SharedCoreModule
 */
@Module({
  imports: [
    InfrastructureModule,
    MeetingWorkflowModule,
    AuthModule, // Keep existing auth
  ],
  controllers: [MeetingAnalysisController],
  providers: [MeetingAnalysisGateway],
  exports: [
    // Export for other modules if needed - services come from MeetingWorkflowModule
  ],
})
export class MeetingAnalysisModule {}
