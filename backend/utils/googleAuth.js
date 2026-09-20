const https = require('node:https');

/**
 * Verify Google ID Token against Google's authoritative OAuth2 tokeninfo service
 * @param {string} idToken - The Google JWT credential from the client
 * @returns {Promise<Object>} Verified Google payload containing email, name, sub
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Google ID token is required.');
  }

  // Support test tokens in test and development environments
  if (process.env.NODE_ENV !== 'production' && idToken.startsWith('test_google_token_')) {
    const email = idToken.replace('test_google_token_', '');
    return {
      email: email.toLowerCase().trim(),
      email_verified: true,
      sub: 'google_sub_test_' + Buffer.from(email).toString('hex').slice(0, 12),
      name: 'Google User',
      picture: ''
    };
  }

  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          if (res.statusCode !== 200 || parsed.error || parsed.error_description) {
            return reject(new Error(parsed.error_description || parsed.error || 'Invalid Google ID token.'));
          }

          // Check issuer
          const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
          if (!validIssuers.includes(parsed.iss)) {
            return reject(new Error('Invalid token issuer. Token must be issued by Google.'));
          }

          // Check audience if GOOGLE_CLIENT_ID configured
          if (process.env.GOOGLE_CLIENT_ID && parsed.aud !== process.env.GOOGLE_CLIENT_ID) {
            return reject(new Error('Google Client ID (aud) mismatch.'));
          }

          // Check email verification status
          const isEmailVerified = parsed.email_verified === 'true' || parsed.email_verified === true;
          if (!isEmailVerified) {
            return reject(new Error('Google account email is not verified by Google.'));
          }

          if (!parsed.email) {
            return reject(new Error('Google account email could not be verified.'));
          }

          // Check expiration
          const nowSeconds = Math.floor(Date.now() / 1000);
          if (parsed.exp && parseInt(parsed.exp, 10) < nowSeconds) {
            return reject(new Error('Google ID token has expired.'));
          }

          resolve({
            email: parsed.email.toLowerCase().trim(),
            email_verified: true,
            sub: parsed.sub,
            name: parsed.name || parsed.email.split('@')[0],
            picture: parsed.picture || ''
          });
        } catch (e) {
          reject(new Error('Failed to parse Google identity response: ' + e.message));
        }
      });
    }).on('error', (err) => {
      reject(new Error('Failed to connect to Google identity verification service: ' + err.message));
    });
  });
}

module.exports = {
  verifyGoogleIdToken
};
