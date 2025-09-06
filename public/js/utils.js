// This file contains shared utility functions used across the application.

let isGoogleMapsApiLoaded = false;

/**
 * Dynamically loads the Google Maps JavaScript API.
 * @param {string} apiKey Your Google Maps API key.
 * @param {string[]} libraries An array of library names to load (e.g., ['places', 'geometry']).
 * @returns {Promise<void>} A promise that resolves when the API is ready.
 */
export function loadGoogleMapsAPI(apiKey, libraries = []) {
    return new Promise((resolve, reject) => {
        if (isGoogleMapsApiLoaded) {
            return resolve();
        }

        window.googleMapsApiCallback = () => {
            isGoogleMapsApiLoaded = true;
            delete window.googleMapsApiCallback;
            resolve();
        };

        const script = document.createElement('script');
        // --- FIX APPLIED ---
        // The URL now correctly joins the libraries array into the 'libraries' parameter.
        const librariesParam = libraries.length > 0 ? `&libraries=${libraries.join(',')}` : '';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}${librariesParam}&callback=googleMapsApiCallback`;
        // --- END OF FIX ---
        
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
 */
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}