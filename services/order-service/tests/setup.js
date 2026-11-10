const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration (.env)
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5002';
// Unset live network URLs during unit tests so mocks/stubs operate cleanly
delete process.env.PHARMACY_SERVICE_URL;
delete process.env.CATALOG_SERVICE_URL;
