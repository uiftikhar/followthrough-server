#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, Module } from '@nestjs/common';
import { MeetingAudioModule } from '../meeting-audio.module';
import { ConfigModule as AppConfigModule } from '../../config/config.module';
import { AudioGenerationService } from '../services/audio-generation.service';
import * as fs from 'fs/promises';
import * as path from 'path';

// CLI-specific module that includes proper config
@Module({
  imports: [
    AppConfigModule, // Use the app's config module with environment variables
    MeetingAudioModule,
  ],
})
class MeetingAudioCliModule {}

/**
 * Standalone CLI script for generating meeting audio
 * Usage: npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts [options]
 */

interface CliOptions {
  input?: string;
  output?: string;
  format?: 'mp3' | 'wav';
  batch?: boolean;
  help?: boolean;
}

class MeetingAudioCLI {
  private readonly logger = new Logger(MeetingAudioCLI.name);
  private audioService: AudioGenerationService;

  async bootstrap() {
    // Create minimal NestJS application with proper config
    const app = await NestFactory.createApplicationContext(MeetingAudioCliModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Verify configuration is loaded
    const configService = app.get(ConfigService);
    const apiKey = configService.get('audio.elevenlabsApiKey');
    
    if (!apiKey) {
      this.logger.error('❌ ElevenLabs API key not found. Make sure ELEVENLABS_API_KEY environment variable is set.');
      process.exit(1);
    }
    
    this.logger.log('✅ Configuration loaded successfully');
    this.audioService = app.get(AudioGenerationService);
    return app;
  }

  async run() {
    const args = process.argv.slice(2);
    const options = this.parseArgs(args);

    if (options.help || args.length === 0) {
      this.printHelp();
      return;
    }

    const app = await this.bootstrap();

    try {
      if (options.batch) {
        await this.runBatch(options);
      } else {
        await this.runSingle(options);
      }
    } catch (error) {
      this.logger.error('CLI execution failed:', error);
      process.exit(1);
    } finally {
      await app.close();
    }
  }

  private parseArgs(args: string[]): CliOptions {
    const options: CliOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '-i':
        case '--input':
          options.input = nextArg;
          i++;
          break;
        case '-o':
        case '--output':
          options.output = nextArg;
          i++;
          break;
        case '-f':
        case '--format':
          options.format = nextArg as 'mp3' | 'wav';
          i++;
          break;
        case '-b':
        case '--batch':
          options.batch = true;
          break;
        case '-h':
        case '--help':
          options.help = true;
          break;
      }
    }

    return options;
  }

  private async runSingle(options: CliOptions) {
    if (!options.input) {
      throw new Error('Input file path is required. Use -i or --input flag.');
    }

    const startTime = Date.now();
    this.logger.log(`🎙️ Processing single file: ${options.input}`);
    this.logger.log(`⏱️  Started at: ${new Date().toLocaleTimeString()}`);

    const result = await this.audioService.generateFromFile(
      options.input,
      options.format || 'mp3'
    );

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    if (result.success) {
      this.logger.log(`✅ Audio generated successfully: ${result.audio_file_path}`);
      this.logger.log(`   Duration: ${Math.round((result.duration || 0) / 60)} minutes`);
      this.logger.log(`   Processing time: ${totalTime}s`);
      this.logger.log(`   Finished at: ${new Date().toLocaleTimeString()}`);
    } else {
      this.logger.error(`❌ Audio generation failed after ${totalTime}s: ${result.error}`);
      process.exit(1);
    }
  }

  private async runBatch(options: CliOptions) {
    const inputDir = options.input || './guides/transcripts';
    
    this.logger.log(`Scanning directory for transcript files: ${inputDir}`);

    try {
      const files = await fs.readdir(inputDir);
      const transcriptFiles = files
        .filter(file => file.endsWith('.txt'))
        .map(file => path.join(inputDir, file));

      if (transcriptFiles.length === 0) {
        this.logger.warn('No transcript files found in input directory');
        return;
      }

      this.logger.log(`Found ${transcriptFiles.length} transcript files`);

      const results = await this.audioService.batchGenerate(
        transcriptFiles,
        options.format || 'mp3'
      );

      // Summary
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      this.logger.log('\n📊 Batch Processing Summary:');
      this.logger.log(`   ✅ Successful: ${successful}`);
      this.logger.log(`   ❌ Failed: ${failed}`);
      this.logger.log(`   📁 Total: ${results.length}`);

      // List successful files
      if (successful > 0) {
        this.logger.log('\n🎵 Generated Audio Files:');
        results
          .filter(r => r.success)
          .forEach(r => {
            this.logger.log(`   📄 ${r.meeting_id} → ${r.audio_file_path}`);
          });
      }

      // List failed files
      if (failed > 0) {
        this.logger.log('\n⚠️  Failed Files:');
        results
          .filter(r => !r.success)
          .forEach(r => {
            this.logger.log(`   ❌ ${r.meeting_id}: ${r.error}`);
          });
      }

    } catch (error) {
      this.logger.error(`Failed to process batch directory ${inputDir}:`, error);
      throw error;
    }
  }

  private printHelp() {
    console.log(`
🎙️  Meeting Audio Generator CLI

USAGE:
  npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts [options]

OPTIONS:
  -i, --input <path>     Input file or directory path
  -o, --output <path>    Output directory (optional)
  -f, --format <format>  Output format: mp3 or wav (default: mp3)
  -b, --batch            Process all .txt files in input directory
  -h, --help             Show this help message

EXAMPLES:
  # Generate audio from single transcript
  npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts -i guides/transcripts/PDP.txt

  # Batch process all transcripts
  npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts -b -i guides/transcripts

  # Generate WAV format
  npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts -i transcript.txt -f wav

PREREQUISITES:
  1. Set ELEVENLABS_API_KEY environment variable
  2. Install dependencies: npm install
  3. Ensure FFmpeg is installed for audio processing

ENVIRONMENT VARIABLES:
  ELEVENLABS_API_KEY     Your ElevenLabs API key (required)
  AUDIO_OUTPUT_DIR       Output directory (default: ./generated_audio)
    `);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new MeetingAudioCLI();
  cli.run().catch(error => {
    console.error('CLI failed:', error);
    process.exit(1);
  });
}

export { MeetingAudioCLI }; 