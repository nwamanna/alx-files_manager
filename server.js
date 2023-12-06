import express from 'express';
import bodyParser from 'body-parser';

const router = require('./routes/index');

const app = express();

const port = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use('/', router);

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});

