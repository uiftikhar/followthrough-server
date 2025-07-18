import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
  ValidationPipe,
  UsePipes,
  HttpStatus,
  HttpCode,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { AnalyzeTranscriptDto } from "./dto/analyze-transcript.dto";
import { AnalysisResultDto } from "./dto/analysis-result.dto";
import { UnifiedWorkflowService } from "../unified-workflow.service";

/**
 * Controller for meeting analysis endpoints
 */
@ApiTags("Meeting Analysis")
@ApiBearerAuth()
@Controller("api/meeting-analysis")
export class MeetingAnalysisController {
  private readonly logger = new Logger(MeetingAnalysisController.name);

  constructor(
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
  ) {}

  /**
   * Submit a transcript for analysis
   */
  @ApiOperation({ summary: "Analyze a meeting transcript" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Analysis initiated successfully",
    schema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed", "failed"],
        },
        topicCount: { type: "number" },
        actionItemCount: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: "Unauthorized" })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "Internal server error",
  })
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.OK)
  @Post()
  async analyzeTranscript(@Body() dto: AnalyzeTranscriptDto, @Request() req) {
    this.logger.log("Received transcript analysis request");
    // Extract user ID from JWT token
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`User ID from token: ${userId}`);

    // Prepare input for unified workflow
    const input = {
      type: "meeting_transcript",
      transcript: dto.transcript,
      participants: dto.metadata?.participants || [],
      meetingTitle:
        dto.metadata?.title || dto.metadata?.meetingTitle || "Untitled Meeting",
      date: dto.metadata?.date || new Date().toISOString(),
    };

    this.logger.log(
      `Preparing input for unified workflow: ${JSON.stringify({
        type: input.type,
        transcriptLength: input.transcript?.length || 0,
        hasMetadata: !!dto.metadata,
      })}`,
    );

    return this.unifiedWorkflowService.processInput(
      input,
      dto.metadata,
      userId,
    );
  }

  /**
   * Get analysis results by session ID
   */
  @ApiOperation({ summary: "Get analysis results by session ID" })
  @ApiParam({ name: "sessionId", description: "Unique session identifier" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Analysis results retrieved successfully",
    type: AnalysisResultDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Session not found",
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: "Unauthorized" })
  @UseGuards(JwtAuthGuard)
  @Get(":sessionId")
  async getAnalysisResults(
    @Param("sessionId") sessionId: string,
    @Request() req,
  ) {
    this.logger.log(`Retrieving analysis results for session ${sessionId}`);
    // Extract user ID from JWT token
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`User ID from token: ${userId}`);

    try {
      // Try to get results using the unified workflow service
      return await this.unifiedWorkflowService.getResults(sessionId, userId);
    } catch (error) {
      this.logger.warn(
        `Error retrieving results from unified workflow service: ${error.message}`,
      );
      throw error;
    }
  }
}
