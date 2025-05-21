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
  Inject,
  InternalServerErrorException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RagService } from './rag.service';
import { AnalyzeTranscriptDto } from '../langgraph/meeting-analysis/dto/analyze-transcript.dto';
import { AnalysisResultDto } from '../langgraph/meeting-analysis/dto/analysis-result.dto';
import { MeetingAnalysisService } from '../langgraph/meeting-analysis/meeting-analysis.service';
import { RAG_SERVICE } from './constants/injection-tokens';
import { ConfigService } from '@nestjs/config';
import { MEETING_CHUNK_ANALYSIS_PROMPT } from '../instruction-promtps';

/**
 * Controller for RAG-enhanced meeting analysis endpoints
 */
@ApiTags('RAG Meeting Analysis')
@ApiBearerAuth()
@Controller('rag-meeting-analysis')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
    private readonly meetingAnalysisService: MeetingAnalysisService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('RAG Meeting Analysis Controller initialized');
    this.logger.debug(`Using analysis prompt: ${MEETING_CHUNK_ANALYSIS_PROMPT.substring(0, 50)}...`);
  }

  /**
   * Submit a transcript for RAG-enhanced analysis
   */
  @ApiOperation({ summary: 'Analyze a meeting transcript with RAG enhancement' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'RAG-enhanced analysis initiated successfully',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed'],
        },
        topicCount: { type: 'number' },
        actionItemCount: { type: 'number' },
        usedRag: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.OK)
  @Post()
  async analyzeTranscriptWithRag(@Body() dto: AnalyzeTranscriptDto, @Request() req) {
    try {
      // Extract user ID from JWT token
      const userId = req.user?.userId || req.user?.id || req.user?.sub;
      this.logger.log(`User ID from token: ${userId}`);
      
      this.logger.log(`Received RAG-enhanced transcript analysis request for ${dto.metadata?.title || 'untitled'}`);
      this.logger.debug(`Analysis request metadata: ${JSON.stringify(dto.metadata || {})}`);
      this.logger.debug(`Transcript length: ${dto.transcript.length} characters`);
      
      let ragProcessingSuccessful = false;
      let ragError: Error | null = null;
      
      // Try to index the transcript with RAG, but continue even if it fails
      try {
        this.logger.log('Starting RAG processing for transcript');
        
        const documentId = `transcript-${Date.now()}`;
        const metadata = {
          ...dto.metadata,
          source: 'meeting_transcript',
          processed_date: new Date().toISOString(),
          user_id: userId, // Add user ID to metadata for RAG document
        };
        
        this.logger.debug(`Processing document with ID: ${documentId}`);
        this.logger.debug(`Document metadata: ${JSON.stringify(metadata)}`);
        
        // Check if RAG is enabled
        const ragEnabled = this.configService.get<string>('RAG_ENABLED', 'true') === 'true';
        
        if (ragEnabled) {
          await this.ragService.processDocumentsForRag([
            {
              id: documentId,
              content: dto.transcript,
              metadata,
            },
          ]);
          
          this.logger.log('Successfully processed transcript for RAG');
          ragProcessingSuccessful = true;
        } else {
          this.logger.log('RAG processing is disabled by configuration');
        }
      } catch (error) {
        // Log the error but continue with regular analysis
        this.logger.error(`RAG processing failed but continuing: ${error instanceof Error ? error.message : String(error)}`, {
          error: error instanceof Error ? error.stack : String(error),
          context: 'RAG Processing',
        });
        
        // Store error for response
        if (error instanceof Error) {
          ragError = error;
        } else {
          ragError = new Error(String(error));
        }
        
        // Check for specific dimension mismatch errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('dimension')) {
          this.logger.warn(
            `Detected dimension mismatch error. Check that EMBEDDING_DIMENSIONS (${this.configService.get('EMBEDDING_DIMENSIONS')}) ` +
            `matches your Pinecone index dimensions. Current error: ${errorMessage}`
          );
        }
      }
      
      // Use the meeting analysis service with RAG option enabled
      this.logger.log('Starting RAG-enhanced meeting analysis with transcript');
      
      // Enhanced metadata with RAG indicators
      const enhancedMetadata = {
        ...dto.metadata,
        usedRag: ragProcessingSuccessful,
        ragError: ragError ? {
          message: ragError.message,
          type: ragError.constructor.name
        } : null,
        ragProcessingTime: Date.now()
      };
      
      // Call the analysis service with RAG flag enabled
      const result = await this.meetingAnalysisService.analyzeTranscript(
        dto.transcript,
        enhancedMetadata,
        userId, // Pass the user ID to the service
      );
      
      this.logger.log(`RAG-enhanced analysis initiated with session ID: ${result.sessionId}`);
      
      return {
        ...result,
        usedRag: ragProcessingSuccessful,
        ragError: ragError ? {
          message: ragError.message,
          type: ragError.constructor.name
        } : null
      };
    } catch (error) {
      this.logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`, {
        error: error instanceof Error ? error.stack : String(error),
        context: 'Transcript Analysis',
      });
      throw new InternalServerErrorException(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get RAG-enhanced analysis results by session ID
   */
  @ApiOperation({ summary: 'Get RAG-enhanced analysis results by session ID' })
  @ApiParam({ name: 'sessionId', description: 'Unique session identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'RAG-enhanced analysis results retrieved successfully',
    type: AnalysisResultDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get(':sessionId')
  async getRagAnalysisResults(@Param('sessionId') sessionId: string, @Request() req) {
    this.logger.log(`Retrieving RAG-enhanced analysis results for session ${sessionId}`);
    
    try {
      // Extract user ID from JWT token
      const userId = req.user?.userId || req.user?.id || req.user?.sub;
      this.logger.log(`User ID from token: ${userId}`);
      
      // Get results with user ID verification
      const results = await this.meetingAnalysisService.getAnalysisResults(sessionId, userId);
      
      this.logger.log(`Successfully retrieved results for session ${sessionId}`);
      this.logger.debug(`Analysis status: ${results.status}`);
      
      // Safe property access using optional chaining and type checking
      if (results && 'topics' in results && Array.isArray(results.topics)) {
        this.logger.debug(`Found ${results.topics.length} topics in analysis`);
      }
      
      if (results && 'actionItems' in results && Array.isArray(results.actionItems)) {
        this.logger.debug(`Found ${results.actionItems.length} action items in analysis`);
      }
      
      // Always wrap the results in a consistent format
      return {
        sessionId,
        status: results.status,
        createdAt: results.createdAt,
        completedAt: results.completedAt,
        results: {
          ...results,
          // Clean any circular references
          sessionId: undefined,
          createdAt: undefined,
          completedAt: undefined
        }
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve analysis results for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, {
        error: error instanceof Error ? error.stack : String(error),
        context: 'Get Analysis Results',
      });
      throw error; // Let the exception filter handle the error
    }
  }
} 