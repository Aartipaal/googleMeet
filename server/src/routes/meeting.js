const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Meeting = require('../models/Meeting');
const auth = require('../middleware/auth');

const router = express.Router();

// Create meeting
router.post('/create', auth, async (req, res) => {
  try {
    const { title, password } = req.body;
    const meeting = await Meeting.create({
      title: title || 'My Meeting',
      password,
      host: req.user._id,
      participants: [{
        user: req.user._id,
        name: req.user.name,
        role: 'admin',
        permissions: { mic: true, camera: true, screenShare: true, smartBoard: true },
      }],
    });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get meeting info
router.get('/:meetingId', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId })
      .populate('host', 'name email avatar')
      .populate('participants.user', 'name email avatar');
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Join meeting
router.post('/:meetingId/join', auth, async (req, res) => {
  try {
    const { password } = req.body;
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId, isActive: true });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found or ended' });
    if (meeting.password && meeting.password !== password)
      return res.status(403).json({ message: 'Wrong password' });
    const existing = meeting.participants.find(p => p.user?.toString() === req.user._id.toString());
    if (!existing) {
      meeting.participants.push({
        user: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: 'participant',
        joinedAt: new Date(),
        sessions: [{ joinedAt: new Date() }],
        present: true,
      });
    } else {
      // Re-join: add new session
      existing.sessions.push({ joinedAt: new Date() });
      existing.present = true;
      existing.leftAt = undefined;
    }
    await meeting.save();
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark leave (called on disconnect via socket, also available as REST)
router.post('/:meetingId/leave', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    const participant = meeting.participants.find(p => p.user?.toString() === req.user._id.toString());
    if (participant) {
      const now = new Date();
      participant.leftAt = now;
      participant.present = false;
      const lastSession = participant.sessions[participant.sessions.length - 1];
      if (lastSession && !lastSession.leftAt) {
        lastSession.leftAt = now;
        lastSession.duration = Math.floor((now - lastSession.joinedAt) / 1000);
        participant.totalDuration = participant.sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      }
      await meeting.save();
    }
    res.json({ message: 'Left' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get attendance report
router.get('/:meetingId/attendance', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId })
      .populate('participants.user', 'name email')
      .populate('host', 'name email');
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    const meetingDuration = meeting.endedAt
      ? Math.floor((meeting.endedAt - meeting.startedAt) / 1000)
      : Math.floor((new Date() - meeting.startedAt) / 1000);
    const report = meeting.participants.map(p => ({
      name: p.name,
      email: p.email || p.user?.email || '',
      role: p.role,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      totalDuration: p.totalDuration || 0,
      sessions: p.sessions,
      present: p.present,
      attendancePercent: meetingDuration > 0 ? Math.min(100, Math.round((p.totalDuration / meetingDuration) * 100)) : 100,
    }));
    res.json({ meetingId: meeting.meetingId, title: meeting.title, startedAt: meeting.startedAt, endedAt: meeting.endedAt, meetingDuration, participants: report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// End meeting (admin only)
router.post('/:meetingId/end', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    if (meeting.host.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Only host can end meeting' });
    meeting.isActive = false;
    meeting.endedAt = new Date();
    await meeting.save();
    res.json({ message: 'Meeting ended' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user's meetings
router.get('/user/history', auth, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ host: req.user._id }, { 'participants.user': req.user._id }]
    }).sort({ createdAt: -1 }).limit(20).populate('host', 'name');
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
