# 🎙️ Meeting Audio Generation Module

Generate realistic multi-speaker audio files from meeting transcripts using ElevenLabs AI voices.

## ✨ Features

- **Multi-Speaker Support**: Automatically assigns unique voices to different speakers
- **Natural Conversation Flow**: Intelligent pause detection and emotional tone adaptation
- **Multiple Output Formats**: Generate MP3 or WAV files
- **Batch Processing**: Process multiple transcript files simultaneously
- **RESTful API**: Full HTTP API with Swagger documentation
- **CLI Interface**: Command-line tool for easy batch processing
- **Smart Parsing**: Automatically detects speaker roles, emotions, and pacing
- **Voice Customization**: Override default voice assignments per speaker

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install dependencies (if not already installed)
npm install

# Set up ElevenLabs API key
export ELEVENLABS_API_KEY="your_elevenlabs_api_key_here"

# Optional: Set custom output directory
export AUDIO_OUTPUT_DIR="./custom_audio_output"

# Install FFmpeg (required for audio processing)
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

### 2. Start the Server

```bash
npm run start:dev
```

The meeting audio endpoints will be available at:
- **Base URL**: `http://localhost:3000/meeting-audio`
- **Swagger Docs**: `http://localhost:3000/api#/Meeting%20Audio%20Generation`

### 3. Generate Your First Audio

#### Option A: Using the CLI (Recommended for testing)

```bash
# Single file
npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts -i guides/transcripts/PDP.txt

# Batch process all transcripts
npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts -b -i guides/transcripts

# Generate WAV format
npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts -i transcript.txt -f wav
```

#### Option B: Using the HTTP API

```bash
# Generate from transcript text
curl -X POST http://localhost:3000/meeting-audio/generate-from-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "transcript_text": "[Alex]: Hello team, let'\''s start the meeting.\n[Priya]: Great, I have the updates ready.",
    "meeting_id": "test_meeting_001",
    "meeting_type": "general_meeting",
    "output_format": "mp3"
  }'

# Generate from file
curl -X POST http://localhost:3000/meeting-audio/generate-from-file \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "guides/transcripts/PDP.txt",
    "output_format": "mp3"
  }'
```

## 📝 Transcript Format

Your transcript files should follow this format:

```
[Speaker Name]: What they said goes here.
[Another Speaker]: Their response follows this pattern.
[First Speaker]: You can have multiple exchanges.
```

**Example:**
```
[Alex]: Alright team, let's get started. First up on today's agenda is the new product detail page rollout.
[Priya]: Sure. As of now, we've completed integration of the redesigned PDP in the frontend repo.
[Sofia]: Great. Are we confident this won't disrupt current users if we start enabling it gradually?
```

**Supported Speaker Patterns:**
- `[Alex]:` or `Alex:` 
- Removes role information: `[Alex (Product Manager)]:` → `Alex`
- Handles special characters and spacing

## 🎭 Voice Assignment

### Default Voice Mapping

The system automatically assigns high-quality ElevenLabs voices:

**Male Voices:**
- Alex, Markus, Jamie, Jason, Marcus, Adrian, David, Ethan, Leo, Michael, Tom, Ravi

**Female Voices:**  
- Priya, Sofia, Elena, Rachel, Olivia, Sophia, Maria, Emily, Clara, Julia, Fatima, Nina, Samantha, Mia, Aisha

### Custom Voice Assignment

```bash
curl -X POST http://localhost:3000/meeting-audio/generate-with-custom-voices \
  -H "Content-Type: application/json" \
  -d '{
    "transcript_text": "[Alex]: Hello [Priya]: Hi there",
    "meeting_id": "custom_voices_test",
    "voice_assignments": [
      {
        "speaker_name": "Alex",
        "voice_id": "pMsXgVXv3BLzUgSXRplE",
        "gender": "male"
      },
      {
        "speaker_name": "Priya", 
        "voice_id": "EXAVITQu4vr4xnSDxMaL",
        "gender": "female"
      }
    ]
  }'
```

## 🎵 Audio Processing Features

### Intelligent Emotion Detection

The system automatically detects emotions from text content:

- **Concerned**: Keywords like "urgent", "critical", "problem", "error"
- **Positive**: Keywords like "great", "excellent", "perfect"
- **Excited**: Keywords like "amazing", "incredible", "wonderful"
- **Questioning**: Sentences ending with "?"
- **Neutral**: Default tone

### Smart Pacing

Speaking pace is automatically adjusted:

- **Fast**: For urgent content ("quickly", "asap", "immediate")
- **Slow**: For thoughtful content ("let me think", "hmm", "well")
- **Normal**: Default pace

### Natural Pauses

Intelligent pause calculation:

- **Questions**: 1.5-2.5 seconds for responses
- **Statements**: 0.8-1.5 seconds between thoughts
- **Continuations**: 0.3-1.0 seconds for flow

## 📊 API Endpoints

