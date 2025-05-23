// Test script for RAG-enabled meeting analysis

const axios = require('axios');
const fs = require('fs');

// Configuration
const API_URL = 'http://localhost:3000/api/meeting-analysis';
const TRANSCRIPT_PATH = './data/sample-transcript.txt';
const AUTH_TOKEN = 'your-auth-token'; // Replace with actual token

// Sample transcript if file doesn't exist
const SAMPLE_TRANSCRIPT = `
John: Good morning everyone. Let's start our weekly project status meeting.
Sarah: Hi team, I've completed the frontend components we discussed last week.
Michael: Great work Sarah. I've been working on the API integration but ran into some issues with authentication.
John: What kind of issues, Michael?
Michael: The OAuth flow isn't working correctly. I think we need to update our client credentials.
Sarah: I can help you with that after this meeting.
John: That would be great. Let's make sure we resolve that by tomorrow.
Emily: I've been testing the latest build and found a few UI bugs that need attention.
John: Can you create tickets for those bugs, Emily?
Emily: Already done. I've assigned them to the appropriate team members.
John: Perfect. Any other updates or blockers?
Sarah: We should discuss the timeline for the next release.
John: Good point. Let's aim for next Friday. Everyone okay with that?
Michael: Sounds reasonable to me.
Emily: I agree.
John: Great. Let's wrap up then. Thanks everyone.
`;

// Create sample transcript file if it doesn't exist
if (!fs.existsSync(TRANSCRIPT_PATH)) {
  const dir = './data';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TRANSCRIPT_PATH, SAMPLE_TRANSCRIPT);
  console.log(`Created sample transcript file at ${TRANSCRIPT_PATH}`);
}

// Read transcript
const transcript = fs.readFileSync(TRANSCRIPT_PATH, 'utf8');

// Analyze meeting with RAG - RAG is now always enabled
async function analyzeMeetingWithRAG() {
  try {
    console.log('Submitting transcript for analysis with enhanced RAG capabilities...');
    
    const response = await axios.post(
      API_URL,
      {
        transcript,
        metadata: {
          title: 'Weekly Project Status Meeting',
          // RAG is now always enabled in our implementation
          participants: ['John', 'Sarah', 'Michael', 'Emily'],
          date: new Date().toISOString()
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    console.log('Analysis initiated successfully!');
    console.log('Session ID:', response.data.sessionId);
    console.log('Status:', response.data.status);
    
    // Poll for results
    await pollForResults(response.data.sessionId);
    
  } catch (error) {
    console.error('Error analyzing meeting:', error.response?.data || error.message);
  }
}

// Poll for analysis results
async function pollForResults(sessionId) {
  console.log('\nPolling for results...');
  
  let completed = false;
  let attempts = 0;
  const maxAttempts = 20; // Maximum polling attempts
  
  while (!completed && attempts < maxAttempts) {
    try {
      attempts++;
      const response = await axios.get(`${API_URL}/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });
      
      const result = response.data;
      
      console.log(`\nStatus: ${result.status} (Progress: ${result.progress}%)`);
      
      if (result.status === 'completed' || result.status === 'failed') {
        completed = true;
        
        if (result.status === 'completed') {
          console.log('\n=== RAG-ENHANCED ANALYSIS RESULTS ===');
          console.log('\nTopics:', JSON.stringify(result.topics, null, 2));
          console.log('\nAction Items:', JSON.stringify(result.actionItems, null, 2));
          console.log('\nSummary:', JSON.stringify(result.summary, null, 2));
          console.log('\nSentiment:', JSON.stringify(result.sentiment, null, 2));
          
          // Display RAG context information
          console.log('\n=== RAG CONTEXT INFORMATION ===');
          if (result.context?.retrievedContext?.documents) {
            const documents = result.context.retrievedContext.documents;
            console.log('Number of relevant documents retrieved:', documents.length);
            
            documents.forEach((doc, index) => {
              console.log(`\nDocument ${index + 1}:`);
              console.log('  Source:', doc.metadata?.meetingTitle || doc.metadata?.source || 'Unknown');
              console.log('  Relevance score:', doc.score ? `${(doc.score * 100).toFixed(1)}%` : 'Unknown');
              console.log('  Content sample:', doc.content.substring(0, 100) + '...');
            });
          } else {
            console.log('No RAG context information available');
          }
        } else {
          console.log('\nAnalysis failed:', result.errors);
        }
      } else {
        console.log('Waiting for analysis to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      }
    } catch (error) {
      console.error('Error polling for results:', error.response?.data || error.message);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds on error
    }
  }
  
  if (!completed) {
    console.log(`\nMax polling attempts (${maxAttempts}) reached. Please check the status manually.`);
  }
}

// Run the test
analyzeMeetingWithRAG(); 