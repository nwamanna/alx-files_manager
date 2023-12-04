import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mongodb from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    try {
      // extract token
      const Xtoken = req.headers['x-token'];

      if (!Xtoken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${Xtoken}`;

      const userId = await redisClient.get(key);
      // console.log(id);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        name, type, parentId = 0, isPublic = false, data,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }

      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }

      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }
      console.log(type);
      console.log(parentId);

      if (parentId !== '0') {
        const parentID = new mongodb.ObjectID(parentId);
        console.log(parentID);
        const parentFile = await dbClient.client.db().collection('files').findOne({ _id: parentID });
        console.log(parentFile);
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }

        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      // prepare the file data
      const file = {
        userId,
        name,
        type,
        isPublic,
        parentId,
      };
      console.log(file);

      if (type === 'folder') {
        // directly add file into collections
        const fileData = await dbClient.client.db().collection('files').insertOne(file);
        return res.status(201).json(fileData.ops[0]);
      }
      // for files and images, save file locally
      const folderPath = process.env.FOLDERPATH || 'tmp/files_manager';
      const relativePath = uuidv4();
      const localPath = path.join(folderPath, relativePath);
      console.log(localPath);

      // decode data and write to file
      const content = Buffer.from(data, 'base64');
      fs.writeFileSync(localPath, content);
      const fileData = await dbClient.client.db().collection('files').insertOne(file);
      return res.status(201).json(fileData.ops[0]);
    } catch (error) {
      return res.status(500).send(`internal server error: ${error}`);
    }
  }

  static async getShow(req, res) {
    try {
      // extract token
      const Xtoken = req.headers['x-token'];

      if (!Xtoken) {
        res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${Xtoken}`;

      const userId = await redisClient.get(key);
      // console.log(id);

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      // console.log(id);
      const ID = new mongodb.ObjectID(id);
      const allFile = await dbClient.client.db().collection('files').findOne({ userId, _id: ID });
      // console.log(allFile);

      if (!allFile) {
        res.status(404).json({ error: 'Not found' });
      }

      res.status(200).json(allFile);
    } catch (error) {
      res.status(500).send(`error: ${error}`);
    }
  }

  static async getIndex(req, res) {
    try {
      // extract token
      const Xtoken = req.headers['x-token'];

      if (!Xtoken) {
        res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${Xtoken}`;

      const userId = await redisClient.get(key);
      // console.log(id);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Extract query paramter
      const { parentId = '0', page = '0' } = req.query;

      // use page to form pagination
      const pipeline = [
        {
          $match: {
            userId,
            parentId,
          },
        },

        // sikp page based on pagination
        {
          $skip: parseInt(page, 10) * 20,
        },

        {
          $limit: 20,
        },
      ];

      // use aggregation to retive a list of file arrrays
      const allFile = await dbClient.client.db().collection('files').aggregate(pipeline).toArray();
      // console.log(allFile);

      if (!allFile) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(200).json(allFile);
    } catch (error) {
      return res.status(500).send(`internal server error ${error}`);
    }
  }

  static async putPublish(req, res) {
    try {
      // extract token
      const Xtoken = req.headers['x-token'];

      if (!Xtoken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${Xtoken}`;

      const userId = await redisClient.get(key);
      // console.log(id);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      // console.log(id);
      const ID = new mongodb.ObjectID(id);
      const allFile = await dbClient.client.db().collection('files').findOne({ userId, _id: ID });

      if (!allFile) {
        return res.status(404).json({ error: 'Not found' });
      }

      const updatedFile = await dbClient.client.db().collection('files').findOneAndUpdate(
        { userId, _id: ID },
        { $set: { isPublic: true } },
        { returnDocument: 'after' },
      );

      return res.status(200).json(updatedFile.value);
    } catch (error) {
      return res.status(500).send(`internal server error ${error}`);
    }
  }

  static async putUnpublish(req, res) {
    try {
      // extract token
      const Xtoken = req.headers['x-token'];

      if (!Xtoken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${Xtoken}`;

      const userId = await redisClient.get(key);
      // console.log(id);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      // console.log(id);
      const ID = new mongodb.ObjectID(id);
      const allFile = await dbClient.client.db().collection('files').findOne({ userId, _id: ID });

      if (!allFile) {
        return res.status(404).json({ error: 'Not found' });
      }

      const updatedFile = await dbClient.client.db().collection('files').findOneAndUpdate(
        { userId, _id: ID },
        { $set: { isPublic: false } },
        { returnDocument: 'after' },
      );

      return res.status(200).json(updatedFile.value);
    } catch (error) {
      return res.status(500).send(`internal server error ${error}`);
    }
  }
}

module.exports = FilesController;
