import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MCPService } from './mcp.service';
import { LangchainMcpAdapter } from './adapters/langchain-adapter';

@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    MCPService,
    LangchainMcpAdapter,
  ],
  exports: [
    MCPService,
    LangchainMcpAdapter,
  ],
})
export class MCPModule {} 