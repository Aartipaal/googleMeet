require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smartmeet_secret_2024';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://smartmeet-client.onrender.com';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./src/config');

const app = express();
const server = http.createServer(app);

// CORS — must be first middleware before anything else
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'false');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: false },
  transports: ['polling', 'websocket'],
});

connectDB();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.json({ status: 'SmartMeet API running', time: new Date() }));
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/meetings', require('./src/routes/meeting'));
app.use('/api/files', require('./src/routes/upload'));

require('./src/socket')(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
