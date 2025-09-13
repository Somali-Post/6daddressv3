// scripts/inject-env.js
(function() {
    // This is your Netlify environment variable for the API key
    const apiKey = "%GOOGLE_MAPS_API_KEY%";

    // Find the Google Maps script tag by its new ID
    const googleMapsScript = document.getElementById('google-maps-api');

    if (googleMapsScript && apiKey && apiKey !== "YOUR_API_KEY") {
        // Replace the placeholder in the script's src URL with the real key
        googleMapsScript.src = googleMapsScript.src.replace('YOUR_API_KEY', apiKey);
    } else {
        console.error("Google Maps API key not found or script tag missing.");
    }
})();