require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smartmeet_secret_2024';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://smartmeet-client.onrender.com';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./src/config');

const app = express();
const server = http.createServer(app);

// Allow all origins to fix CORS on Render
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

connectDB();

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/meetings', require('./src/routes/meeting'));
app.use('/api/files', require('./src/routes/upload'));

require('./src/socket')(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
