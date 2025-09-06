// Logic for user registration// Serverless function to handle user registration.
// It verifies the OTP and saves the data to a database (e.g., Supabase).

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // BA-4: Access secret keys from environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    const { fullName, phoneNumber, sixDCode, otp } = JSON.parse(event.body);

    // TODO:
    // 1. Verify the OTP.
    // 2. If OTP is valid, initialize Supabase client.
    // 3. Save the registration data to the database.

    console.log(`Registering user ${fullName} with code ${sixDCode}`);

    return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'User registered successfully (placeholder).' })
    };
};