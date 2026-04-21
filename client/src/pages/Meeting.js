import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { initSocket, disconnectSocket } from '../hooks/useSocket';
import useWebRTC from '../hooks/useWebRTC';
import VideoTile from '../components/VideoTile';
import Chat from '../components/Chat';
import SmartBoard from '../components/SmartBoard';
import AdminPanel from '../components/AdminPanel';
import Attendance, { MyAttendanceCard } from '../components/Attendance';

const API = process.env.REACT_APP_API_URL;
const REACTIONS = ['👍','👏','❤️','😂','😮','🎉','🔥','👋'];

const Meeting = () => {
  const { meetingId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.state?.role || 'participant';

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioContextRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [panel, setPanel] = useState(null);
  const [permissions, setPermissions] = useState({ mic: true, camera: true, screenShare: role === 'admin', smartBoard: role === 'admin' });
  const [notifications, setNotifications] = useState([]);
  const [gridView, setGridView] = useState(true);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [showReactions, setShowReactions] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [myAttendance, setMyAttendance] = useState(null); // shown to student when host leaves

  const { remoteStreams, replaceTrack, closeAll } = useWebRTC(socketRef, meetingId, localStream);

  const notify = useCallback((msg) => {
    const id = Date.now();
    setNotifications(n => [...n, { id, msg }]);
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 4000);
  }, []);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (s) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // Init media + socket
  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        notify('Camera/mic access denied');
      }

      const socket = initSocket(token);
      socketRef.current = socket;
      socket.emit('join-room', { roomId: meetingId, userId: user.id, name: user.name, role });

      // populate existing participants when admin joins
      socket.on('existing-participants', (list) => {
        setParticipants(list.map(p => ({
          socketId: p.socketId,
          name: p.name,
          role: p.role || 'participant',
          permissions: { mic: true, camera: true, screenShare: false, smartBoard: false },
          active: true,
        })));
      });

      socket.on('user-joined', ({ socketId, name, role: joinedRole }) => {
        notify(`${name} joined`);
        setParticipants(p => [...p.filter(x => x.socketId !== socketId), { socketId, name, role: joinedRole || 'participant', permissions: { mic: true, camera: true, screenShare: false, smartBoard: false }, active: true }]);
      });
      socket.on('user-left', ({ socketId }) => setParticipants(p => p.filter(x => x.socketId !== socketId)));
      socket.on('chat-message', (msg) => setMessages(m => [...m, msg]));
      socket.on('permission-changed', ({ permission, value }) => {
        setPermissions(p => ({ ...p, [permission]: value }));
        notify(`Admin ${value ? 'granted' : 'revoked'} your ${permission} permission`);
      });
      socket.on('participant-permission-updated', ({ socketId, permission, value }) => {
        setParticipants(p => p.map(x => x.socketId === socketId ? { ...x, permissions: { ...x.permissions, [permission]: value } } : x));
      });
      socket.on('media-state', ({ socketId, audio, video }) => {
        setParticipants(p => p.map(x => x.socketId === socketId ? { ...x, audioOn: audio, videoOn: video } : x));
      });
      socket.on('hand-raised', ({ socketId, name, raised }) => {
        if (raised) notify(`✋ ${name} raised their hand`);
        setParticipants(p => p.map(x => x.socketId === socketId ? { ...x, handRaised: raised } : x));
      });
      socket.on('force-mute', () => { toggleAudio(false); notify('Admin muted you'); });
      socket.on('kicked', () => { notify('You were removed from the meeting'); setTimeout(() => navigate('/'), 2000); });
      socket.on('recording-started', ({ by }) => notify(`🔴 ${by} started recording`));
      socket.on('recording-stopped', () => notify('⏹️ Recording stopped'));
      socket.on('reaction', ({ emoji, name }) => {
        const id = Date.now() + Math.random();
        setFloatingReactions(r => [...r, { id, emoji, name }]);
        setTimeout(() => setFloatingReactions(r => r.filter(x => x.id !== id)), 3000);
      });

      // Host left → show personal attendance card to each student
      socket.on('your-attendance', (data) => {
        setMyAttendance(data);
      });

      // Meeting ended by host → redirect after showing attendance
      socket.on('meeting-ended-by-host', () => {
        notify('👑 Host ended the meeting');
      });

      try {
        const { data } = await axios.get(`${API}/api/meetings/${meetingId}`);
        setMessages(data.messages || []);
      } catch {}
    };

    init();
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
      closeAll();
      socketRef.current?.emit('leave-room', { roomId: meetingId });
      disconnectSocket();
    };
  }, []); // eslint-disable-line

  const toggleAudio = useCallback((force) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = force !== undefined ? force : !audioOn;
    stream.getAudioTracks().forEach(t => (t.enabled = enabled));
    setAudioOn(enabled);
    socketRef.current?.emit('media-state', { roomId: meetingId, audio: enabled, video: videoOn });
  }, [audioOn, videoOn, meetingId]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !videoOn;
    stream.getVideoTracks().forEach(t => (t.enabled = enabled));
    setVideoOn(enabled);
    socketRef.current?.emit('media-state', { roomId: meetingId, audio: audioOn, video: enabled });
  }, [videoOn, audioOn, meetingId]);

  const toggleScreenShare = useCallback(async () => {
    if (!permissions.screenShare && role !== 'admin') return notify('Screen share not permitted');
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      replaceTrack(localStreamRef.current);
      setScreenSharing(false);
      socketRef.current?.emit('screen-share-stopped', { roomId: meetingId });
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        replaceTrack(screen);
        setScreenSharing(true);
        socketRef.current?.emit('screen-share-started', { roomId: meetingId });
        screen.getVideoTracks()[0].onended = () => {
          replaceTrack(localStreamRef.current);
          setScreenSharing(false);
          socketRef.current?.emit('screen-share-stopped', { roomId: meetingId });
        };
      } catch { notify('Screen share cancelled'); }
    }
  }, [screenSharing, permissions, role, meetingId, replaceTrack, notify]);

  const toggleRecording = useCallback(() => {
    if (!recording) {
      const stream = localStreamRef.current;
      if (!stream) return;
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `meeting-${meetingId}.webm`;
        a.click();
        socketRef.current?.emit('recording-stopped', { roomId: meetingId });
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      socketRef.current?.emit('recording-started', { roomId: meetingId });
    } else {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
  }, [recording, meetingId]);

  const toggleHand = useCallback(() => {
    const raised = !handRaised;
    setHandRaised(raised);
    socketRef.current?.emit('raise-hand', { roomId: meetingId, raised });
  }, [handRaised, meetingId]);

  // Noise reduction uses browser built-in constraints (echoCancellation/noiseSuppression already on)
  const toggleNoiseReduction = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ noiseSuppression: !noiseReduction, echoCancellation: !noiseReduction });
      setNoiseReduction(n => !n);
      notify(`Noise reduction ${!noiseReduction ? 'enabled' : 'disabled'}`);
    } catch { notify('Noise reduction not supported by your browser'); }
  }, [noiseReduction, notify]);

  const sendReaction = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    setFloatingReactions(r => [...r, { id, emoji, name: user.name }]);
    setTimeout(() => setFloatingReactions(r => r.filter(x => x.id !== id)), 3000);
    socketRef.current?.emit('reaction', { roomId: meetingId, emoji, name: user.name });
    setShowReactions(false);
  }, [meetingId, user]);

  const copyInviteLink = () => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const addToCalendar = () => {
    const title = encodeURIComponent(`SmartMeet: ${meetingId}`);
    const details = encodeURIComponent(`Join at: ${window.location.href}`);
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    const fmt = d => d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${fmt(now)}/${fmt(end)}`, '_blank');
    setCalendarAdded(true);
  };

  const endMeeting = async () => {
    if (role === 'admin') {
      try { await axios.post(`${API}/api/meetings/${meetingId}/end`); } catch {}
    }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    closeAll();
    navigate('/');
  };

  const allStreams = [
    { socketId: 'local', stream: localStream, name: user?.name, isLocal: true, audioOn, videoOn },
    ...Object.entries(remoteStreams).map(([socketId, stream]) => {
      const p = participants.find(x => x.socketId === socketId);
      return { socketId, stream, name: p?.name || 'Participant', audioOn: p?.audioOn !== false, videoOn: p?.videoOn !== false };
    }),
  ];

  const cols = Math.ceil(Math.sqrt(allStreams.length)) || 1;
  const gridStyle = gridView
    ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, padding: 8 }
    : { display: 'flex', flexDirection: 'column', gap: 8, padding: 8 };

  return (
    <div style={styles.page}>
      {/* Student attendance card shown when host leaves */}
      {myAttendance && (
        <MyAttendanceCard
          data={myAttendance}
          onClose={() => { setMyAttendance(null); navigate('/'); }}
        />
      )}
      {/* Floating reactions */}
      <div style={styles.floatingArea}>
        {floatingReactions.map(r => (
          <div key={r.id} style={styles.floatingReaction}>
            <span style={{ fontSize: 32 }}>{r.emoji}</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>{r.name}</span>
          </div>
        ))}
      </div>

      {/* Notifications */}
      <div style={styles.notifications}>
        {notifications.map(n => <div key={n.id} style={styles.notif}>{n.msg}</div>)}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={styles.modal}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <span>🔗 Invite Participants</span>
              <button style={styles.closeBtn} onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.secInfo}>🔒 This meeting is end-to-end encrypted via WebRTC</div>
              <label style={styles.label}>Meeting Code</label>
              <div style={styles.codeBox}>{meetingId}</div>
              <label style={styles.label}>Meeting Link</label>
              <div style={styles.linkBox}>{window.location.origin}/meeting/{meetingId}</div>
              <div style={styles.modalBtns}>
                <button style={styles.modalBtn} onClick={copyInviteLink}>
                  {inviteCopied ? '✅ Copied!' : '📋 Copy Link'}
                </button>
                <button style={styles.modalBtn} onClick={addToCalendar}>
                  📅 {calendarAdded ? 'Added!' : 'Add to Google Calendar'}
                </button>
                <a style={styles.modalBtn}
                  href={`mailto:?subject=Join my SmartMeet&body=Join my meeting: ${window.location.origin}/meeting/${meetingId}`}>
                  📧 Invite via Gmail
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotes && (
        <div style={styles.modal}>
          <div style={{ ...styles.modalBox, width: 500 }}>
            <div style={styles.modalHeader}>
              <span>📝 Meeting Notes</span>
              <button style={styles.closeBtn} onClick={() => setShowNotes(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <textarea style={styles.notesArea} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Take notes here... (saved locally)" />
              <div style={styles.modalBtns}>
                <button style={styles.modalBtn} onClick={() => {
                  const blob = new Blob([notes], { type: 'text/plain' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `notes-${meetingId}.txt`;
                  a.click();
                }}>💾 Download Notes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div style={styles.main}>
        <div style={{ ...styles.videoArea, width: panel ? 'calc(100% - 340px)' : '100%' }}>
          <div style={styles.meetingInfo}>
            <span style={styles.meetingIdBadge}>📋 {meetingId}</span>
            <span style={styles.timerBadge}>⏱ {formatTime(elapsed)}</span>
            {recording && <span style={styles.recBadge}>🔴 REC</span>}
            {role === 'admin' && <span style={styles.adminBadge}>👑 Host</span>}
            <span style={styles.secBadge}>🔒 Encrypted</span>
            <span style={styles.participantCount}>👥 {allStreams.length}</span>
          </div>
          <div style={gridStyle}>
            {allStreams.map(s => (
              <VideoTile key={s.socketId} stream={s.stream} name={s.name}
                isLocal={s.isLocal} audioOn={s.audioOn} videoOn={s.videoOn} muted={s.isLocal} />
            ))}
          </div>
        </div>

        {panel && (
          <div style={styles.sidePanel}>
            {panel === 'chat' && <Chat socket={socketRef} roomId={meetingId} user={user} messages={messages} onClose={() => setPanel(null)} />}
            {panel === 'board' && <SmartBoard socket={socketRef} roomId={meetingId} canDraw={permissions.smartBoard || role === 'admin'} isAdmin={role === 'admin'} onClose={() => setPanel(null)} />}
            {panel === 'admin' && role === 'admin' && <AdminPanel participants={participants} socket={socketRef} roomId={meetingId} onClose={() => setPanel(null)} />}
            {panel === 'attendance' && <Attendance meetingId={meetingId} isAdmin={role === 'admin'} onClose={() => setPanel(null)} />}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.controlsLeft}>
          <CtrlBtn icon="🔗" label="Invite" onClick={() => setShowInvite(true)} />
          <CtrlBtn icon="📝" label="Notes" onClick={() => setShowNotes(true)} />
        </div>
        <div style={styles.controlsCenter}>
          <CtrlBtn icon={audioOn ? '🎤' : '🔇'} label={audioOn ? 'Mute' : 'Unmute'} active={!audioOn} onClick={() => toggleAudio()} />
          <CtrlBtn icon={videoOn ? '📷' : '📵'} label={videoOn ? 'Stop Cam' : 'Start Cam'} active={!videoOn} onClick={toggleVideo} />
          <CtrlBtn icon={screenSharing ? '🖥️' : '📺'} label="Screen" active={screenSharing} onClick={toggleScreenShare} />
          <CtrlBtn icon="✋" label="Hand" active={handRaised} onClick={toggleHand} />
          <CtrlBtn icon={noiseReduction ? '🎙️' : '🔊'} label="Noise" active={noiseReduction} onClick={toggleNoiseReduction} title="Noise Reduction" />
          <div style={{ position: 'relative' }}>
            <CtrlBtn icon="😊" label="React" active={showReactions} onClick={() => setShowReactions(s => !s)} />
            {showReactions && (
              <div style={styles.reactionPicker}>
                {REACTIONS.map(r => (
                  <button key={r} style={styles.reactionBtn} onClick={() => sendReaction(r)}>{r}</button>
                ))}
              </div>
            )}
          </div>
          <CtrlBtn icon={recording ? '⏹️' : '🔴'} label={recording ? 'Stop' : 'Record'} active={recording} onClick={toggleRecording} />
          <CtrlBtn icon="💬" label="Chat" active={panel === 'chat'} onClick={() => setPanel(p => p === 'chat' ? null : 'chat')} />
          <CtrlBtn icon="🎨" label="Board" active={panel === 'board'} onClick={() => setPanel(p => p === 'board' ? null : 'board')} />
          {role === 'admin' && <CtrlBtn icon="👑" label="Admin" active={panel === 'admin'} onClick={() => setPanel(p => p === 'admin' ? null : 'admin')} />}
          <CtrlBtn icon="📋" label="Attend" active={panel === 'attendance'} onClick={() => setPanel(p => p === 'attendance' ? null : 'attendance')} />
          <CtrlBtn icon="⊞" label={gridView ? 'Speaker' : 'Grid'} onClick={() => setGridView(v => !v)} />
        </div>
        <div style={styles.controlsRight}>
          <button style={styles.endBtn} onClick={endMeeting}>
            {role === 'admin' ? '⏹ End' : '📴 Leave'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CtrlBtn = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} style={{ ...ctrlStyles.btn, ...(active ? ctrlStyles.active : {}) }} title={label}>
    <span style={ctrlStyles.icon}>{icon}</span>
    <span style={ctrlStyles.label}>{label}</span>
  </button>
);

const ctrlStyles = {
  btn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: '#2d2d44', border: 'none', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', color: '#fff', minWidth: 52 },
  active: { background: '#1a73e8' },
  icon: { fontSize: 18 },
  label: { fontSize: 9, color: '#ccc' },
};

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1a', color: '#fff', overflow: 'hidden' },
  floatingArea: { position: 'fixed', bottom: 100, left: 20, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' },
  floatingReaction: { display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeUp 3s ease forwards', background: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: '6px 10px' },
  notifications: { position: 'fixed', top: 16, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 },
  notif: { background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBox: { background: '#1e1e2e', borderRadius: 16, width: 420, border: '1px solid #333', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #333', fontWeight: 600, fontSize: 15 },
  closeBtn: { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 18 },
  modalBody: { padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  secInfo: { background: '#22c55e11', border: '1px solid #22c55e33', color: '#22c55e', borderRadius: 8, padding: '8px 12px', fontSize: 13 },
  label: { fontSize: 12, color: '#888' },
  codeBox: { background: '#2d2d44', borderRadius: 8, padding: '10px 14px', fontSize: 18, fontWeight: 700, letterSpacing: 2, textAlign: 'center', color: '#4fc3f7' },
  linkBox: { background: '#2d2d44', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#aaa', wordBreak: 'break-all' },
  modalBtns: { display: 'flex', flexDirection: 'column', gap: 8 },
  modalBtn: { background: '#1a73e8', border: 'none', borderRadius: 8, padding: '11px', color: '#fff', fontSize: 14, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block' },
  notesArea: { width: '100%', height: 200, background: '#2d2d44', border: '1px solid #444', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, resize: 'vertical', outline: 'none' },
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  videoArea: { flex: 1, overflowY: 'auto', transition: 'width 0.3s' },
  meetingInfo: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', flexWrap: 'wrap' },
  meetingIdBadge: { fontSize: 12, color: '#aaa', background: '#2d2d44', padding: '4px 10px', borderRadius: 6 },
  timerBadge: { fontSize: 12, color: '#4fc3f7', background: '#2d2d44', padding: '4px 10px', borderRadius: 6 },
  recBadge: { fontSize: 12, background: '#ef444422', color: '#ef4444', padding: '4px 10px', borderRadius: 6 },
  adminBadge: { fontSize: 12, background: '#f59e0b22', color: '#f59e0b', padding: '4px 10px', borderRadius: 6 },
  secBadge: { fontSize: 12, background: '#22c55e22', color: '#22c55e', padding: '4px 10px', borderRadius: 6 },
  participantCount: { fontSize: 12, color: '#aaa', background: '#2d2d44', padding: '4px 10px', borderRadius: 6 },
  sidePanel: { width: 340, borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  controls: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#1e1e2e', borderTop: '1px solid #333', flexWrap: 'wrap', gap: 8 },
  controlsLeft: { display: 'flex', gap: 6 },
  controlsCenter: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  controlsRight: { display: 'flex', justifyContent: 'flex-end' },
  reactionPicker: { position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', background: '#2d2d44', borderRadius: 12, padding: 8, display: 'flex', gap: 4, border: '1px solid #444', zIndex: 100 },
  reactionBtn: { background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: '4px 6px', borderRadius: 8 },
  endBtn: { background: '#ef4444', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
};

export default Meeting;
