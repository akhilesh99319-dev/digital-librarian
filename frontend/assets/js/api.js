/**
 * Centralized API Client with JWT Authorization & Error Interception
 */

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.tokenKey = 'library_jwt_token';
    this.userKey = 'library_user_info';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setSession(token, user) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  getUser() {
    const user = localStorage.getItem(this.userKey);
    return user ? JSON.parse(user) : null;
  }

  clearSession() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  async request(endpoint, options = {}) {
    let url;
    if (endpoint.startsWith('http')) {
      url = endpoint;
    } else if (endpoint.startsWith(API_BASE)) {
      url = endpoint;
    } else {
      url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }
    const headers = options.headers || {};

    // Attach JWT Token if present
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized / Expired Session
      if (response.status === 401) {
        if (!window.location.pathname.endsWith('login.html')) {
          this.clearSession();
          window.location.href = '/login.html?expired=1';
          return { success: false, message: 'Session expired. Redirecting to login...' };
        }
      }

      // Check if CSV download
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('text/csv')) {
        const blob = await response.blob();
        return blob;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  get(endpoint, params = {}) {
    const normalizedEndpoint = endpoint.startsWith(API_BASE) 
      ? endpoint 
      : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const url = new URL(normalizedEndpoint, window.location.origin);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });
    return this.request(url.pathname + url.search, { method: 'GET' });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }

  async downloadCsv(endpoint, params = {}, defaultFilename = 'report.csv') {
    const normalizedEndpoint = endpoint.startsWith(API_BASE) 
      ? endpoint 
      : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const url = new URL(normalizedEndpoint, window.location.origin);
    params.format = 'csv';
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });
    const blob = await this.request(url.pathname + url.search, { method: 'GET' });
    
    // Trigger browser download
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();
  }
}

const api = new ApiClient();
