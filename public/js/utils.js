// This file contains shared utility functions used across the application.

// A flag to ensure the Google Maps API script is only loaded once.
let isGoogleMapsApiLoaded = false;

/**
 * Dynamically loads the Google Maps JavaScript API.
 * This function creates a script tag and appends it to the document,
 * returning a promise that resolves when the script has loaded.
 * @param {string} apiKey Your Google Maps API key.
 * @returns {Promise<void>} A promise that resolves when the API is ready.
 */
export function loadGoogleMapsAPI(apiKey) {
    return new Promise((resolve, reject) => {
        // If the script has already been loaded, resolve immediately.
        if (isGoogleMapsApiLoaded) {
            resolve();
            return;
        }

        // Create a callback function that the Google Maps script will call upon loading
        window.googleMapsApiCallback = () => {
            isGoogleMapsApiLoaded = true;
            // Clean up the global callback function
            delete window.googleMapsApiCallback;
            resolve();
        };

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=googleMapsApiCallback`;
        script.async = true;
        script.defer = true;
        script.onerror = (error) => {
            reject(new Error(`Failed to load Google Maps script: ${error.message}`));
        };

        document.head.appendChild(script);
    });
}


/**
 * Debounce function to limit the rate at which a function gets called.
 * (TR-3: API Call Management)
 * @param {Function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}