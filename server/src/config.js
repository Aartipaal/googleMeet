const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://googlemeett:Hp99275606@cluster0.tlalb3v.mongodb.net/googlemeet?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
