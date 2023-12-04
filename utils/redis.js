import redis from 'redis';
import util from 'util';

class RedisClient {
  constructor() {
    // create a redis client
    this.client = redis.createClient();

    this.isConnected = true;

    // Handle errors
    this.client.on('error', (error) => {
      console.log(`${error}`);
      this.isConnected = false;
    });

    // make methods asynchrounous
    this.getAsync = util.promisify(this.client.get).bind(this.client);
    this.setAsync = util.promisify(this.client.set).bind(this.client);
    this.delAsync = util.promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    return this.isConnected;
  }

  async get(key) {
    try {
      const value = await this.getAsync(key);
      return value;
    } catch (error) {
      throw new Error(`could not get key ${key}: ${error}`);
    }
  }

  async set(key, value, duration) {
    try {
      await this.setAsync(key, value, 'EX', duration);
    } catch (error) {
      throw new Error(`could not set key ${key}: ${error}`);
    }
  }

  async del(key) {
    try {
      await this.delAsync(key);
    } catch (error) {
      throw new Error(`Could not delete ${key}: ${error}`);
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
