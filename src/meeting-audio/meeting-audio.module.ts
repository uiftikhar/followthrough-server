import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeetingAudioController } from './meeting-audio.controller';
import { AudioGenerationService } from './services/audio-generation.service';
import { TranscriptParserService } from './services/transcript-parser.service';
import { AudioProcessingService } from './services/audio-processing.service';

@Module({
  imports: [ConfigModule],
  controllers: [MeetingAudioController],
  providers: [
    AudioGenerationService,
    TranscriptParserService,
    AudioProcessingService,
  ],
  exports: [
    AudioGenerationService,
    TranscriptParserService,
    AudioProcessingService,
  ],
})
export class MeetingAudioModule {} 