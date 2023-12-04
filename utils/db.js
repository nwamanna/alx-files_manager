import mongodb from 'mongodb';

class DBClient {
  constructor() {
    const {
      DB_HOST = 'localhost',
      DB_PORT = 27017,
      DB_DATABASE = 'files_manager',
    } = process.env;

    const uri = `mongodb://${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
    const options = { useNewUrlParser: true, useUnifiedTopology: true };
    this.client = new mongodb.MongoClient(uri, options);
    this.client.connect();
  }

  isAlive() {
    return this.client.topology.isConnected();
  }

  async nbUsers() {
    const db = this.client.db();
    const userCollections = db.collection('users');
    const count = await userCollections.countDocuments();
    return count;
  }

  async nbFiles() {
    const db = this.client.db();
    const fileCollections = db.collection('files');
    const count = await fileCollections.countDocuments();
    return count;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
