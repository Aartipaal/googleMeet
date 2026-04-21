# SmartMeet - Collaborative Video Meeting Platform

## Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)

## Setup & Run

### 1. Backend
```bash
cd server
# Edit .env with your MongoDB URI and email credentials
npm run dev
```

### 2. Frontend (new terminal)
```bash
cd client
npm start
```

App opens at: http://localhost:3000
API runs at:  http://localhost:5000

## .env (server)
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/googlemeet
JWT_SECRET=change_this_secret
CLIENT_URL=http://localhost:3000
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
```

## Features
- Video/Audio conferencing (WebRTC)
- Smart Board with draw/erase/shapes/text/image upload
- Admin permission controls (mic, camera, screen share, board)
- Real-time chat with file/image sharing
- Screen sharing
- Session recording (downloads as .webm)
- Raise hand
- Kick participants
- OTP + Email/Password login
- Grid & Speaker view
