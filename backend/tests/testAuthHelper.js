const http = require('node:http');

function rawRequest(method, path, body = null, token = null, port = 3000) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json'
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
    if (dataString) {
      reqHeaders['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function loginWithOtp(identifier, password, port = 3000) {
  return await rawRequest('POST', '/api/auth/login', {
    email: identifier,
    password
  }, null, port);
}

async function registerWithOtp(payload, port = 3000) {
  return await rawRequest('POST', '/api/auth/register', payload, null, port);
}

module.exports = {
  rawRequest,
  loginWithOtp,
  registerWithOtp
};
