const axios = require('axios');

// Test the Zapier email webhook functionality
async function testZapierEmailWebhook() {
  console.log('🧪 Testing Zapier Email Webhook Integration...\n');

  const baseURL = 'http://localhost:3000';
  
  // Test data for email processing
  const emailPayload = {
    id: 'test-email-123',
    subject: 'Bug Report: Login issues after recent update',
    from: 'customer@example.com',
    to: 'support@company.com',
    body: `Hi Support Team,

I'm experiencing login issues after your recent update. Every time I try to log in with my credentials, I get an "Authentication failed" error, even though I'm sure my password is correct.

This is preventing me from accessing my account and completing important work. Can you please look into this urgently?

My username is: john.doe@example.com

Thanks,
John Doe`,
    timestamp: new Date().toISOString(),
    headers: {
      'message-id': '<test123@example.com>',
      'reply-to': 'customer@example.com'
    },
    userId: 'zapier-test-user'
  };

  try {
    console.log('📧 Testing email triage through regular endpoint (bypassing Zapier auth)...');
    
    // Test through our regular email triage endpoint first
    const response = await axios.post(`${baseURL}/email/triage`, emailPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('✅ Email triage processing successful!');
      console.log('📊 Results:');
      
      if (response.data.result && response.data.result.classification) {
        console.log(`   Priority: ${response.data.result.classification.priority}`);
        console.log(`   Category: ${response.data.result.classification.category}`);
        console.log(`   Confidence: ${response.data.result.classification.confidence}`);
      }
      
      if (response.data.result && response.data.result.summary) {
        console.log(`   Problem: ${response.data.result.summary.problem}`);
        console.log(`   Ask: ${response.data.result.summary.ask}`);
      }
      
      console.log(`   Session ID: ${response.data.sessionId}`);
    } else {
      console.log('❌ Email triage processing failed:', response.data.error);
    }

  } catch (error) {
    console.log('❌ Request failed:', error.response?.data?.error || error.message);
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n🔚 Test completed');
}

// Run the test
testZapierEmailWebhook().catch(console.error); 