import mongodb from 'mongodb';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    try {
      // extract email and password from request body
      console.log(req.body);
      const { email, password } = req.body;

      // check if email is missing
      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }

      if (!password) {
        return res.status(400).json({ error: 'Missing password' });
      }

      // if user already exists
      const exists = await dbClient.client.db().collection('users').findOne({ email });
      if (exists) {
        return res.status(400).json({ error: 'Already exist' });
      }

      const hashedPassword = sha1(password);

      // create a new user object
      const newUser = {
        email: email,
        password: hashedPassword,
      };

      // insert newUser object inside db
      const result = await dbClient.client.db().collection('users').insertOne(newUser);
      const id = result.insertedId;
      console.log(id);
      const responseUser = { id, email };
      return res.status(201).json(responseUser);
    } catch (error) {
      return res.status(500).send(`internal server error ${error}`);
    }
  }

  static async getMe(req, res) {
    try {
      // extract token
      const Xtoken = req.headers['x-token'];
      // console.log(Xtoken);

      if (!Xtoken) {
        res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${Xtoken}`;

      const id = await redisClient.get(key);
      // console.log(id);

      if (!id) {
        res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = new mongodb.ObjectID(id);

      const user = await dbClient.client.db().collection('users').findOne({ _id: userId });
      // console.log(user);

      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
      }

      res.status(200).json({ id: user._id, email: user.email });
    } catch (error) {
      res.status(500).send(`internal server error ${error}`);
    }
  }
}

module.exports = UsersController;
