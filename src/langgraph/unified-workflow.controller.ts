import { Body, Controller, Post, Logger, Get, Param } from "@nestjs/common";
import { UnifiedWorkflowService } from "./unified-workflow.service";
import { SessionRepository } from "../database/repositories/session.repository";

interface ProcessInputDto {
  type: "meeting_transcript" | "email";
  transcript?: string;
  email?: {
    from: string;
    subject: string;
    body: string;
  };
  metadata?: Record<string, any>;
  userId?: string;
}

@Controller("unified-workflow")
export class UnifiedWorkflowController {
  private readonly logger = new Logger(UnifiedWorkflowController.name);

  constructor(
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  @Post("process")
  async processInput(@Body() dto: ProcessInputDto) {
    this.logger.log(`Processing unified workflow input of type: ${dto.type}`);

    // Create the input object based on the type
    let input: any;

    if (dto.type === "meeting_transcript") {
      input = {
        type: "meeting_transcript",
        transcript: dto.transcript,
      };
    } else if (dto.type === "email") {
      input = {
        type: "email",
        ...dto.email,
      };
    } else {
      // For unknown input types, preserve the original data but ensure it has a type
      const { type, ...rest } = dto;
      input = {
        type: type || "unknown",
        ...rest,
      };
    }

    const result = await this.unifiedWorkflowService.processInput(
      input,
      dto.metadata,
      dto.userId,
    );

    return result;
  }

  @Get("result/:sessionId")
  async getResult(@Param("sessionId") sessionId: string) {
    this.logger.log(`Getting result for session: ${sessionId}`);

    const session = await this.sessionRepository.getSessionById(sessionId);

    if (!session) {
      return {
        sessionId,
        status: "not_found",
      };
    }

    return {
      sessionId,
      status: session.status,
      createdAt: session.startTime,
      completedAt: session.endTime,
      resultType: session.metadata?.resultType,
      // Include appropriate fields based on result type
      ...(session.transcript && { transcript: session.transcript }),
      ...(session.topics && { topics: session.topics }),
      ...(session.actionItems && { actionItems: session.actionItems }),
      ...(session.sentiment && { sentiment: session.sentiment }),
      ...(session.summary && { summary: session.summary }),
      ...(session.metadata?.emailTriageResult && {
        emailTriageResult: session.metadata.emailTriageResult,
      }),
      errors: session.errors,
    };
  }
}
