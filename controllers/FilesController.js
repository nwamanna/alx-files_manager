const { ObjectID } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const mime = require('mime-types');
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

    const fileId = req.params.id;
    const fileObjectId = new ObjectID(fileId);

    const file = await dbClient.client.db().collection('files').findOne({ userId: user._id, _id: fileObjectId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    const updatedFile = await dbClient.client.db().collection('files')
      .findOneAndUpdate(
        { userId: user._id, _id: fileObjectId },
        { $set: { isPublic: true } },
        { returnOriginal: false },
      );

    if (!updatedFile) {
      return res.status(404).json({ error: 'Not found' });
    }
    const formattedFile = {
      id: updatedFile.value._id.toString(),
      userId: updatedFile.value.userId.toString(),
      name: updatedFile.value.name,
      type: updatedFile.value.type,
      isPublic: updatedFile.value.isPublic,
      parentId: updatedFile.value.parentId,
    };

    return res.status(200).json(formattedFile);
  },

  async putUnPublish(req, res) {
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

    const fileId = req.params.id;
    const fileObjectId = new ObjectID(fileId);

    const file = await dbClient.client.db().collection('files').findOne({ userId: user._id, _id: fileObjectId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    const updatedFile = await dbClient.client.db().collection('files')
      .findOneAndUpdate(
        { userId: user._id, _id: fileObjectId },
        { $set: { isPublic: false } },
        { returnOriginal: false },
      );

    if (!updatedFile) {
      return res.status(404).json({ error: 'Not found' });
    }
    const formattedFile = {
      id: updatedFile.value._id.toString(),
      userId: updatedFile.value.userId.toString(),
      name: updatedFile.value.name,
      type: updatedFile.value.type,
      isPublic: updatedFile.value.isPublic,
      parentId: updatedFile.value.parentId,
    };

    return res.status(200).json(formattedFile);
  },

  async getFile(req, res) {
    const token = req.header('X-Token');

    const key = `auth_${token}`;
    const userIdFromRedis = await redisClient.get(key);
    const userIdforMongo = new ObjectID(userIdFromRedis);

    const user = await dbClient.client.db().collection('users').findOne({ _id: userIdforMongo });

    const fileId = req.params.id;
    const fileObjectId = new ObjectID(fileId);
    const fileDocument = await dbClient.client.db().collection('files').findOne({ _id: fileObjectId });

    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!fileDocument.isPublic
        && (!user || user._id.toString() !== fileDocument.userId.toString())) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (fileDocument.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    const filePath = fileDocument.localPath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const contentType = mime.contentType(fileDocument.name);
    const content = fs.readFileSync(filePath, 'utf8');

    res.setHeader('Content-Type', contentType);
    return res.status(200).send(content);
  },

};

module.exports = FilesController;
