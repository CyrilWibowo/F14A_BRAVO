import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan(':method :url :status'));

app.get('/echo', (req, res) => {
  res.json({ message: req.query.message || 'echo' });
});

const PORT = 5005;

const server = app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

export default server;