### Core Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/meeting-audio/generate-from-transcript` | Generate from raw text |
| `POST` | `/meeting-audio/generate-from-file` | Generate from file path |
| `POST` | `/meeting-audio/generate-with-custom-voices` | Generate with voice customization |
| `POST` | `/meeting-audio/batch-generate` | Process multiple files |
| `POST` | `/meeting-audio/upload-and-generate` | Upload file and generate |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/meeting-audio/voices` | List available ElevenLabs voices |
| `POST` | `/meeting-audio/test-voice/:voiceId` | Test specific voice |
| `GET` | `/meeting-audio/status/:meetingId` | Check generation status |
| `GET` | `/meeting-audio/output-directory` | Get output directory |

## 🛠️ Development

### Module Structure

```
src/meeting-audio/
├── cli/                          # Command-line interface
│   └── generate-meeting-audio.ts
├── dto/                          # Data transfer objects
│   └── generate-audio.dto.ts
├── interfaces/                   # TypeScript interfaces
│   └── meeting-transcript.interface.ts
├── services/                     # Core business logic
│   ├── audio-generation.service.ts
│   ├── audio-processing.service.ts
│   └── transcript-parser.service.ts
├── meeting-audio.controller.ts   # HTTP endpoints
├── meeting-audio.module.ts       # NestJS module
└── README.md                     # This documentation
```

### Integration with Existing Project

The module integrates seamlessly with your existing NestJS architecture:

```typescript
// Already integrated in src/app.module.ts
import { MeetingAudioModule } from './meeting-audio/meeting-audio.module';

@Module({
  imports: [
    // ... other modules
    MeetingAudioModule, // ✅ Already added
  ],
})
export class AppModule {}
```

### Configuration

The module uses your existing config system:

```typescript
// In src/config/config.module.ts
audio: {
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
  outputDirectory: process.env.AUDIO_OUTPUT_DIR || "./generated_audio",
}
```

## 🎯 Testing Your Transcripts

### 1. Test Single File
```bash
npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts -i guides/transcripts/PDP.txt
```

### 2. Test All Transcripts
```bash
npx ts-node src/meeting-audio/cli/generate-meeting-audio.ts -b -i guides/transcripts
```

### 3. Expected Output
```
🎙️ Meeting Audio Generator CLI

[12:34:56] Processing single file: guides/transcripts/PDP.txt
[12:34:57] Parsing transcript for meeting: PDP
[12:34:57] Parsed transcript: 67 segments, 6 speakers, ~15 minutes
[12:34:58] Generating 67 audio segments...
[12:35:45] Successfully combined audio segments: ./generated_audio/PDP_meeting.mp3
[12:35:45] ✅ Audio generated successfully: ./generated_audio/PDP_meeting.mp3
[12:35:45]    Duration: 15 minutes
```

## 🔧 Troubleshooting

### Common Issues

**1. ElevenLabs API Key Missing**
```bash
Error: ElevenLabs API key is required. Set ELEVENLABS_API_KEY environment variable.
```
**Solution:** `export ELEVENLABS_API_KEY="your_key_here"`

**2. FFmpeg Not Found**
```bash
Error: FFmpeg not found. Please install FFmpeg.
```
**Solution:** Install FFmpeg using your package manager

**3. Rate Limits**
```bash
Error: Rate limit exceeded
```
**Solution:** The system has built-in delays. For heavy usage, consider upgrading your ElevenLabs plan.

**4. Invalid Transcript Format**
```bash
Error: No valid speaker segments found
```
**Solution:** Ensure transcript follows `[Speaker]: text` format

### Audio Quality Issues

- **Choppy Audio**: Check FFmpeg installation and available disk space
- **Wrong Voices**: Verify speaker names match expected patterns
- **Missing Pauses**: Check transcript parsing - segments need proper punctuation

## 🎵 Integration with Google Meet

### Upload Generated Audio

Once you have generated audio files, you can:

1. **Manual Upload**: Use Google Drive to upload audio files, then share in Meet
2. **Google Meet Recording API**: Upload as meeting recordings (requires additional setup)
3. **Test with Your Calendar Workflow**: Use generated audio to test meeting analysis pipeline

### Example Integration Flow

```typescript
// After generating audio
const result = await audioService.generateFromTranscript(
  transcriptText, 
  meetingId
);

if (result.success) {
  // Upload to Google Drive
  // Trigger calendar workflow
  // Run meeting analysis
}
```

## 📈 Performance & Scaling

### Rate Limits
- **ElevenLabs Free**: 10,000 characters/month
- **ElevenLabs Starter**: 30,000 characters/month  
- **Production**: Consider upgrading for higher limits

### Optimization Tips
- Use batch processing for multiple files
- Cache voice assignments for repeated speakers
- Process during off-peak hours for faster response

### Storage Considerations
- Average meeting: 15-30 minutes → 15-30MB MP3
- Batch processing: Plan for 200-500MB per session
- Consider auto-cleanup of old files

## 🎉 Next Steps

1. **Test with Your Transcripts**: Start with the provided sample transcripts
2. **Customize Voices**: Experiment with different voice assignments
3. **Integrate with Calendar**: Use generated audio to test your meeting analysis workflow
4. **Scale Up**: Move to batch processing once you validate the approach

## 📞 Support

For technical issues:
1. Check the troubleshooting section above
2. Review logs in the console output
3. Verify all prerequisites are installed
4. Test with sample transcripts first

The module is designed to work plug-and-play with your existing transcripts - just add your ElevenLabs API key and start generating realistic meeting audio! 🎙️ 