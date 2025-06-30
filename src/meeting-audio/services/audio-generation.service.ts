import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MeetingTranscript, AudioGenerationResult, VoiceAssignment } from '../interfaces/meeting-transcript.interface';
import { TranscriptParserService } from './transcript-parser.service';
import { AudioProcessingService } from './audio-processing.service';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

@Injectable()
export class AudioGenerationService {
  private readonly logger = new Logger(AudioGenerationService.name);
  private elevenlabs: ElevenLabsClient;
  private outputDirectory: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly transcriptParser: TranscriptParserService,
    private readonly audioProcessor: AudioProcessingService,
  ) {
    const apiKey = this.configService.get<string>('audio.elevenlabsApiKey');
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required. Set ELEVENLABS_API_KEY environment variable.');
    }

    this.elevenlabs = new ElevenLabsClient({
      apiKey: apiKey,
    });

    this.outputDirectory = this.configService.get<string>('audio.outputDirectory') || './generated_audio';
    this.ensureOutputDirectory();
  }

  /**
   * Generate audio from raw transcript text
   */
  async generateFromTranscript(
    transcriptText: string,
    meetingId: string,
    meetingType?: string,
    outputFormat: 'mp3' | 'wav' = 'mp3'
  ): Promise<AudioGenerationResult> {
    this.logger.log(`🎙️ Starting audio generation for meeting: ${meetingId}`);
    const startTime = Date.now();

    try {
      // Parse transcript
      this.logger.log(`📝 Parsing transcript for meeting: ${meetingId}`);
      const transcript = await this.transcriptParser.parseTranscript(transcriptText, meetingId, meetingType);

      const result = await this.generateFromParsedTranscript(transcript, outputFormat);
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      if (result.success) {
        this.logger.log(`✅ Total audio generation completed in ${totalTime}s for meeting: ${meetingId}`);
      } else {
        this.logger.error(`❌ Audio generation failed after ${totalTime}s for meeting: ${meetingId}`);
      }
      
      return result;
    } catch (error) {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.error(`💥 Audio generation crashed after ${totalTime}s for meeting: ${meetingId}`, error);
      return {
        success: false,
        error: error.message,
        meeting_id: meetingId,
        generated_at: new Date(),
      };
    }
  }

  /**
   * Generate audio from parsed transcript
   */
  async generateFromParsedTranscript(
    transcript: MeetingTranscript,
    outputFormat: 'mp3' | 'wav' = 'mp3'
  ): Promise<AudioGenerationResult> {
    const startTime = Date.now();
    this.logger.log(`🔄 Generating audio from parsed transcript: ${transcript.meeting_id}`);
    this.logger.log(`📊 Meeting stats: ${transcript.conversation_segments.length} segments, ${transcript.participants.length} speakers, ~${Math.round(transcript.duration_estimate / 60)} minutes`);

    try {
      // Generate audio segments with detailed progress tracking
      const audioSegments = await this.generateAudioSegments(transcript);
      
      if (audioSegments.length === 0) {
        this.logger.error('❌ No audio segments to combine');
        return {
          success: false,
          error: 'No audio segments generated',
          meeting_id: transcript.meeting_id,
          generated_at: new Date(),
        };
      }

      const segmentTime = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`🎵 Generated ${audioSegments.length} audio segments in ${segmentTime}s`);

      // Combine segments
      this.logger.log(`🔗 Starting audio combination for ${audioSegments.length} segments...`);
      const combineStartTime = Date.now();
      
      const outputPath = await this.audioProcessor.combineAudioSegments(
        audioSegments,
        transcript.meeting_id,
        outputFormat
      );

      const combineTime = ((Date.now() - combineStartTime) / 1000).toFixed(2);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      this.logger.log(`🎉 Successfully generated audio: ${outputPath} (${Math.round(transcript.duration_estimate / 60)} minutes)`);
      this.logger.log(`⏱️  Timing breakdown: Segments: ${segmentTime}s, Combine: ${combineTime}s, Total: ${totalTime}s`);

      return {
        success: true,
        audio_file_path: outputPath,
        duration: transcript.duration_estimate,
        meeting_id: transcript.meeting_id,
        generated_at: new Date(),
      };

    } catch (error) {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.error(`💥 Audio generation failed after ${totalTime}s:`, error);
      return {
        success: false,
        error: error.message,
        meeting_id: transcript.meeting_id,
        generated_at: new Date(),
      };
    }
  }

  /**
   * Generate audio segments for each conversation part
   */
  private async generateAudioSegments(transcript: MeetingTranscript): Promise<Array<{
    audioBuffer: Buffer;
    pauseAfter: number;
    speaker: string;
    text: string;
  }>> {
    const segments: Array<{
      audioBuffer: Buffer;
      pauseAfter: number;
      speaker: string;
      text: string;
    }> = [];
    
    const totalSegments = transcript.conversation_segments.length;
    this.logger.log(`🎤 Starting audio segment generation: ${totalSegments} total segments`);
    
    let successCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    let lastProgressLog = 0;

    for (let i = 0; i < totalSegments; i++) {
      const segment = transcript.conversation_segments[i];
      const participant = transcript.participants.find(p => p.name === segment.speaker);
      const segmentStartTime = Date.now();
      
      if (!participant?.voice_id) {
        this.logger.warn(`⚠️  No voice assigned for speaker: ${segment.speaker} (segment ${i + 1}/${totalSegments})`);
        errorCount++;
        continue;
      }

      try {
        // Progress logging every 10 segments or every 30 seconds
        const now = Date.now();
        if (i % 10 === 0 || (now - lastProgressLog) > 30000) {
          const progress = ((i / totalSegments) * 100).toFixed(1);
          const elapsed = ((now - startTime) / 1000).toFixed(1);
          const avgTimePerSegment = i > 0 ? (now - startTime) / i : 0;
          const estimatedRemaining = avgTimePerSegment > 0 ? (((totalSegments - i) * avgTimePerSegment) / 1000).toFixed(0) : '?';
          
          this.logger.log(`📈 Progress: ${i}/${totalSegments} (${progress}%) | Success: ${successCount} | Errors: ${errorCount} | Elapsed: ${elapsed}s | ETA: ${estimatedRemaining}s`);
          lastProgressLog = now;
        }

        this.logger.debug(`🎙️  Generating segment ${i + 1}/${totalSegments}: ${segment.speaker} - "${segment.text.substring(0, 30)}..."`);

        const audioResponse = await this.elevenlabs.textToSpeech.convert(participant.voice_id, {
          text: segment.text,
          modelId: "eleven_multilingual_v2",
          voiceSettings: {
            stability: this.getStabilityForEmotion(segment.emotion),
            similarityBoost: 0.75,
            style: this.getStyleForPace(segment.pace),
            useSpeakerBoost: true,
          },
        });

        // Convert response to buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of audioResponse) {
          chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));

        const segmentTime = Date.now() - segmentStartTime;
        this.logger.debug(`✅ Segment ${i + 1} generated (${(segmentTime / 1000).toFixed(2)}s, ${(audioBuffer.length / 1024).toFixed(1)}KB)`);

        segments.push({
          audioBuffer,
          pauseAfter: segment.pause_after || 1.0,
          speaker: segment.speaker,
          text: segment.text.substring(0, 50) + '...', // For logging
        });

        successCount++;

        // Rate limiting delay with logging
        this.logger.debug(`⏳ Rate limit delay: 100ms`);
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const segmentTime = Date.now() - segmentStartTime;
        errorCount++;
        
        // Enhanced error logging
        if (error.statusCode === 401) {
          this.logger.error(`🔑 Authentication failed for segment ${i + 1} (${segment.speaker}): Invalid API key`);
        } else if (error.statusCode === 429) {
          this.logger.error(`🚦 Rate limit exceeded for segment ${i + 1} (${segment.speaker}): ${error.message}`);
          // Add longer delay for rate limiting
          this.logger.log(`⏳ Extended rate limit delay: 5s`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else if (error.statusCode >= 500) {
          this.logger.error(`🔧 Server error for segment ${i + 1} (${segment.speaker}): ${error.message}`);
        } else {
          this.logger.error(`❌ Failed to generate segment ${i + 1} (${segment.speaker}) after ${(segmentTime / 1000).toFixed(2)}s:`, error.message);
        }
        
        // Continue with other segments
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const successRate = ((successCount / totalSegments) * 100).toFixed(1);
    
    this.logger.log(`🎵 Audio segment generation complete: ${successCount}/${totalSegments} successful (${successRate}%) in ${totalTime}s`);
    
    if (errorCount > 0) {
      this.logger.warn(`⚠️  ${errorCount} segments failed to generate`);
    }
    
    if (successCount === 0) {
      this.logger.error(`💥 No segments generated successfully - check API key and network connection`);
    }
    
    return segments;
  }

  /**
   * Get stability setting based on emotion
   */
  private getStabilityForEmotion(emotion?: string): number {
    switch (emotion) {
      case 'excited':
        return 0.3; // More variation for excitement
      case 'concerned':
        return 0.7; // More stable for concern
      case 'questioning':
        return 0.5; // Medium stability for questions
      case 'positive':
        return 0.4; // Slight variation for positivity
      default:
        return 0.6; // Default stable
    }
  }

  /**
   * Get style setting based on pace
   */
  private getStyleForPace(pace?: string): number {
    switch (pace) {
      case 'fast':
        return 0.3; // More energetic
      case 'slow':
        return 0.1; // More thoughtful
      default:
        return 0.2; // Default neutral
    }
  }

  /**
   * Get available voices from ElevenLabs
   */
  async getAvailableVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await this.elevenlabs.voices.getAll();
      return response.voices.map(voice => ({
        voice_id: voice.voiceId,
        name: voice.name || 'Unknown',
        category: voice.category || 'uncategorized',
        description: voice.description || '',
      }));
    } catch (error) {
      this.logger.error('Failed to fetch available voices:', error);
      return [];
    }
  }

  /**
   * Test voice generation with sample text
   */
  async testVoice(voiceId: string, sampleText: string = "Hello, this is a test of the voice generation system."): Promise<Buffer | null> {
    try {
      const audioResponse = await this.elevenlabs.textToSpeech.convert(voiceId, {
        text: sampleText,
        modelId: "eleven_multilingual_v2",
      });

      const chunks: Uint8Array[] = [];
      for await (const chunk of audioResponse) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    } catch (error) {
      this.logger.error(`Failed to test voice ${voiceId}:`, error);
      return null;
    }
  }

  /**
   * Process transcript file
   */
  async generateFromFile(
    filePath: string,
    outputFormat: 'mp3' | 'wav' = 'mp3'
  ): Promise<AudioGenerationResult> {
    try {
      const transcriptText = await fs.readFile(filePath, 'utf-8');
      const meetingId = path.basename(filePath, path.extname(filePath));
      
      return await this.generateFromTranscript(transcriptText, meetingId, undefined, outputFormat);
    } catch (error) {
      this.logger.error(`Failed to process file ${filePath}:`, error);
      return {
        success: false,
        error: error.message,
        meeting_id: path.basename(filePath),
        generated_at: new Date(),
      };
    }
  }

  /**
   * Batch process multiple transcript files
   */
  async batchGenerate(
    filePaths: string[],
    outputFormat: 'mp3' | 'wav' = 'mp3'
  ): Promise<AudioGenerationResult[]> {
    this.logger.log(`Starting batch generation for ${filePaths.length} files`);
    
    const results: AudioGenerationResult[] = [];
    
    for (const filePath of filePaths) {
      this.logger.log(`Processing file: ${filePath}`);
      const result = await this.generateFromFile(filePath, outputFormat);
      results.push(result);
      
      // Delay between files to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const successful = results.filter(r => r.success).length;
    this.logger.log(`Batch generation complete: ${successful}/${filePaths.length} successful`);
    
    return results;
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create output directory:', error);
    }
  }

  /**
   * Get output directory path
   */
  getOutputDirectory(): string {
    return this.outputDirectory;
  }
} 