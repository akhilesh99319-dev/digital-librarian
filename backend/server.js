require('dotenv').config();
const express = require('express');
const path = require('node:path');
const cors = require('cors');
const { initDatabase } = require('./database/db');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const bookRoutes = require('./routes/bookRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const memberRoutes = require('./routes/memberRoutes');
const loanRoutes = require('./routes/loanRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Initialize database schema and seeds
try {
  initDatabase();
} catch (dbErr) {
  console.error('Database initialization error:', dbErr);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy for HTTPS, load balancers, and platforms like Render / Nginx
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
const frontendPath = path.join(__dirname, '../frontend');
const uploadsPath = path.join(__dirname, '../uploads');

app.use(express.static(frontendPath));
app.use('/uploads', express.static(uploadsPath));

// API Health Check & System Status
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    app: 'Digital Librarian',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reports', reportRoutes);

// Member Dashboard compatibility routes
app.get(['/member-dashboard.html', '/member_dashboard.html'], (req, res) => {
  res.redirect(301, '/dashboard.html');
});

// Fallback to serve index.html for root if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.'
  });
});

// Start Server helper
function startServer(port = PORT) {
  return app.listen(port, '0.0.0.0', () => {
    console.log('====================================================');
    console.log('  DIGITAL LIBRARIAN — PRODUCTION SERVER');
    console.log(`  Server listening on: http://0.0.0.0:${port}`);
    console.log(`  Local URL:           http://localhost:${port}`);
    console.log(`  Librarian Account:   ${process.env.LIBRARIAN_EMAIL || 'configured production account'}`);
    console.log('====================================================');
  });
}

let server;
if (require.main === module) {
  server = startServer(PORT);
}

module.exports = { app, server, startServer };
