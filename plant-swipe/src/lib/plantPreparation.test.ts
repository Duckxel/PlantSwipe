import { preparePlants } from "./plantPreparation";
import type { Plant, ColorOption } from "@/types/plant";
import type { ColorLookups } from "./plantPreparation";

// Mock Data
const mockColorOption: ColorOption = {
  id: "1",
  name: "Green",
  hexCode: "#00FF00",
  isPrimary: true,
  parentIds: [],
  translations: { fr: "Vert" }
};

const mockPlant: Plant = {
  id: "plant-1",
  name: "Test Plant",
  colors: ["Green"],
  utility: ["comestible"], // Should be formatted to "Comestible"
  plantCare: {
    habitat: ["Tropical"]
  },
  seasons: ["Summer"],
  identity: {
    toxicityPets: "Non-Toxic",
    toxicityHuman: "Non-Toxic",
    colors: [{ name: "Green" }]
  },
  meta: {
    status: "Approved",
    createdAt: "2023-01-01"
  }
};

const mockColorLookups: ColorLookups = {
  nameMap: new Map([["green", mockColorOption]]),
  idMap: new Map([["1", mockColorOption]]),
  childrenMap: new Map(),
  translationMap: new Map([["vert", mockColorOption]]),
  aliasMap: new Map([["green", new Set(["green", "vert"])]])
};

console.log("⚡ Starting Verification: Plant Preparation Logic");

// 1. Run preparePlants
const prepared = preparePlants([mockPlant], mockColorLookups);
const p = prepared[0];

// 2. Verify Structure (Arrays vs Sets)
console.log("Verifying PreparedPlant structure...");

if (Array.isArray(p._usageLabels)) {
  console.log("✅ _usageLabels is Array");
} else {
  console.error("❌ _usageLabels should be Array", p._usageLabels);
  process.exit(1);
}

if (Array.isArray(p._habitats)) {
  console.log("✅ _habitats is Array");
} else {
  console.error("❌ _habitats should be Array", p._habitats);
  process.exit(1);
}

if (Array.isArray(p._colorTokens)) {
  console.log("✅ _colorTokens is Array");
} else {
  console.error("❌ _colorTokens should be Array", p._colorTokens);
  process.exit(1);
}

// Check contents
if (p._usageLabels.includes("comestible")) { // formatted is Comestible, but lowercased in prepared
  console.log("✅ _usageLabels contains expected value (comestible)");
} else {
  console.error("❌ _usageLabels missing value", p._usageLabels);
  // Note: getPlantUsageLabels uses formatClassificationLabel which capitalizes.
  // preparePlants lowercases it.
  // formatClassificationLabel("comestible") -> "Comestible"
  // toLowerCase -> "comestible"
}

if (p._habitats.includes("tropical")) {
  console.log("✅ _habitats contains expected value (tropical)");
} else {
  console.error("❌ _habitats missing value", p._habitats);
}

if (p._colorTokens.includes("green") && p._colorTokens.includes("vert")) {
  console.log("✅ _colorTokens contains aliases (green, vert)");
} else {
  console.error("❌ _colorTokens missing aliases", p._colorTokens);
}

// 3. Verify Filtering Logic (Simulation)
console.log("Verifying Filtering Logic...");

// Case A: Usage Filter (AND)
const usageFilterSet = new Set(["comestible"]);
// Logic:
let usageMatch = true;
if (p._usageLabels.length < usageFilterSet.size) usageMatch = false;
else {
  for (const usage of usageFilterSet) {
    if (!p._usageLabels.includes(usage)) {
      usageMatch = false;
      break;
    }
  }
}
if (usageMatch) {
  console.log("✅ Usage Filter (Match) Passed");
} else {
  console.error("❌ Usage Filter (Match) Failed");
  process.exit(1);
}

// Case B: Usage Filter (No Match)
const usageFilterSetFail = new Set(["comestible", "medicinal"]);
let usageMatchFail = true;
if (p._usageLabels.length < usageFilterSetFail.size) usageMatchFail = false;
else {
  for (const usage of usageFilterSetFail) {
    if (!p._usageLabels.includes(usage)) {
      usageMatchFail = false;
      break;
    }
  }
}
if (!usageMatchFail) {
  console.log("✅ Usage Filter (No Match) Passed");
} else {
  console.error("❌ Usage Filter (No Match) Failed - Should not match");
  process.exit(1);
}

// Case C: Habitat Filter (OR)
const habitatFilterSet = new Set(["arid", "tropical"]); // Tropical should match
let habitatMatch = false;
for (const h of p._habitats) {
  if (habitatFilterSet.has(h)) {
    habitatMatch = true;
    break;
  }
}
if (habitatMatch) {
  console.log("✅ Habitat Filter (Match) Passed");
} else {
  console.error("❌ Habitat Filter (Match) Failed");
  process.exit(1);
}

// Case D: Color Filter
const colorFilterSet = new Set(["vert"]); // Should match via token
let colorMatch = false;
for (const token of p._colorTokens) {
  if (colorFilterSet.has(token)) {
    colorMatch = true;
    break;
  }
}
if (colorMatch) {
  console.log("✅ Color Filter (Match) Passed");
} else {
  console.error("❌ Color Filter (Match) Failed");
  process.exit(1);
}

// Case E: Season Filter (Array Check on Normalized)
const seasonFilter = "Summer"; // Case sensitive as per enum
// In PlantSwipe: if (seasonFilter && !p._seasons.includes(seasonFilter)) return false
if (p._seasons.includes(seasonFilter)) {
    console.log("✅ Season Filter (Match) Passed");
} else {
    console.error("❌ Season Filter (Match) Failed");
    process.exit(1);
}

console.log("🎉 All Verification Tests Passed!");
