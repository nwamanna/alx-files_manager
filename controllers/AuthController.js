import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    try {
      // extract email and password from authorization headers Basic Auth
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.status(401).send('Unauthorized request');
      }

      // retrive the encoded credential

      const encodedCred = authHeader.split(' ')[1];

      // decode
      const decodedCred = Buffer.from(encodedCred, 'base64').toString('utf-8');

      // extract email and password
      const [email, password] = decodedCred.split(':');

      const hashedPassword = sha1(password);

      const data = {
        email,
        password: hashedPassword,
      };

      const user = await dbClient.client.db().collection('users').findOne(data);

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // generate token
      const token = uuidv4();
      const key = `auth_${token}`;
      const duration = 24 * 60 * 60;
      const id = user._id.toString();
      await redisClient.set(key, id, duration);

      // send response
      return res.status(200).json({ token });
    } catch (error) {
      return res.status(500).send(`internal server error: ${error}`);
    }
  }

  static async getDisconnect(req, res) {
    try {
      // extract token
      const Xtoken = req.headers['x-token'];

      if (!Xtoken) {
        res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${Xtoken}`;

      const id = await redisClient.get(key);
      console.log(id);

      if (!id) {
        res.status(401).json({ error: 'Unauthorized' });
      }

      await redisClient.del(key);

      // return nothing with status code 204
      res.status(204).end();
    } catch (error) {
      res.status(500).send(`internal server error: ${error}`);
    }
  }
}

module.exports = AuthController;
