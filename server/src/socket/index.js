const jwt = require('jsonwebtoken');
const Meeting = require('../models/Meeting');

// roomId -> { participants: Map<socketId, {userId, name, role}> }
const rooms = new Map();

const verifyToken = (token) => {
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
};

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const decoded = verifyToken(token);
    if (!decoded) return next(new Error('Unauthorized'));
    socket.userId = decoded.id;
    next();
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // ─── WebRTC Signaling ───────────────────────────────────────────
    socket.on('join-room', async ({ roomId, userId, name, role }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userName = name;
      socket.userRole = role;

      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      rooms.get(roomId).set(socket.id, { userId, name, role, socketId: socket.id });

      // Notify others
      socket.to(roomId).emit('user-joined', { socketId: socket.id, userId, name, role });

      // Send existing participants to new joiner
      const participants = [...rooms.get(roomId).entries()]
        .filter(([sid]) => sid !== socket.id)
        .map(([sid, data]) => ({ socketId: sid, ...data }));
      socket.emit('existing-participants', participants);

      // Update meeting in DB
      await Meeting.findOneAndUpdate(
        { meetingId: roomId, 'participants.user': userId },
        { $set: { 'participants.$.joinedAt': new Date() } }
      );
    });

    socket.on('offer', ({ to, offer }) => {
      io.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // ─── Chat ────────────────────────────────────────────────────────
    socket.on('chat-message', async ({ roomId, message }) => {
      const msg = { ...message, socketId: socket.id, timestamp: new Date() };
      io.to(roomId).emit('chat-message', msg);
      await Meeting.findOneAndUpdate(
        { meetingId: roomId },
        { $push: { messages: { sender: socket.userId, senderName: message.senderName, content: message.content, type: message.type || 'text', fileUrl: message.fileUrl, fileName: message.fileName } } }
      );
    });

    // ─── Smart Board ─────────────────────────────────────────────────
    socket.on('board-draw', ({ roomId, data }) => {
      socket.to(roomId).emit('board-draw', data);
    });

    socket.on('board-clear', ({ roomId }) => {
      io.to(roomId).emit('board-clear');
    });

    socket.on('board-image', ({ roomId, imageData }) => {
      socket.to(roomId).emit('board-image', imageData);
    });

    socket.on('board-state', ({ roomId, state }) => {
      socket.to(roomId).emit('board-state', state);
    });

    // ─── Admin Controls ──────────────────────────────────────────────
    socket.on('update-permission', async ({ roomId, targetSocketId, permission, value }) => {
      io.to(targetSocketId).emit('permission-changed', { permission, value });
      io.to(roomId).emit('participant-permission-updated', { socketId: targetSocketId, permission, value });
    });

    socket.on('kick-participant', ({ roomId, targetSocketId }) => {
      io.to(targetSocketId).emit('kicked');
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) targetSocket.leave(roomId);
      if (rooms.has(roomId)) rooms.get(roomId).delete(targetSocketId);
      io.to(roomId).emit('user-left', { socketId: targetSocketId });
    });

    socket.on('mute-all', ({ roomId }) => {
      socket.to(roomId).emit('force-mute');
    });

    // ─── Media State ─────────────────────────────────────────────────
    socket.on('media-state', ({ roomId, audio, video }) => {
      socket.to(roomId).emit('media-state', { socketId: socket.id, audio, video });
    });

    socket.on('screen-share-started', ({ roomId }) => {
      socket.to(roomId).emit('screen-share-started', { socketId: socket.id });
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
      socket.to(roomId).emit('screen-share-stopped', { socketId: socket.id });
    });

    // ─── Raise Hand ──────────────────────────────────────────────────
    socket.on('raise-hand', ({ roomId, raised }) => {
      io.to(roomId).emit('hand-raised', { socketId: socket.id, name: socket.userName, raised });
    });

    socket.on('reaction', ({ roomId, emoji, name }) => {
      socket.to(roomId).emit('reaction', { emoji, name });
    });

    // ─── Recording ───────────────────────────────────────────────────
    socket.on('recording-started', ({ roomId }) => {
      socket.to(roomId).emit('recording-started', { by: socket.userName });
    });

    socket.on('recording-stopped', async ({ roomId, recordingUrl }) => {
      socket.to(roomId).emit('recording-stopped');
      if (recordingUrl) {
        await Meeting.findOneAndUpdate({ meetingId: roomId }, { recordingUrl });
      }
    });

    // ─── Disconnect ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomId = socket.roomId;
      const isHost = socket.userRole === 'admin';

      if (roomId && rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        if (rooms.get(roomId).size === 0) rooms.delete(roomId);
      }
      socket.to(roomId).emit('user-left', { socketId: socket.id });

      // Update attendance on disconnect
      const saveAttendance = (meeting) => {
        const p = meeting.participants.find(x => x.user?.toString() === socket.userId);
        if (p) {
          const now = new Date();
          p.leftAt = now;
          p.present = false;
          const last = p.sessions[p.sessions.length - 1];
          if (last && !last.leftAt) {
            last.leftAt = now;
            last.duration = Math.floor((now - last.joinedAt) / 1000);
            p.totalDuration = p.sessions.reduce((s, x) => s + (x.duration || 0), 0);
          }
        }
        return meeting.save();
      };

      if (socket.userId && roomId) {
        Meeting.findOne({ meetingId: roomId }).then(async meeting => {
          if (!meeting) return;
          await saveAttendance(meeting);

          // If host disconnected → end meeting + push attendance to all students
          if (isHost) {
            meeting.isActive = false;
            meeting.endedAt = new Date();
            await meeting.save();

            // Build each participant's personal attendance and emit
            const meetingDuration = Math.floor((meeting.endedAt - meeting.startedAt) / 1000);
            meeting.participants.forEach(p => {
              const pct = meetingDuration > 0
                ? Math.min(100, Math.round((p.totalDuration / meetingDuration) * 100))
                : 100;
              // find socket of this participant
              const roomSockets = rooms.get(roomId);
              if (roomSockets) {
                roomSockets.forEach((data, sid) => {
                  if (data.userId === p.user?.toString()) {
                    io.to(sid).emit('your-attendance', {
                      name: p.name,
                      joinedAt: p.joinedAt,
                      leftAt: p.leftAt,
                      totalDuration: p.totalDuration,
                      attendancePercent: pct,
                      sessions: p.sessions,
                      meetingTitle: meeting.title,
                      meetingId: meeting.meetingId,
                    });
                  }
                });
              }
            });
            // Notify all participants that host ended the meeting
            io.to(roomId).emit('meeting-ended-by-host', { meetingId: roomId });
          }
        }).catch(() => {});
      }
    });
  });
};
