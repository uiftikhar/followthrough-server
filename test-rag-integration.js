/**
 * Simple test script to verify the RAG integration with Pinecone
 * 
 * Usage: 
 * 1. Make sure your .env file is properly configured with Pinecone credentials
 * 2. Run: node test-rag-integration.js
 */

require('dotenv').config();
const axios = require('axios');
const { OpenAI } = require('openai');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USER_EMAIL = 'test@example.com';
const USER_PASSWORD = 'password123';

// Sample transcript for testing
const SAMPLE_TRANSCRIPT = `
John: Good morning everyone, let's get started with our meeting about the new product launch.
Jane: I've prepared a timeline for the marketing campaign. We should start promotions two weeks before the launch.
John: That sounds good. What about the budget?
Jane: We have allocated $50,000 for the initial marketing push.
Mike: I think we should focus on social media first, then expand to other channels.
John: Agreed. Let's set a follow-up meeting for next Tuesday to review progress.
Jane: I'll prepare a detailed report by then.
Mike: Perfect, I'll coordinate with the design team to finalize the visuals.
John: Great, let's wrap up. Thanks everyone!
`;

// Initialize OpenAI client for embedding testing
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Test functions
async function login() {
  console.log('Logging in...');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });
    
    console.log('Login successful');
    return response.data.access_token;
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    throw error;
  }
}

async function testEmbeddingGeneration() {
  console.log('\nTesting embedding generation...');
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: 'This is a test of the embedding API.',
    });
    
    const embedding = response.data[0].embedding;
    console.log(`✅ Successfully generated embedding with length: ${embedding.length}`);
    return true;
  } catch (error) {
    console.error('❌ Embedding generation failed:', error.message);
    return false;
  }
}

async function testRAGProcessing(token) {
  console.log('\nTesting RAG processing...');
  try {
    const response = await axios.post(
      `${API_URL}/rag-meeting-analysis`,
      {
        transcript: SAMPLE_TRANSCRIPT,
        metadata: {
          title: 'Test Meeting',
          participants: ['John', 'Jane', 'Mike'],
          date: new Date().toISOString(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    console.log('✅ Successfully initiated RAG analysis');
    console.log('Session ID:', response.data.sessionId);
    console.log('RAG was used:', response.data.usedRag);
    
    return response.data.sessionId;
  } catch (error) {
    console.error('❌ RAG processing failed:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    return null;
  }
}

async function testResultRetrieval(token, sessionId) {
  if (!sessionId) {
    console.log('❌ Skipping result retrieval as no sessionId was provided');
    return;
  }
  
  console.log('\nWaiting for analysis to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  
  console.log('Testing result retrieval...');
  try {
    const response = await axios.get(
      `${API_URL}/rag-meeting-analysis/${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    console.log('✅ Successfully retrieved analysis results');
    console.log('Status:', response.data.status);
    
    if (response.data.topics) {
      console.log(`Topics identified: ${response.data.topics.length}`);
    }
    
    if (response.data.actionItems) {
      console.log(`Action items identified: ${response.data.actionItems.length}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Result retrieval failed:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    return null;
  }
}

// Run the tests
async function runTests() {
  console.log('=== RAG Integration Test ===');
  console.log('API URL:', API_URL);
  
  try {
    // Test embedding generation
    const embeddingSuccess = await testEmbeddingGeneration();
    
    if (!embeddingSuccess) {
      console.error('❌ Embedding test failed, skipping further tests');
      return;
    }
    
    // Login
    const token = await login();
    
    if (!token) {
      console.error('❌ Authentication failed, skipping further tests');
      return;
    }
    
    // Test RAG processing
    const sessionId = await testRAGProcessing(token);
    
    if (!sessionId) {
      console.error('❌ RAG processing test failed, skipping result retrieval');
      return;
    }
    
    // Test result retrieval
    const results = await testResultRetrieval(token, sessionId);
    
    if (results) {
      console.log('\n✅ All tests completed successfully!');
    } else {
      console.error('\n❌ Not all tests passed.');
    }
  } catch (error) {
    console.error('Test execution failed:', error.message);
  }
}

// Execute the tests
runTests(); 