// netlify/functions/get-maps-key.js
exports.handler = async () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // set this in Netlify > Site settings > Environment variables

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      // If your site is served on a custom domain, you can tighten CORS here.
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ apiKey })
  };
};
