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

// Manual CORS headers — applied before everything else
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

connectDB();

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/meetings', require('./src/routes/meeting'));
app.use('/api/files', require('./src/routes/upload'));

require('./src/socket')(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
