import { Module, OnModuleInit } from '@nestjs/common';
import { ToolService } from './tool.service';

@Module({
  providers: [ToolService],
  exports: [ToolService],
})
export class ToolModule implements OnModuleInit {
  constructor(private readonly toolService: ToolService) {}

  onModuleInit() {
    // Initialize default tools when the module starts
    this.toolService.initializeDefaultTools();
  }
}
