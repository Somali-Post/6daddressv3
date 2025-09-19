const fs = require('fs');
const path = require('path');

console.log('--- Starting API Key Injection Script ---');

const apiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!apiKey || apiKey.length < 10) {
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('FATAL ERROR: GOOGLE_MAPS_API_KEY environment variable not found or is too short.');
  console.error('Please ensure it is set correctly in the Netlify UI.');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  process.exit(1);
} else {
  console.log('Successfully loaded GOOGLE_MAPS_API_KEY from environment.');
}

// ---------- Replace in config.js (quoted placeholder) ----------
const configFile = path.join(__dirname, '..', 'public', 'js', 'config.js');
const quotedPlaceholder = '"__GOOGLE_MAPS_API_KEY_PLACEHOLDER__"';

console.log(`\nProcessing file: ${configFile}`);
try {
  let content = fs.readFileSync(configFile, 'utf8');
  if (content.includes(quotedPlaceholder)) {
    content = content.replace(quotedPlaceholder, `"${apiKey}"`);
    fs.writeFileSync(configFile, content, 'utf8');
    console.log(`SUCCESS: API key injected into ${path.basename(configFile)}.`);
  } else {
    console.warn(`WARNING: Placeholder not found in ${path.basename(configFile)}. Skipping.`);
  }
} catch (error) {
  console.error(`FATAL ERROR: Failed to process ${configFile}.`);
  console.error(error);
  process.exit(1);
}

// ---------- Replace in somalia.html (raw placeholder) ----------
const htmlFile = path.join(__dirname, '..', 'public', 'somalia.html');
const rawPlaceholder = '__GOOGLE_MAPS_API_KEY_PLACEHOLDER__';

console.log(`\nProcessing file: ${htmlFile}`);
try {
  let html = fs.readFileSync(htmlFile, 'utf8');
  if (html.includes(rawPlaceholder)) {
    html = html.replace(new RegExp(rawPlaceholder, 'g'), apiKey);
    fs.writeFileSync(htmlFile, html, 'utf8');
    console.log(`SUCCESS: API key injected into ${path.basename(htmlFile)}.`);
  } else {
    console.warn(`WARNING: Placeholder not found in ${path.basename(htmlFile)}. Skipping.`);
  }
} catch (error) {
  console.error(`FATAL ERROR: Failed to process ${htmlFile}.`);
  console.error(error);
  process.exit(1);
}

console.log('\n--- API Key Injection Script Finished Successfully ---\n');
