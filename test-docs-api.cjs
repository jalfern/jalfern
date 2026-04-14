// Test script to verify both docs are accessible
const fs = require('fs');
const path = require('path');

// Read index
const indexPath = path.join(__dirname, 'data', 'docs-index.json');
const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

console.log('=== DOCS INDEX TEST ===\n');
console.log(`Total docs in index: ${indexData.docs.length}`);
console.log('');

indexData.docs.forEach((doc, i) => {
  console.log(`[${i+1}] ${doc.id}`);
  console.log(`    Title: ${doc.title}`);
  console.log(`    Tags: ${doc.tags.join(', ')}`);
  
  // Check if file exists
  const docPath = path.join(__dirname, 'data', 'docs', `${doc.id}.md`);
  const exists = fs.existsSync(docPath);
  console.log(`    File exists: ${exists}`);
  
  if (exists) {
    const content = fs.readFileSync(docPath, 'utf8');
    console.log(`    Content length: ${content.length} chars`);
    console.log(`    First line: ${content.split('\n')[0]}`);
  }
  console.log('');
});

console.log('=== TEST COMPLETE ===');
