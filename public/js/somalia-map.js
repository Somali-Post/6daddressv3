// public/js/somalia-map.js
// ES Module that loads the Google Maps API using a Netlify Function key

let map;
let marker;

/** Load Google Maps by fetching the API key from a Netlify Function. */
async function loadGoogleMaps() {
  // 1) Get the key from Netlify Function
  const res = await fetch('/.netlify/functions/get-maps-key', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch Google Maps key');
  const { apiKey } = await res.json();
  if (!apiKey) throw new Error('Google Maps key missing');

  // 2) Inject the script with the normal callback
  return new Promise((resolve, reject) => {
    // Define the global callback BEFORE inserting the script
    window.initMap = () => {
      try {
        initMap();
        resolve();
      } catch (e) {
        reject(e);
      }
    };

    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=initMap`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(s);
  });
}

/** Google Maps init (called by Maps callback) */
function initMap() {
  const defaultCenter = { lat: 2.0469, lng: 45.3182 }; // Mogadishu

  map = new google.maps.Map(document.getElementById('map'), {
    center: defaultCenter,
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });

  marker = new google.maps.Marker({
    position: defaultCenter,
    map: map,
    animation: google.maps.Animation.DROP,
  });

  map.addListener('click', (event) => {
    const latLng = event.latLng;
    placeMarker(latLng);
    updateInfoPanel(latLng);
  });
}

/** Place or move the marker */
function placeMarker(latLng) {
  if (marker) {
    marker.setPosition(latLng);
  } else {
    marker = new google.maps.Marker({
      position: latLng,
      map: map,
      animation: google.maps.Animation.DROP,
    });
  }
  map.panTo(latLng);
}

/** Update the info panel with a demo 6D address */
function updateInfoPanel(latLng) {
  const infoPanel = document.getElementById('infoPanel');
  const latCode = Math.abs(Math.floor((latLng.lat() % 1) * 1000));
  const lngCode = Math.abs(Math.floor((latLng.lng() % 1) * 1000));
  const sixD = `${latCode.toString().padStart(2, '0')}-${lngCode.toString().padStart(2, '0')}-01`;

  infoPanel.innerHTML = `
    <div class="info-panel__row">
      <p><strong>6D Address:</strong> ${sixD}</p>
      <button class="btn btn--primary" id="btnRegister">Register This Address</button>
    </div>
  `;

  const btnRegister = document.getElementById('btnRegister');
  if (btnRegister) {
    btnRegister.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.add('sidebar--expanded');
      sidebar.setAttribute('aria-expanded', 'true');

      document.querySelectorAll('.sidebar-view').forEach((v) => v.classList.remove('is-active'));
      document.getElementById('view-register').classList.add('is-active');

      const codeInput = document.getElementById('code');
      if (codeInput) codeInput.value = sixD;
    });
  }
}

/** Wire up UI and load Maps */
document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const expanded = sidebar.classList.toggle('sidebar--expanded');
      sidebar.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  const ctaFind = document.getElementById('ctaFind');
  if (ctaFind) {
    ctaFind.addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            placeMarker(coords);
            updateInfoPanel({ lat: () => coords.lat, lng: () => coords.lng });
          },
          () => alert('Unable to get location')
        );
      } else {
        alert('Geolocation not supported');
      }
    });
  }

  // Load Google Maps after the page skeleton is ready
  try {
    await loadGoogleMaps();
  } catch (err) {
    console.error(err);
    alert('Failed to load Google Maps. Please try again later.');
  }
});
