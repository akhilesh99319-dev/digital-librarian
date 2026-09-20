const http = require('node:http');
const { getTestOtp } = require('../utils/emailService');

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
  const loginRes = await rawRequest('POST', '/api/auth/login', {
    email: identifier,
    password
  }, null, port);

  if (loginRes.status !== 200 || !loginRes.body.temp_token) {
    return loginRes;
  }

  let targetEmail = identifier;
  if (!targetEmail.includes('@')) {
    const { db } = require('../database/db');
    const memberRow = db.prepare('SELECT email FROM members WHERE member_code = ?').get(identifier);
    if (memberRow && memberRow.email) {
      targetEmail = memberRow.email;
    }
  }
  let otp = getTestOtp(targetEmail);

  const verifyRes = await rawRequest('POST', '/api/auth/verify-otp', {
    temp_token: loginRes.body.temp_token,
    otp
  }, null, port);

  return verifyRes;
}

async function registerWithOtp(payload, port = 3000) {
  const regRes = await rawRequest('POST', '/api/auth/register', payload, null, port);
  if (regRes.status !== 200 || !regRes.body.temp_token) {
    return regRes;
  }

  const otp = getTestOtp(payload.email);
  const verifyRes = await rawRequest('POST', '/api/auth/verify-register-otp', {
    temp_token: regRes.body.temp_token,
    otp
  }, null, port);

  return verifyRes;
}

module.exports = {
  rawRequest,
  loginWithOtp,
  registerWithOtp
};
