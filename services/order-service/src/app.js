const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ quiet: true });

const orderRoutes = require('./routes/order.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount routes
app.use(orderRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
