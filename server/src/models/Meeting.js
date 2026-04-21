const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const attendanceSessionSchema = new mongoose.Schema({
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date,
  duration: { type: Number, default: 0 }, // seconds
});

const participantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  email: String,
  role: { type: String, enum: ['admin', 'participant'], default: 'participant' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date,
  totalDuration: { type: Number, default: 0 }, // total seconds in meeting
  sessions: [attendanceSessionSchema], // multiple join/leave cycles
  present: { type: Boolean, default: true },
  permissions: {
    mic: { type: Boolean, default: true },
    camera: { type: Boolean, default: true },
    screenShare: { type: Boolean, default: false },
    smartBoard: { type: Boolean, default: false },
  },
});

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName: String,
  content: String,
  type: { type: String, enum: ['text', 'file', 'image'], default: 'text' },
  fileUrl: String,
  fileName: String,
  timestamp: { type: Date, default: Date.now },
});

const meetingSchema = new mongoose.Schema({
  meetingId: { type: String, default: () => uuidv4().slice(0, 10), unique: true },
  title: { type: String, default: 'My Meeting' },
  password: { type: String },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [participantSchema],
  messages: [messageSchema],
  isActive: { type: Boolean, default: true },
  recordingUrl: { type: String },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  smartBoardData: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
