/**
 * This script runs during the Netlify build process.
 * It finds a placeholder in the HTML files and replaces it with the
 * Google Maps API key stored in Netlify's environment variables.
 * This is a security best practice to avoid committing secret keys to Git.
 */
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const placeholder = '__GOOGLE_MAPS_API_KEY__';
// The paths are now correctly pointing to the HTML files inside the 'public' directory.
const filesToProcess = [
    path.join(__dirname, '..', 'public', 'index.html'),
    path.join(__dirname, '..', 'public', 'somalia.html')
];

// --- Main Execution ---
console.log('--- Starting API Key Injection Script ---');

// 1. Get the API key from environment variables
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

// 2. CRITICAL: Check if the API key exists.
if (!apiKey || apiKey.length < 10) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('FATAL ERROR: GOOGLE_MAPS_API_KEY environment variable not found or is too short.');
    console.error('Please ensure it is set correctly in the Netlify UI under "Site configuration > Build & deploy > Environment".');
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    process.exit(1); // Exit the build process with an error code
} else {
    console.log('Successfully loaded GOOGLE_MAPS_API_KEY from environment.');
}

// 3. Process each file
filesToProcess.forEach(filePath => {
    console.log(`\nProcessing file: ${filePath}`);
    try {
        // Read the file content
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if the placeholder exists in the file
        if (content.includes(placeholder)) {
            // Replace all instances of the placeholder with the actual API key
            content = content.replace(new RegExp(placeholder, 'g'), apiKey);
            // Write the updated content back to the file
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`SUCCESS: API key injected into ${path.basename(filePath)}.`);
        } else {
            // This is a warning, not a fatal error.
            console.warn(`WARNING: Placeholder "${placeholder}" not found in ${path.basename(filePath)}. Skipping replacement.`);
        }
    } catch (error) {
        console.error(`FATAL ERROR: Failed to read or write to ${filePath}.`);
        console.error(error); // Print the full error object
        process.exit(1); // Exit the build process with an error code
    }
});

console.log('\n--- API Key Injection Script Finished Successfully ---\n');