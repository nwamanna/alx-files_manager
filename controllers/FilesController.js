const { ObjectID } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

const FilesController = {
  async postUpload(req, res) {
    const token = req.header('X-Token');

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // console.log(token);
    const key = `auth_${token}`;

    const userIdFromRedis = await redisClient.get(key);

    const userIdforMongo = new ObjectID(userIdFromRedis);
    // console.log(userIdFromRedis, userIdforMongo);

    const user = await dbClient.client.db().collection('users').findOne({ _id: userIdforMongo });

    if (!user) {
      // console.log('user')
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    // if (!type || !['folder', 'image', 'file'].includes(type))
    if (!type || (type !== 'folder' && type !== 'image' && type !== 'file')) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && (type !== 'folder')) {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId !== 0) {
      const newParentId = new ObjectID(parentId);
      const parentIDFile = await dbClient.client.db().collection('files').findOne({ _id: newParentId });
      if (!parentIDFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentIDFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    let fileDocument = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      const result = await dbClient.client.db().collection('files').insertOne(fileDocument);
      fileDocument = {
        id: result.insertedId,
        userId: user._id,
        name,
        type,
        isPublic,
        parentId,
      };
      return res.status(201).json(fileDocument);
    }

    // Handling file storage on disk
    // const folderPath =  path.join(FOLDER_PATH, userId.toString());
    const folderPath = FOLDER_PATH;

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileUUID = uuidv4();
    const filePath = `${folderPath}/${fileUUID}`;

    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

    fileDocument.localPath = filePath;
    const result = await dbClient.client.db().collection('files').insertOne(fileDocument);
    fileDocument = {
      id: result.insertedId,
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
    };
    // fileDocument.id = result.insertedId;

    return res.status(201).json(fileDocument);
  },

  async getShow(req, res) {
    const token = req.header('X-Token');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userIdFromRedis = await redisClient.get(key);

    if (!userIdFromRedis) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userIdforMongo = new ObjectID(userIdFromRedis);

    const user = await dbClient.client.db().collection('users').findOne({ _id: userIdforMongo });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const fileId = req.params.id;
    const fileObjectId = new ObjectID(fileId);
    const userFile = await dbClient.client.db().collection('files').findOne({ userId: user._id, _id: fileObjectId });

    if (!userFile) {
      return res.status(404).json({ error: 'Not found' });
    }
    // return res.json(userFile);
    const formattedUserFile = {
      id: userFile._id.toString(),
      userId: userFile.userId.toString(),
      name: userFile.name,
      type: userFile.type,
      isPublic: userFile.isPublic,
      parentId: userFile.parentId,
    };

    return res.json(formattedUserFile);
  },

  async getIndex(req, res) {
    const token = req.header('X-Token');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userIdFromRedis = await redisClient.get(key);
    const userIdforMongo = new ObjectID(userIdFromRedis);

    const user = await dbClient.client.db().collection('users').findOne({ _id: userIdforMongo });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId } = req.query;
    const page = parseInt(req.query.page, 10) || 0;
    const perpage = 20;
    const skip = page * perpage;

    if (parentId) {
      const files = await dbClient.client
        .db()
        .collection('files')
        .find({ userId: user._id, parentId })
        .skip(skip)
        .limit(perpage)
        .toArray();

      // return res.json(files);
      const formattedFiles = files
        .map(({
          _id, userId, name, type, isPublic, parentId,
        }) => ({
          id: _id.toString(),
          userId: userId.toString(),
          name,
          type,
          isPublic,
          parentId,
        }));

      return res.json(formattedFiles);
    }
    const files = await dbClient.client
      .db()
      .collection('files')
      .find({ userId: user._id })
      .skip(skip)
      .limit(perpage)
      .toArray();

    // return res.json(files);
    const formattedFiles = files
      .map(({
        _id, userId, name, type, isPublic, parentId,
      }) => ({
        id: _id.toString(),
        userId: userId.toString(),
        name,
        type,
        isPublic,
        parentId,
      }));

    return res.json(formattedFiles);
  },

  async putPublish(req, res) {
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

async putUnpublish(req, res) {
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
