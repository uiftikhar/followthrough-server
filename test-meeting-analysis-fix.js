/**
 * Test script to validate meeting analysis graph execution fix
 * This script tests the POST /api/meeting-analysis endpoint to ensure 
 * the "No edge found from node __start__" error is resolved
 */

const fetch = require('node-fetch');

const ENDPOINT = 'http://localhost:3000/api/meeting-analysis';
const TEST_TRANSCRIPT = `
[Alex]: Alright team, let's get started. First up, we need to discuss the Q4 roadmap priorities.

[Sarah]: Thanks Alex. I've been working on the user feedback analysis, and we're seeing strong demand for mobile optimization.

[Mike]: That aligns with what I'm seeing in the analytics. Mobile traffic is up 40% this quarter.

[Alex]: Good insights. Sarah, can you prepare a detailed mobile optimization proposal by Friday?

[Sarah]: Absolutely, I'll have that ready for review.

[Mike]: I'll provide the supporting analytics data by Thursday to help with the proposal.

[Alex]: Perfect. Mike, also please investigate the performance issues we discussed last week.

[Mike]: Will do. I'll set up monitoring and have a report ready by next Tuesday.

[Alex]: Great. Let's also touch base on the budget allocation for Q1. Sarah, have you had a chance to review the numbers?

[Sarah]: I have, and I think we should increase the marketing budget by 15% to support the mobile push.

[Alex]: That sounds reasonable. Can you put together a budget breakdown?

[Sarah]: Sure, I'll have that ready by Monday.

[Alex]: Excellent. Any other items? No? Great, let's wrap up. Thanks everyone!
`;

async function testMeetingAnalysis() {
  try {
    console.log('🧪 Testing Meeting Analysis Fix...');
    console.log('📋 Transcript length:', TEST_TRANSCRIPT.length, 'characters');
    
    // Create test payload
    const payload = {
      transcript: TEST_TRANSCRIPT,
      metadata: {
        title: "Q4 Roadmap Planning Meeting",
        participants: ["Alex", "Sarah", "Mike"],
        useRag: true
      }
    };

    console.log('\n🚀 Sending request to:', ENDPOINT);
    console.log('📦 Payload size:', JSON.stringify(payload).length, 'bytes');
    
    const startTime = Date.now();
    
    // Make the request
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Adjust as needed
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;
    console.log('\n⏱️  Response time:', responseTime, 'ms');
    console.log('📊 Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('\n✅ Response received successfully!');
    console.log('📋 Session ID:', result.sessionId);
    console.log('📈 Status:', result.status);
    
    if (result.sessionId) {
      console.log('\n🔄 Polling for results...');
      await pollForResults(result.sessionId);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('📋 Stack trace:', error.stack);
    return false;
  }
}

async function pollForResults(sessionId, maxAttempts = 10) {
  const pollUrl = `http://localhost:3000/api/meeting-analysis/${sessionId}/results`;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`📊 Polling attempt ${attempt}/${maxAttempts}...`);
      
      const response = await fetch(pollUrl, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('📈 Status:', result.status);
        
        if (result.status === 'completed') {
          console.log('\n🎉 Analysis completed successfully!');
          console.log('📊 Results summary:');
          console.log('  📝 Topics:', result.results?.topics?.length || 0);
          console.log('  ✅ Action Items:', result.results?.actionItems?.length || 0);
          console.log('  📝 Summary:', result.results?.summary ? 'Generated' : 'Not generated');
          console.log('  💭 Sentiment:', result.results?.sentiment ? 'Analyzed' : 'Not analyzed');
          
          // Check for the previous error
          if (result.results?.error?.message?.includes('No edge found from node __start__')) {
            console.log('❌ CRITICAL: The graph edge error is still present!');
            console.log('🔧 Error details:', result.results.error);
            return false;
          } else {
            console.log('✅ SUCCESS: No graph edge errors detected!');
            return true;
          }
        } else if (result.status === 'failed') {
          console.log('❌ Analysis failed');
          console.log('🔧 Error details:', result.results?.error || 'No error details');
          return false;
        } else {
          console.log('⏳ Still processing, waiting 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        console.log('⚠️  Polling request failed:', response.status);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log('⚠️  Polling error:', error.message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('⏰ Polling timeout reached');
  return false;
}

// Run the test
console.log('🔧 Meeting Analysis Graph Fix Validation');
console.log('='.repeat(40));

testMeetingAnalysis()
  .then(success => {
    if (success) {
      console.log('\n🎉 All tests passed! The graph execution fix is working correctly.');
      process.exit(0);
    } else {
      console.log('\n❌ Tests failed! The graph execution still has issues.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Test script crashed:', error);
    process.exit(1);
  }); 