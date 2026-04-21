# SmartMeet - Render Deployment Guide

## Deploy Backend (Web Service)

1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

4. Add Environment Variables:
   - PORT = 10000
   - MONGO_URI = mongodb+srv://googlemeett:Hp99275606@cluster0.tlalb3v.mongodb.net/googlemeet?retryWrites=true&w=majority
   - JWT_SECRET = your_super_secret_jwt_key
   - CLIENT_URL = https://your-frontend.onrender.com
   - EMAIL_USER = your@gmail.com
   - EMAIL_PASS = your_app_password

## Deploy Frontend (Static Site)

1. Go to Render → New → Static Site
2. Connect same GitHub repo
3. Settings:
   - Root Directory: `client`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`

4. Add Environment Variables:
   - REACT_APP_API_URL = https://your-backend.onrender.com
   - REACT_APP_SOCKET_URL = https://your-backend.onrender.com

## After Deploy

- Update CLIENT_URL in backend env to your actual frontend URL
- Update REACT_APP_API_URL and REACT_APP_SOCKET_URL in frontend env to your actual backend URL
- Redeploy both services after updating URLs
