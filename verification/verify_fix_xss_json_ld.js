
const assert = require('assert');

// The helper function copied from server.js
function safeJsonStringify(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')
}

// Vulnerable payload
const payload = {
  name: "Malicious Plant",
  description: "This is a </script><script>alert('XSS')</script> plant."
};

console.log("Original payload:", payload);

const safeOutput = safeJsonStringify(payload);

console.log("\nSafe JSON Output:");
console.log(safeOutput);

// Simulation of injection into HTML
const html = `
<script type="application/ld+json">
${safeOutput}
</script>
`;

console.log("\nHTML Output:");
console.log(html);

// Verification logic
if (safeOutput.includes('</script>')) {
    console.error("\n[!] FAIL: Vulnerability still exists! </script> found inside JSON string.");
    process.exit(1);
} else if (safeOutput.includes('\\u003c/script>')) {
    console.log("\n[+] SUCCESS: Vulnerability neutralized. </script> was escaped to \\u003c/script>.");
    console.log("    The browser will parse this as a string literal and NOT close the script block.");
} else {
    // Should generally be one of the above, but as a fallback check
    if (!safeOutput.includes('<')) {
        console.log("\n[+] SUCCESS: No raw '<' characters found in output.");
    } else {
         console.error("\n[!] UNKNOWN STATE: Please check output manually.");
         process.exit(1);
    }
}
