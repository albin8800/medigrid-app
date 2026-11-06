const path = require('path');
const dotenv = require('dotenv');

// Load environment variables for testing
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5001';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@medigrid.com';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
