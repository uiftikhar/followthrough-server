#!/usr/bin/env node

/**
 * Debug script to check if EmailTriageService is being loaded
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function debugStartup() {
  console.log('🔍 Debugging EmailTriageService startup...');
  
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log']
    });
    
    console.log('✅ App created successfully');
    
    // Try to get EmailTriageService directly
    try {
      const emailTriageService = app.get('EmailTriageService');
      console.log('✅ EmailTriageService found:', !!emailTriageService);
      if (emailTriageService) {
        console.log('📋 Team name:', emailTriageService.getTeamName());
        console.log('📋 Team info:', emailTriageService.getTeamInfo());
      }
    } catch (error) {
      console.log('❌ EmailTriageService not found:', error.message);
    }
    
    // Try to get TeamHandlerRegistry
    try {
      const teamHandlerRegistry = app.get('TeamHandlerRegistry');
      console.log('✅ TeamHandlerRegistry found:', !!teamHandlerRegistry);
      
      if (teamHandlerRegistry) {
        const allTeams = teamHandlerRegistry.getAllTeamNames();
        console.log('📋 Registered teams:', allTeams);
        
        // Check if email_triage team is registered
        const emailTriageHandler = teamHandlerRegistry.getHandler('email_triage');
        console.log('📧 Email triage handler registered:', !!emailTriageHandler);
      }
    } catch (error) {
      console.log('❌ TeamHandlerRegistry not found:', error.message);
    }
    
    await app.close();
    console.log('🔚 Debug complete');
    
  } catch (error) {
    console.error('❌ Startup debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugStartup().catch(console.error); 