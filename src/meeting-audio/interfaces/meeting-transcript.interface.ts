export interface MeetingParticipant {
  name: string;
  role: string;
  voice_id?: string;
  personality?: string;
  gender?: 'male' | 'female';
}

export interface ConversationSegment {
  timestamp: string;
  speaker: string;
  text: string;
  emotion?: 'neutral' | 'positive' | 'concerned' | 'questioning' | 'excited';
  pace?: 'slow' | 'normal' | 'fast';
  pause_after?: number;
  word_count?: number;
  estimated_duration?: number;
}

export interface MeetingTranscript {
  meeting_id: string;
  meeting_type: 'product_planning' | 'bug_triage' | 'design_review' | 'sprint_planning' | 'general_meeting' | 'cross_team_refinement';
  duration_estimate: number;
  participants: MeetingParticipant[];
  conversation_segments: ConversationSegment[];
  metadata?: {
    source_file?: string;
    generated_at?: Date;
    audio_file_path?: string;
    total_speakers?: number;
  };
}

export interface AudioGenerationResult {
  success: boolean;
  audio_file_path?: string;
  duration?: number;
  error?: string;
  meeting_id: string;
  generated_at: Date;
}

export interface VoiceAssignment {
  speaker_name: string;
  voice_id: string;
  voice_name: string;
  gender: 'male' | 'female';
} 