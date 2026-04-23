import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

import { API_URL as API } from '../config';

const REACTIONS = ['👍','👏','❤️','😂','😮','🎉','🔥','👋'];

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState('');
  const [joinPass, setJoinPass] = useState('');
  const [meetTitle, setMeetTitle] = useState('');
  const [meetPass, setMeetPass] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('join');
  const [copied, setCopied] = useState(false);

  const createMeeting = async () => {
    try {
      const { data } = await axios.post(`${API}/api/meetings/create`, { title: meetTitle, password: meetPass });
      navigate(`/meeting/${data.meetingId}`, { state: { role: 'admin', password: meetPass } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create meeting');
    }
  };

  const joinMeeting = async () => {
    if (!joinId.trim()) return setError('Enter a meeting ID');
    try {
      await axios.post(`${API}/api/meetings/${joinId}/join`, { password: joinPass });
      navigate(`/meeting/${joinId}`, { state: { role: 'participant', password: joinPass } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join meeting');
    }
  };

  const copyLink = () => {
    if (!joinId.trim()) return;
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${joinId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.navLogo}>📹 SmartMeet</div>
        <div style={styles.navRight}>
          <div style={styles.secBadge}>🔒 End-to-End Encrypted</div>
          <span style={styles.userName}>👤 {user?.name}</span>
          <button style={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Video calls and meetings for everyone</h1>
        <p style={styles.heroSub}>Connect, collaborate, and celebrate from anywhere with SmartMeet</p>

        {/* Feature badges */}
        <div style={styles.badges}>
          {['🔒 Encrypted','📅 Calendar Ready','📧 Gmail Join','🎙️ Noise Reduction','😊 Reactions','🔗 Link Join','📝 Notes Share','👥 Multi-Participant'].map(f => (
            <span key={f} style={styles.badge}>{f}</span>
          ))}
        </div>

        <div style={styles.card}>
          <div style={styles.tabs}>
            {['join', 'create'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                style={{ ...styles.tab, ...(tab === t ? styles.activeTab : {}) }}>
                {t === 'join' ? '🔗 Join Meeting' : '➕ New Meeting'}
              </button>
            ))}
          </div>
          {error && <p style={styles.error}>{error}</p>}
          {tab === 'join' ? (
            <form style={styles.form} onSubmit={e => { e.preventDefault(); joinMeeting(); }}>
              <input style={styles.input} placeholder="Enter meeting code or link" value={joinId}
                autoComplete="off"
                onChange={e => {
                  const val = e.target.value;
                  const match = val.match(/\/meeting\/([^/?]+)/);
                  setJoinId(match ? match[1] : val);
                }} />
              <input style={styles.input} type="password" placeholder="Password (if any)" value={joinPass}
                autoComplete="current-password"
                onChange={e => setJoinPass(e.target.value)} />
              <div style={styles.row}>
                <button style={styles.btn} type="submit">Join Now</button>
                <button style={{ ...styles.outlineBtn }} type="button" onClick={copyLink} title="Copy meeting link">
                  {copied ? '✅ Copied!' : '🔗 Copy Link'}
                </button>
              </div>
              <div style={styles.gmailHint}>📧 Received a Gmail invite? Paste the meeting link above</div>
            </form>
          ) : (
            <form style={styles.form} onSubmit={e => { e.preventDefault(); createMeeting(); }}>
              <input style={styles.input} placeholder="Meeting title (optional)" value={meetTitle}
                autoComplete="off"
                onChange={e => setMeetTitle(e.target.value)} />
              <input style={styles.input} type="password" placeholder="Set password (optional)" value={meetPass}
                autoComplete="new-password"
                onChange={e => setMeetPass(e.target.value)} />
              <button style={styles.btn} type="submit">Create & Start</button>
              <div style={styles.gmailHint}>📅 Add to Google Calendar after creating</div>
            </form>
          )}
        </div>

        {/* Emoji reactions preview */}
        <div style={styles.reactionsRow}>
          <span style={styles.reactionsLabel}>Quick Reactions in meeting:</span>
          {REACTIONS.map(r => <span key={r} style={styles.reactionPreview}>{r}</span>)}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', color: '#fff' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', gap: 10 },
  navLogo: { fontSize: 22, fontWeight: 700, color: '#4fc3f7' },
  navRight: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  secBadge: { fontSize: 12, background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', padding: '4px 10px', borderRadius: 20 },
  userName: { fontSize: 14, color: '#ccc' },
  logoutBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13 },
  hero: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 70px)', padding: 24, gap: 20 },
  heroTitle: { fontSize: 38, fontWeight: 700, textAlign: 'center', margin: 0, maxWidth: 600 },
  heroSub: { fontSize: 17, color: '#aaa', textAlign: 'center', margin: 0 },
  badges: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 640 },
  badge: { fontSize: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', padding: '5px 12px', borderRadius: 20, color: '#ccc' },
  card: { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, border: '1px solid rgba(255,255,255,0.1)' },
  tabs: { display: 'flex', marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' },
  tab: { flex: 1, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#aaa' },
  activeTab: { background: '#1a73e8', color: '#fff' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, outline: 'none' },
  error: { color: '#ff6b6b', fontSize: 13, margin: '0 0 4px' },
  row: { display: 'flex', gap: 10 },
  btn: { flex: 1, padding: 13, borderRadius: 8, border: 'none', background: '#1a73e8', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  outlineBtn: { padding: '13px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  gmailHint: { fontSize: 12, color: '#888', textAlign: 'center' },
  reactionsRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  reactionsLabel: { fontSize: 13, color: '#888' },
  reactionPreview: { fontSize: 22, cursor: 'default' },
};

export default Home;
