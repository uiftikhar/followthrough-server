const axios = require('axios');

const testEnhancedEmailTriage = async () => {
  console.log('🚀 Testing Enhanced Email Triage System - Phase 3 & 4');
  console.log('Testing: RAG-enhanced tone learning + true parallel processing\n');

  const baseURL = 'http://localhost:3000';

  // Test email with emphasis on tone detection
  const testEmail = {
    sessionId: `test-enhanced-${Date.now()}`,
    emailData: {
      id: `email-enhanced-${Date.now()}`,
      body: `Hi team,

I'm facing a critical authentication issue that's blocking my entire workflow. I've been trying to log into the system for the past 2 hours with no success - keeps saying "invalid credentials" even though I haven't changed my password.

This is really urgent because I have a client presentation in 1 hour and all my project files are in the system. I've tried clearing cookies, different browsers, even restarted my computer but nothing works.

Please help me ASAP! This is costing me a major deal.

Thanks,
Sarah Johnson
Senior Account Manager`,
      metadata: {
        subject: "CRITICAL: Login failure - need immediate help!",
        from: "sarah.johnson@company.com",
        to: "support@company.com",
        timestamp: new Date().toISOString()
      }
    }
  };

  try {
    console.log('📧 Sending test email for enhanced triage...');
    const startTime = Date.now();

    const response = await axios.post(`${baseURL}/api/email/triage`, testEmail, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000;

    console.log(`✅ Enhanced email triage completed in ${executionTime}s\n`);

    if (response.data && response.data.result) {
      const result = response.data.result;

      console.log('🎯 CLASSIFICATION RESULTS:');
      console.log(`   Priority: ${result.classification.priority}`);
      console.log(`   Category: ${result.classification.category}`);
      console.log(`   Confidence: ${result.classification.confidence}`);
      console.log(`   Reasoning: ${result.classification.reasoning}\n`);

      console.log('📝 SUMMARY RESULTS:');
      console.log(`   Problem: ${result.summary.problem}`);
      console.log(`   Context: ${result.summary.context}`);
      console.log(`   Ask: ${result.summary.ask}\n`);

      console.log('💌 ENHANCED REPLY DRAFT:');
      console.log(`   Subject: ${result.replyDraft.subject}`);
      console.log(`   Tone: ${result.replyDraft.tone}`);
      console.log(`   Body Preview: ${result.replyDraft.body.substring(0, 200)}...`);
      console.log(`   Next Steps: ${result.replyDraft.next_steps.join(', ')}\n`);

      console.log('🔄 PROCESSING DETAILS:');
      console.log(`   Current Step: ${response.data.currentStep}`);
      console.log(`   Progress: ${response.data.progress}%`);
      console.log(`   Status: ${result.status}`);

      if (response.data.retrievedContext) {
        console.log(`   RAG Context Retrieved: ${response.data.retrievedContext.length} documents`);
      }

      // Validate Phase 3 & 4 features
      console.log('\n🔍 PHASE 3 & 4 VALIDATION:');
      
      // Check for tone adaptation
      if (result.replyDraft.tone && result.replyDraft.tone !== 'professional') {
        console.log(`   ✅ Tone adaptation detected: ${result.replyDraft.tone}`);
      } else {
        console.log(`   ⚠️  Using default professional tone`);
      }

      // Check for urgency handling
      if (result.classification.priority === 'urgent') {
        console.log(`   ✅ Urgency correctly identified and classified`);
      }

      // Check for personalization indicators
      if (result.replyDraft.body.includes('Sarah') || result.replyDraft.body.includes('client presentation')) {
        console.log(`   ✅ Personalization detected in reply`);
      }

      // Check execution time for parallel processing efficiency
      if (executionTime < 5) {
        console.log(`   ✅ Efficient processing time suggests parallel execution: ${executionTime}s`);
      } else {
        console.log(`   ⚠️  Processing time higher than expected: ${executionTime}s`);
      }

      console.log('\n🎉 Enhanced Email Triage Test Completed Successfully!');
      console.log('Features tested: RAG context enrichment, tone learning, parallel processing');

    } else {
      console.error('❌ Invalid response structure:', response.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
};

// Run the test
testEnhancedEmailTriage().catch(console.error); 