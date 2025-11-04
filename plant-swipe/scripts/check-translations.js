#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_LANGUAGE = 'en';
const LOCALES_DIR = join(__dirname, '../public/locales');

/**
 * Recursively extract all keys from a nested object
 * @param {Object} obj - The object to extract keys from
 * @param {string} prefix - The prefix for nested keys
 * @returns {Set<string>} Set of all keys in dot notation
 */
function extractKeys(obj, prefix = '') {
  const keys = new Set();
  
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return keys;
  }
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively extract keys from nested objects
      const nestedKeys = extractKeys(value, fullKey);
      nestedKeys.forEach(k => keys.add(k));
    } else {
      // Leaf node
      keys.add(fullKey);
    }
  }
  
  return keys;
}

/**
 * Load and parse a JSON translation file
 * @param {string} lang - Language code
 * @returns {Object} Parsed JSON object
 */
function loadTranslationFile(lang) {
  const filePath = join(LOCALES_DIR, lang, 'common.json');
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading translation file for ${lang}:`, error.message);
    process.exit(1);
  }
}

/**
 * Get all available language directories
 * @returns {string[]} Array of language codes
 */
function getAvailableLanguages() {
  try {
    const entries = readdirSync(LOCALES_DIR);
    return entries.filter(entry => {
      const fullPath = join(LOCALES_DIR, entry);
      return statSync(fullPath).isDirectory();
    });
  } catch (error) {
    console.error(`Error reading locales directory:`, error.message);
    process.exit(1);
  }
}

/**
 * Compare translation keys between base language and target language
 * @param {Set<string>} baseKeys - Keys from base language (English)
 * @param {Set<string>} targetKeys - Keys from target language
 * @param {string} lang - Target language code
 * @returns {Object} Comparison results
 */
function compareKeys(baseKeys, targetKeys, lang) {
  const missing = [...baseKeys].filter(key => !targetKeys.has(key));
  const extra = [...targetKeys].filter(key => !baseKeys.has(key));
  
  return {
    missing,
    extra,
    hasIssues: missing.length > 0 || extra.length > 0
  };
}

/**
 * Main function to check translation consistency
 */
function checkTranslations() {
  console.log('🌍 Checking translation key consistency...\n');
  
  // Get all available languages
  const languages = getAvailableLanguages();
  
  if (!languages.includes(BASE_LANGUAGE)) {
    console.error(`❌ Base language "${BASE_LANGUAGE}" not found!`);
    process.exit(1);
  }
  
  // Load base language (English)
  const baseTranslation = loadTranslationFile(BASE_LANGUAGE);
  const baseKeys = extractKeys(baseTranslation);
  
  console.log(`📌 Base language: ${BASE_LANGUAGE} (${baseKeys.size} keys)`);
  console.log(`📋 Languages to check: ${languages.filter(l => l !== BASE_LANGUAGE).join(', ') || 'none'}\n`);
  
  let hasErrors = false;
  const failingLanguages = [];
  const otherLanguages = languages.filter(l => l !== BASE_LANGUAGE);
  
  if (otherLanguages.length === 0) {
    console.log('⚠️  No other languages found to check.');
    return;
  }
  
  // Check each language against base
  for (const lang of otherLanguages) {
    console.log(`\n🔍 Checking ${lang}...`);
    
    const targetTranslation = loadTranslationFile(lang);
    const targetKeys = extractKeys(targetTranslation);
    
    const comparison = compareKeys(baseKeys, targetKeys, lang);
    
    if (!comparison.hasIssues) {
      console.log(`  ✅ ${lang}: All keys match (${targetKeys.size} keys)`);
    } else {
      hasErrors = true;
      failingLanguages.push(lang);
      console.log(`  ❌ ${lang}: Found inconsistencies`);
      
      if (comparison.missing.length > 0) {
        console.log(`\n  📉 Missing keys (${comparison.missing.length}):`);
        comparison.missing.forEach(key => {
          console.log(`     - ${key}`);
        });
      }
      
      if (comparison.extra.length > 0) {
        console.log(`\n  📈 Extra keys (${comparison.extra.length}):`);
        comparison.extra.forEach(key => {
          console.log(`     + ${key}`);
        });
      }
      
      // Show summary
      console.log(`\n  📊 Summary for ${lang}:`);
      console.log(`     Expected: ${baseKeys.size} keys`);
      console.log(`     Found: ${targetKeys.size} keys`);
      console.log(`     Missing: ${comparison.missing.length} keys`);
      console.log(`     Extra: ${comparison.extra.length} keys`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (hasErrors) {
    const languagesList = failingLanguages.join(', ');
    console.log(`\n❌ Translation check failed! The following language(s) have inconsistencies: ${languagesList}`);
    console.log('Please fix the inconsistencies above.');
    process.exit(1);
  } else {
    console.log('\n✅ All translation files are consistent!');
    process.exit(0);
  }
}

// Run the check
checkTranslations();