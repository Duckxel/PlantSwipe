
// Reproduction of the vulnerable logic in plant-swipe/server.js
// This script demonstrates that if Supabase verification fails,
// the code falls back to insecure decoding, accepting invalid tokens.

const assert = require('assert');

// Mock supabaseServer that always fails verification (simulating invalid token)
const supabaseServer = {
  auth: {
    getUser: async (token) => {
      return { data: { user: null }, error: { message: "Invalid token" } };
    }
  }
};

// Vulnerable function (copied logic from server.js)
async function getUserFromRequest_Vulnerable(req) {
  try {
    const header = req.headers['authorization'] || '';
    const prefix = 'bearer ';
    if (!header || header.length < 10) return null;
    const low = header.toLowerCase();
    if (!low.startsWith(prefix)) return null;
    const token = header.slice(prefix.length).trim();
    if (!token) return null;

    // Step 1: Try secure verification
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer.auth.getUser(token);
        // If verification succeeds, return verified user
        if (!error && data?.user?.id) {
          console.log("[Vulnerable] Verification success (not expected for invalid token)");
          return { id: data.user.id, email: data.user.email || null };
        }
        console.log("[Vulnerable] Verification failed (expected):", error?.message);
      } catch (e) { }
    }

    // Step 2: Fallback to insecure decoding (THE VULNERABILITY)
    console.log("[Vulnerable] Falling back to insecure decoding...");
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const b64 = parts[1];
        const norm = (b64 + '==='.slice((b64.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/');
        const json = Buffer.from(norm, 'base64').toString('utf8');
        const payload = JSON.parse(json);
        const id = (payload && (payload.sub || payload.user_id)) || null;
        const email = (payload && (payload.email || payload.user_email)) || null
        if (id) {
            console.log("[Vulnerable] Insecurely extracted ID:", id);
            return { id, email };
        }
      }
    } catch (e) { }
    return null;
  } catch (e) {
    return null;
  }
}

// Secure function (Fixed logic)
async function getUserFromRequest_Fixed(req) {
  try {
    const header = req.headers['authorization'] || '';
    const prefix = 'bearer ';
    if (!header || header.length < 10) return null;
    const low = header.toLowerCase();
    if (!low.startsWith(prefix)) return null;
    const token = header.slice(prefix.length).trim();
    if (!token) return null;

    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer.auth.getUser(token);
        if (!error && data?.user?.id) {
          return { id: data.user.id, email: data.user.email || null };
        }
        // FIX: If verification failed, DO NOT fall back.
        console.log("[Fixed] Verification failed, returning null.");
        return null;
      } catch (e) {
        return null;
      }
    }

    // If supabaseServer is not configured, we should also return null
    // or arguably allow fallback IF AND ONLY IF we explicitly allow unverified tokens (unlikely)
    return null;
  } catch (e) {
    return null;
  }
}

async function runTest() {
  console.log("--- Starting Reproduction of Auth Bypass ---");

  // Create a fake JWT (header.payload.signature)
  // Payload: {"sub": "admin-user-id", "email": "admin@example.com"}
  const fakePayload = JSON.stringify({ sub: "admin-user-id", email: "admin@example.com" });
  const b64Payload = Buffer.from(fakePayload).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const fakeToken = `fakeheader.${b64Payload}.fakesignature`;

  const req = {
    headers: {
      'authorization': `Bearer ${fakeToken}`
    }
  };

  console.log("Testing Vulnerable Function...");
  const userVuln = await getUserFromRequest_Vulnerable(req);

  if (userVuln && userVuln.id === "admin-user-id") {
    console.log("⚠️ [CRITICAL] Vulnerability Reproduced: Extracted user ID from invalid token!");
  } else {
    console.log("❌ Failed to reproduce vulnerability (unexpected).");
    process.exit(1);
  }

  console.log("\nTesting Fixed Function...");
  const userFixed = await getUserFromRequest_Fixed(req);

  if (userFixed === null) {
    console.log("✅ [SECURE] Fixed function correctly rejected the invalid token.");
  } else {
    console.log("❌ Fixed function still accepted the token:", userFixed);
    process.exit(1);
  }
}

runTest();
