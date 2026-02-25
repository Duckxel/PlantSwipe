import { JSDOM } from 'jsdom';

// Setup JSDOM environment before importing code that might use DOMPurify
const dom = new JSDOM('<!DOCTYPE html>');
global.window = dom.window;
global.document = dom.window.document;
// @ts-expect-error JSDOM window assignment for test environment
globalThis.window = dom.window;

// Import the function to test
// We use a relative path assuming we run this from plant-swipe directory
import { sanitizeEmailHtml } from '../src/lib/emailWrapper';

console.log('🔍 Verifying sanitizeEmailHtml security...');

const testCases = [
  {
    name: 'Basic Script Tag',
    input: '<script>alert("XSS")</script><div>Safe</div>',
    check: (out) => !out.includes('<script>') && out.includes('Safe')
  },
  {
    name: 'Image OnError',
    input: '<img src="x" onerror="alert(1)" />',
    check: (out) => !out.includes('onerror') && out.includes('<img')
  },
  {
    name: 'Javascript Protocol',
    input: '<a href="javascript:alert(1)">Click me</a>',
    check: (out) => !out.includes('javascript:') && out.includes('Click me')
  },
  {
    name: 'Iframe',
    input: '<iframe src="http://evil.com"></iframe>',
    check: (out) => !out.includes('<iframe')
  },
  {
    name: 'Valid Style',
    input: '<div style="color: red; background: blue;">Styled</div>',
    check: (out) => out.includes('style="color: red; background: blue;"') || out.includes('style="color: red; background: blue"')
  },
  {
    name: 'Valid Table',
    input: '<table border="1" cellpadding="0"><tr><td>Cell</td></tr></table>',
    check: (out) => out.includes('<table') && out.includes('border="1"') && out.includes('Cell')
  },
  {
    name: 'SVG Replacement (Existing Logic)',
    input: '<img src="https://media.aphylia.app/UTILITY/admin/uploads/svg/plant-swipe-icon.svg" />',
    check: (out) => out.includes('icon-500_transparent_white.png') && !out.includes('.svg')
  }
];

let failures = 0;

for (const test of testCases) {
  try {
    const output = sanitizeEmailHtml(test.input);
    if (test.check(output)) {
      console.log(`✅ PASS: ${test.name}`);
    } else {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(`   Input:    ${test.input}`);
      console.error(`   Output:   ${output}`);
      failures++;
    }
  } catch (err) {
    console.error(`❌ ERROR: ${test.name} threw exception`, err);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} tests failed!`);
  process.exit(1);
} else {
  console.log('\nAll security checks passed! 🛡️');
  process.exit(0);
}
