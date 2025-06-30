import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
const ffmpeg = require('fluent-ffmpeg');

interface AudioSegment {
  audioBuffer: Buffer;
  pauseAfter: number;
  speaker: string;
  text: string;
}

@Injectable()
export class AudioProcessingService {
  private readonly logger = new Logger(AudioProcessingService.name);
  private outputDirectory: string;

  constructor(private readonly configService: ConfigService) {
    this.outputDirectory = this.configService.get<string>('audio.outputDirectory') || './generated_audio';
  }

  /**
   * Combine multiple audio segments into a single file
   */
  async combineAudioSegments(
    segments: AudioSegment[],
    meetingId: string,
    outputFormat: 'mp3' | 'wav' = 'mp3'
  ): Promise<string> {
    this.logger.log(`Combining ${segments.length} audio segments for meeting: ${meetingId}`);

    if (segments.length === 0) {
      throw new Error('No audio segments to combine');
    }

    const tempDir = path.join(this.outputDirectory, 'temp', meetingId);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Save individual segments as temporary files
      const tempFiles: string[] = [];
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const tempFile = path.join(tempDir, `segment_${i.toString().padStart(3, '0')}.mp3`);
        await fs.writeFile(tempFile, segment.audioBuffer);
        tempFiles.push(tempFile);
      }

      // Create the final combined audio file
      const outputFile = path.join(this.outputDirectory, `${meetingId}_meeting.${outputFormat}`);
      await this.concatenateAudioFiles(tempFiles, segments, outputFile, outputFormat);

      // Clean up temporary files
      await this.cleanupTempFiles(tempDir);

      this.logger.log(`Successfully combined audio segments: ${outputFile}`);
      return outputFile;

    } catch (error) {
      this.logger.error(`Failed to combine audio segments for ${meetingId}:`, error);
      
      // Clean up on error
      try {
        await this.cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        this.logger.warn('Failed to clean up temp files:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * Concatenate audio files with silence between them using ffmpeg
   */
  private async concatenateAudioFiles(
    inputFiles: string[],
    segments: AudioSegment[],
    outputFile: string,
    outputFormat: 'mp3' | 'wav'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Concatenating ${inputFiles.length} audio files...`);

      const command = ffmpeg();
      
      // Add all input files
      inputFiles.forEach(file => {
        command.input(file);
      });

      // Create filter complex for concatenation with silences
      const filterParts: string[] = [];
      const inputLabels: string[] = [];
      
      for (let i = 0; i < inputFiles.length; i++) {
        const segment = segments[i];
        const pauseDuration = segment.pauseAfter || 1.0;
        
        inputLabels.push(`[${i}:a]`);
        
        if (i < inputFiles.length - 1) {
          // Add silence after each segment except the last
          filterParts.push(`aevalsrc=0:duration=${pauseDuration}[silence${i}]`);
        }
      }

      // Build the concat filter
      let concatFilter = '';
      for (let i = 0; i < inputFiles.length; i++) {
        concatFilter += `[${i}:a]`;
        if (i < inputFiles.length - 1) {
          concatFilter += `[silence${i}]`;
        }
      }
      concatFilter += `concat=n=${inputFiles.length * 2 - 1}:v=0:a=1[out]`;

      // Combine all filters
      const fullFilter = filterParts.join(';') + (filterParts.length > 0 ? ';' : '') + concatFilter;

      command
        .complexFilter(fullFilter)
        .outputOptions(['-map', '[out]'])
        .outputFormat(outputFormat)
        .output(outputFile)
        .on('start', (commandLine) => {
          this.logger.debug(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.debug(`Processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          this.logger.debug('Audio concatenation completed successfully');
          resolve();
        })
        .on('error', (error) => {
          this.logger.error('FFmpeg error:', error);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Simple concatenation fallback (without silence gaps)
   */
  private async simpleConcatenation(
    inputFiles: string[],
    outputFile: string,
    outputFormat: 'mp3' | 'wav'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.debug('Using simple concatenation fallback...');

      const command = ffmpeg();
      
      inputFiles.forEach(file => {
        command.input(file);
      });

      command
        .outputFormat(outputFormat)
        .output(outputFile)
        .on('end', () => {
          this.logger.debug('Simple concatenation completed');
          resolve();
        })
        .on('error', (error) => {
          this.logger.error('Simple concatenation error:', error);
          reject(error);
        });

      // Use concat filter for simple concatenation
      const concatFilter = inputFiles.map((_, i) => `[${i}:a]`).join('') + 
                          `concat=n=${inputFiles.length}:v=0:a=1[out]`;
      
      command
        .complexFilter(concatFilter)
        .outputOptions(['-map', '[out]'])
        .run();
    });
  }

  /**
   * Convert audio format
   */
  async convertAudioFormat(
    inputFile: string,
    outputFormat: 'mp3' | 'wav',
    outputFile?: string
  ): Promise<string> {
    const finalOutputFile = outputFile || inputFile.replace(path.extname(inputFile), `.${outputFormat}`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .outputFormat(outputFormat)
        .output(finalOutputFile)
        .on('end', () => {
          this.logger.debug(`Converted ${inputFile} to ${outputFormat}`);
          resolve(finalOutputFile);
        })
        .on('error', (error) => {
          this.logger.error(`Failed to convert ${inputFile}:`, error);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Get audio file duration
   */
  async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) {
          this.logger.error(`Failed to get duration for ${filePath}:`, error);
          reject(error);
        } else {
          const duration = metadata.format.duration || 0;
          resolve(duration);
        }
      });
    });
  }

  /**
   * Add silence to audio file
   */
  async addSilence(
    inputFile: string,
    silenceDuration: number,
    position: 'start' | 'end' = 'end'
  ): Promise<string> {
    const outputFile = inputFile.replace('.mp3', '_with_silence.mp3');

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputFile);

      if (position === 'start') {
        command
          .complexFilter([
            `aevalsrc=0:duration=${silenceDuration}[silence]`,
            `[silence][0:a]concat=n=2:v=0:a=1[out]`
          ])
          .outputOptions(['-map', '[out]']);
      } else {
        command
          .complexFilter([
            `[0:a]aevalsrc=0:duration=${silenceDuration}[silence]`,
            `[0:a][silence]concat=n=2:v=0:a=1[out]`
          ])
          .outputOptions(['-map', '[out]']);
      }

      command
        .output(outputFile)
        .on('end', () => resolve(outputFile))
        .on('error', reject)
        .run();
    });
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
      await fs.rmdir(tempDir);
      this.logger.debug(`Cleaned up temp directory: ${tempDir}`);
    } catch (error) {
      this.logger.warn(`Failed to clean up temp directory ${tempDir}:`, error);
    }
  }

  /**
   * Validate audio file
   */
  async validateAudioFile(filePath: string): Promise<boolean> {
    try {
      await this.getAudioDuration(filePath);
      return true;
    } catch (error) {
      this.logger.error(`Audio file validation failed for ${filePath}:`, error);
      return false;
    }
  }
} 