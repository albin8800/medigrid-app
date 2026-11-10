const app = require('./app');
const { closeRedis } = require('./config/redis');

const PORT = process.env.PORT || process.env.PHARMACY_SERVICE_PORT;
if (!PORT) {
  throw new Error('PORT environment variable is required (please configure PORT in .env)');
}

const server = app.listen(PORT, () => {
  console.log(`Pharmacy service listening on port ${PORT}`);
});

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await closeRedis();
      console.log('Redis connection closed.');
    } catch (err) {
      console.error('Error during Redis shutdown:', err);
    }
    process.exit(0);
  });

  // Force shutdown after timeout if pending connections hang
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
