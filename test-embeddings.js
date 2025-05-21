/**
 * Simple script to test the embedding implementation
 */

// Require the compiled test file from the dist directory
const path = require('path');
const { spawn } = require('child_process');

console.log('Building the project first...');
const build = spawn('npm', ['run', 'build'], {
  cwd: process.cwd(),
  stdio: 'inherit',
});

build.on('close', (code) => {
  if (code !== 0) {
    console.error('Build failed');
    process.exit(code);
  }
  
  console.log('Running embedding tests...');
  
  try {
    // Try to require the compiled test file
    const { testEmbeddings } = require('./dist/embedding/embedding.spec');
    
    testEmbeddings()
      .then(() => {
        console.log('Tests completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Tests failed:', error);
        process.exit(1);
      });
  } catch (error) {
    console.error('Failed to load test file:', error.message);
    console.log('Trying to run with ts-node instead...');
    
    const tsNode = spawn('npx', ['ts-node', 'src/embedding/embedding.spec.ts'], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    
    tsNode.on('close', (code) => {
      if (code !== 0) {
        console.error('ts-node execution failed');
        process.exit(code);
      }
    });
  }
}); 