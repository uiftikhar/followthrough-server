const axios = require('axios');
const fs = require('fs');

// Configuration
const API_URL = 'http://localhost:3000/unified-workflow';
const TRANSCRIPT_PATH = './data/test-transcript.txt';

// Sample transcript (in case the file doesn't exist)
const SAMPLE_TRANSCRIPT = `
John: Good morning, everyone. Let's begin our meeting.
Sarah: I've prepared the quarterly report. We've seen a 15% increase in sales.
John: That's great news. What about the new product launch?
Mike: We're on track for a July release. The development team is making good progress.
Sarah: I'll need to coordinate with marketing on the launch campaign.
John: Excellent. Mike, can you prepare a detailed timeline by next Friday?
Mike: Sure, I'll have it ready.
John: Let's wrap up. Our next meeting will be on Tuesday at 10 AM.
`;

// Sample email
const SAMPLE_EMAIL = {
  from: 'client@example.com',
  subject: 'Urgent: Question about the new service',
  body: `
    Hello,
    
    I recently signed up for your new service, but I'm having trouble accessing the dashboard.
    Is there a specific browser I should be using?
    
    This is quite urgent as I need to prepare a presentation for tomorrow.
    
    Thanks,
    John Client
  `
};

async function runTest() {
  console.log('Starting unified workflow test...');
  
  // Ensure we have a transcript file or create one
  if (!fs.existsSync(TRANSCRIPT_PATH)) {
    console.log('Creating sample transcript file...');
    fs.writeFileSync(TRANSCRIPT_PATH, SAMPLE_TRANSCRIPT);
  }
  
  const transcript = fs.readFileSync(TRANSCRIPT_PATH, 'utf-8');
  
  // Test with meeting transcript
  console.log('\n--- Testing with meeting transcript ---');
  const transcriptResult = await axios.post(`${API_URL}/process`, {
    type: 'meeting_transcript',
    transcript,
    metadata: {
      meetingTitle: 'Quarterly Review',
      participants: ['John', 'Sarah', 'Mike'],
    }
  });
  
  console.log('Session created:', transcriptResult.data);
  const transcriptSessionId = transcriptResult.data.sessionId;
  
  // Test with email
  console.log('\n--- Testing with email ---');
  const emailResult = await axios.post(`${API_URL}/process`, {
    type: 'email',
    email: SAMPLE_EMAIL,
    metadata: {
      priority: 'high',
      category: 'support',
    }
  });
  
  console.log('Session created:', emailResult.data);
  const emailSessionId = emailResult.data.sessionId;
  
  // Poll for results (meeting transcript)
  console.log('\n--- Polling for meeting analysis results ---');
  await pollForResults(transcriptSessionId);
  
  // Poll for results (email)
  console.log('\n--- Polling for email triage results ---');
  await pollForResults(emailSessionId);
}

async function pollForResults(sessionId, attempts = 10, interval = 3000) {
  for (let i = 0; i < attempts; i++) {
    console.log(`Checking results (attempt ${i + 1}/${attempts})...`);
    
    try {
      const response = await axios.get(`${API_URL}/result/${sessionId}`);
      const result = response.data;
      
      console.log(`Status: ${result.status}`);
      
      if (result.status === 'completed') {
        console.log('Results:', JSON.stringify(result, null, 2));
        return;
      } else if (result.status === 'failed') {
        console.error('Workflow failed:', result.errors);
        return;
      }
      
      // If still in progress, wait and try again
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      console.error('Error polling for results:', error.message);
      return;
    }
  }
  
  console.log('Max polling attempts reached. Results may not be ready yet.');
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error.message);
}); 