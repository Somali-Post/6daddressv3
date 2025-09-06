const fs = require('fs');
const path = require('path');

// The placeholder string we'll be replacing in the HTML files
const placeholder = '__GOOGLE_MAPS_API_KEY__';

// Get the actual API key from the environment variables
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

// List of files to process
const filesToProcess = [
    path.join(__dirname, '..', 'public', 'index.html'),
    path.join(__dirname, '..', 'public', 'somalia.html')
];

// Check if the API key is available
if (!apiKey) {
    console.error('ERROR: GOOGLE_MAPS_API_KEY environment variable not set.');
    process.exit(1); // Exit with an error code
}

console.log('Injecting Google Maps API key into HTML files...');

// Process each file
filesToProcess.forEach(filePath => {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        if (content.includes(placeholder)) {
            content = content.replace(new RegExp(placeholder, 'g'), apiKey);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Successfully updated ${path.basename(filePath)}`);
        } else {
            console.warn(`Placeholder not found in ${path.basename(filePath)}. Skipping.`);
        }
    } catch (error) {
        console.error(`Failed to process ${filePath}:`, error);
        process.exit(1);
    }
});

console.log('API key injection complete.');