
const assert = require('assert');

// Vulnerable pattern
const payload = {
  name: "Malicious Plant",
  description: "This is a </script><script>alert('XSS')</script> plant."
};

const jsonOutput = JSON.stringify(payload, null, 2);

console.log("JSON Output:");
console.log(jsonOutput);

// Simulation of injection into HTML
const html = `
<script type="application/ld+json">
${jsonOutput}
</script>
`;

console.log("\nHTML Output:");
console.log(html);

// Check if the closing script tag appears in the JSON output, effectively breaking the HTML structure
if (jsonOutput.includes('</script>')) {
    console.log("\n[!] VULNERABILITY CONFIRMED: </script> found inside JSON string.");
    console.log("    A browser would terminate the script block here and execute the subsequent code.");
} else {
    console.log("\n[+] No vulnerability found.");
}
