import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  Query, 
  UploadedFile, 
  UseInterceptors,
  Logger,
  BadRequestException,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { AudioGenerationService } from './services/audio-generation.service';
import { TranscriptParserService } from './services/transcript-parser.service';
import {
  GenerateAudioFromTranscriptDto,
  GenerateAudioFromFileDto,
  GenerateAudioWithCustomVoicesDto,
  BatchGenerateAudioDto,
  AudioGenerationStatusDto
} from './dto/generate-audio.dto';
import { AudioGenerationResult } from './interfaces/meeting-transcript.interface';

// Define response interfaces for Swagger
interface ElevenLabsVoiceResponse {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

interface VoiceTestResponse {
  success: boolean;
  message: string;
  audio_size?: number;
}

interface GenerationStatusResponse {
  meeting_id: string;
  status: string;
  audio_file_exists: boolean;
  output_directory: string;
}

interface OutputDirectoryResponse {
  output_directory: string;
}

@ApiTags('Meeting Audio Generation')
@Controller('meeting-audio')
export class MeetingAudioController {
  private readonly logger = new Logger(MeetingAudioController.name);

  constructor(
    private readonly audioGenerationService: AudioGenerationService,
    private readonly transcriptParserService: TranscriptParserService,
  ) {}

  @Post('generate-from-transcript')
  @ApiOperation({ summary: 'Generate audio from raw transcript text' })
  @ApiResponse({ 
    status: 200, 
    description: 'Audio generation initiated successfully',
    schema: {
      type: 'object',
      properties: {
        meeting_id: { type: 'string' },
        audio_file_path: { type: 'string' },
        duration_seconds: { type: 'number' },
        participants: { type: 'array', items: { type: 'string' } },
        output_format: { type: 'string' },
        file_size_bytes: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid transcript data' })
  @HttpCode(HttpStatus.OK)
  async generateFromTranscript(
    @Body() generateDto: GenerateAudioFromTranscriptDto
  ): Promise<AudioGenerationResult> {
    this.logger.log(`Generating audio for meeting: ${generateDto.meeting_id}`);
    
    try {
      const result = await this.audioGenerationService.generateFromTranscript(
        generateDto.transcript_text,
        generateDto.meeting_id,
        generateDto.meeting_type,
        generateDto.output_format
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to generate audio for ${generateDto.meeting_id}:`, error);
      throw new BadRequestException(`Audio generation failed: ${error.message}`);
    }
  }

  @Post('generate-from-file')
  @ApiOperation({ summary: 'Generate audio from transcript file' })
  @ApiResponse({ 
    status: 200, 
    description: 'Audio generation from file completed',
    schema: {
      type: 'object',
      properties: {
        meeting_id: { type: 'string' },
        audio_file_path: { type: 'string' },
        duration_seconds: { type: 'number' },
        participants: { type: 'array', items: { type: 'string' } },
        output_format: { type: 'string' },
        file_size_bytes: { type: 'number' }
      }
    }
  })
  @HttpCode(HttpStatus.OK)
  async generateFromFile(
    @Body() generateDto: GenerateAudioFromFileDto
  ): Promise<AudioGenerationResult> {
    this.logger.log(`Generating audio from file: ${generateDto.file_path}`);
    
    try {
      const result = await this.audioGenerationService.generateFromFile(
        generateDto.file_path,
        generateDto.output_format
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to generate audio from file ${generateDto.file_path}:`, error);
      throw new BadRequestException(`File processing failed: ${error.message}`);
    }
  }

  @Post('generate-with-custom-voices')
  @ApiOperation({ summary: 'Generate audio with custom voice assignments' })
  @ApiResponse({ 
    status: 200, 
    description: 'Audio generation with custom voices completed',
    schema: {
      type: 'object',
      properties: {
        meeting_id: { type: 'string' },
        audio_file_path: { type: 'string' },
        duration_seconds: { type: 'number' },
        participants: { type: 'array', items: { type: 'string' } },
        output_format: { type: 'string' },
        file_size_bytes: { type: 'number' }
      }
    }
  })
  @HttpCode(HttpStatus.OK)
  async generateWithCustomVoices(
    @Body() generateDto: GenerateAudioWithCustomVoicesDto
  ): Promise<AudioGenerationResult> {
    this.logger.log(`Generating audio with custom voices for meeting: ${generateDto.meeting_id}`);
    
    try {
      // Parse transcript first
      const parsedTranscript = await this.transcriptParserService.parseTranscript(
        generateDto.transcript_text,
        generateDto.meeting_id,
        generateDto.meeting_type
      );

      // Apply custom voice assignments if provided
      if (generateDto.voice_assignments && generateDto.voice_assignments.length > 0) {
        for (const assignment of generateDto.voice_assignments) {
          const participant = parsedTranscript.participants.find(p => p.name === assignment.speaker_name);
          if (participant) {
            participant.voice_id = assignment.voice_id;
            participant.gender = assignment.gender || participant.gender;
          }
        }
      }

      // Generate audio from modified transcript
      const result = await this.audioGenerationService.generateFromParsedTranscript(
        parsedTranscript,
        generateDto.output_format
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to generate audio with custom voices for ${generateDto.meeting_id}:`, error);
      throw new BadRequestException(`Audio generation failed: ${error.message}`);
    }
  }

  @Post('batch-generate')
  @ApiOperation({ summary: 'Batch generate audio from multiple transcript files' })
  @ApiResponse({ 
    status: 200, 
    description: 'Batch audio generation completed',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          meeting_id: { type: 'string' },
          audio_file_path: { type: 'string' },
          duration_seconds: { type: 'number' },
          participants: { type: 'array', items: { type: 'string' } },
          output_format: { type: 'string' },
          file_size_bytes: { type: 'number' }
        }
      }
    }
  })
  @HttpCode(HttpStatus.OK)
  async batchGenerate(
    @Body() batchDto: BatchGenerateAudioDto
  ): Promise<AudioGenerationResult[]> {
    this.logger.log(`Starting batch generation for ${batchDto.file_paths.length} files`);
    
    try {
      const results = await this.audioGenerationService.batchGenerate(
        batchDto.file_paths,
        batchDto.output_format
      );

      return results;
    } catch (error) {
      this.logger.error('Batch generation failed:', error);
      throw new BadRequestException(`Batch generation failed: ${error.message}`);
    }
  }

  @Post('upload-and-generate')
  @ApiOperation({ summary: 'Upload transcript file and generate audio' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Transcript file to upload'
        },
        output_format: {
          type: 'string',
          enum: ['mp3', 'wav'],
          description: 'Output audio format'
        }
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadAndGenerate(
    @UploadedFile() file: any,
    @Body('output_format') outputFormat: 'mp3' | 'wav' = 'mp3'
  ): Promise<AudioGenerationResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(`Processing uploaded file: ${file.originalname}`);
    
    try {
      const transcriptText = file.buffer.toString('utf-8');
      const meetingId = file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension
      
      const result = await this.audioGenerationService.generateFromTranscript(
        transcriptText,
        meetingId,
        undefined,
        outputFormat
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to process uploaded file ${file.originalname}:`, error);
      throw new BadRequestException(`File processing failed: ${error.message}`);
    }
  }

  @Get('voices')
  @ApiOperation({ summary: 'Get available ElevenLabs voices' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of available voices',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          voice_id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  })
  async getAvailableVoices(): Promise<ElevenLabsVoiceResponse[]> {
    this.logger.log('Fetching available voices from ElevenLabs');
    
    try {
      const voices = await this.audioGenerationService.getAvailableVoices();
      return voices as ElevenLabsVoiceResponse[];
    } catch (error) {
      this.logger.error('Failed to fetch available voices:', error);
      throw new BadRequestException(`Failed to fetch voices: ${error.message}`);
    }
  }

  @Post('test-voice/:voiceId')
  @ApiOperation({ summary: 'Test a specific voice with sample text' })
  @ApiParam({ name: 'voiceId', description: 'ElevenLabs voice ID to test' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sample_text: {
          type: 'string',
          description: 'Text to synthesize for testing',
          default: 'Hello, this is a test of the voice generation system.'
        }
      }
    }
  })
  @HttpCode(HttpStatus.OK)
  async testVoice(
    @Param('voiceId') voiceId: string,
    @Body('sample_text') sampleText?: string
  ): Promise<VoiceTestResponse> {
    this.logger.log(`Testing voice: ${voiceId}`);
    
    try {
      const audioBuffer = await this.audioGenerationService.testVoice(voiceId, sampleText);
      
      if (audioBuffer) {
        return {
          success: true,
          message: 'Voice test successful',
          audio_size: audioBuffer.length
        };
      } else {
        return {
          success: false,
          message: 'Voice test failed'
        };
      }
    } catch (error) {
      this.logger.error(`Voice test failed for ${voiceId}:`, error);
      throw new BadRequestException(`Voice test failed: ${error.message}`);
    }
  }

  @Get('status/:meetingId')
  @ApiOperation({ summary: 'Check audio generation status for a meeting' })
  @ApiParam({ name: 'meetingId', description: 'Meeting ID to check status for' })
  @ApiResponse({ 
    status: 200, 
    description: 'Meeting audio generation status'
  })
  async getGenerationStatus(
    @Param('meetingId') meetingId: string
  ): Promise<GenerationStatusResponse> {
    this.logger.log(`Checking status for meeting: ${meetingId}`);
    
    try {
      const outputDirectory = this.audioGenerationService.getOutputDirectory();
      // This is a simplified status check - in a real implementation, 
      // you might want to store generation status in a database
      
      return {
        meeting_id: meetingId,
        status: 'ready', // Simplified status
        audio_file_exists: false, // Would need to check file system
        output_directory: outputDirectory
      };
    } catch (error) {
      this.logger.error(`Status check failed for ${meetingId}:`, error);
      throw new BadRequestException(`Status check failed: ${error.message}`);
    }
  }

  @Get('output-directory')
  @ApiOperation({ summary: 'Get the configured output directory for generated audio files' })
  @ApiResponse({ 
    status: 200, 
    description: 'Output directory path',
    schema: {
      type: 'object',
      properties: {
        output_directory: { type: 'string' }
      }
    }
  })
  async getOutputDirectory(): Promise<OutputDirectoryResponse> {
    return {
      output_directory: this.audioGenerationService.getOutputDirectory()
    };
  }
} 