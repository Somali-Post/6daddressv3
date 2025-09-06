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

// Define the file to process and the placeholder to replace
const configFile = path.join(__dirname, '..', 'public', 'js', 'config.js');
const placeholder = '"__GOOGLE_MAPS_API_KEY_PLACEHOLDER__"'; // Note the quotes

console.log(`\nProcessing file: ${configFile}`);
try {
    let content = fs.readFileSync(configFile, 'utf8');
    
    if (content.includes(placeholder)) {
        // Replace the placeholder string (including quotes) with the API key in quotes
        content = content.replace(placeholder, `"${apiKey}"`);
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

console.log('\n--- API Key Injection Script Finished Successfully ---\n');