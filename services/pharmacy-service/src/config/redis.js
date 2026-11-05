const Redis = require('ioredis');

let client = null;
let isConnected = false;

function initRedis() {
  if (client) return client;

  const redisHost = process.env.REDIS_HOST || '127.0.0.1';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisUrl = process.env.REDIS_URL;

  const redisOptions = {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 100, 1000);
    }
  };

  try {
    if (redisUrl) {
      client = new Redis(redisUrl, redisOptions);
    } else {
      client = new Redis({
        host: redisHost,
        port: redisPort,
        ...redisOptions
      });
    }

    client.on('connect', () => {
      isConnected = true;
    });

    client.on('ready', () => {
      isConnected = true;
    });

    client.on('error', () => {
      isConnected = false;
    });

    client.on('close', () => {
      isConnected = false;
    });
  } catch {
    isConnected = false;
    client = null;
  }

  return client;
}

async function checkRedisStatus() {
  if (process.env.NODE_ENV === 'test' && !process.env.REDIS_ENABLED) {
    return {
      connected: false,
      status: 'offline (in-memory mode)'
    };
  }

  const redis = initRedis();
  if (!redis) {
    return { connected: false, status: 'unavailable' };
  }

  try {
    if (!isConnected && redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const pong = await redis.ping();
    if (pong === 'PONG') {
      isConnected = true;
      return { connected: true, status: 'connected' };
    }
    return { connected: false, status: 'disconnected' };
  } catch {
    isConnected = false;
    return { connected: false, status: 'disconnected' };
  }
}

async function closeRedis() {
  if (client) {
    try {
      if (client.status === 'ready' || client.status === 'connecting') {
        await client.quit();
      } else {
        client.disconnect();
      }
    } catch {
      // ignore close errors
    } finally {
      client = null;
      isConnected = false;
    }
  }
}

module.exports = {
  initRedis,
  checkRedisStatus,
  closeRedis,
  isRedisConnected: () => isConnected
};
