import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';

import { API_URL as API } from '../config';

const fmt = (s) => {
  if (!s && s !== 0) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const getColor = (pct) => pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';

// ─── Student Personal Attendance Card ────────────────────────────────────────
export const MyAttendanceCard = ({ data, onClose }) => (
  <div style={cardStyles.overlay}>
    <div style={cardStyles.box}>
      <div style={cardStyles.header}>
        <span>📋 Your Attendance</span>
      </div>
      <div style={cardStyles.body}>
        <div style={cardStyles.meetTitle}>{data.meetingTitle}</div>
        <div style={cardStyles.meetId}>Meeting ID: {data.meetingId}</div>

        <div style={{ ...cardStyles.pctCircle, borderColor: getColor(data.attendancePercent) }}>
          <span style={{ ...cardStyles.pctNum, color: getColor(data.attendancePercent) }}>{data.attendancePercent}%</span>
          <span style={cardStyles.pctLabel}>Attendance</span>
        </div>

        <div style={cardStyles.rows}>
          <div style={cardStyles.row}>
            <span style={cardStyles.rowLabel}>👤 Name</span>
            <span style={cardStyles.rowVal}>{data.name}</span>
          </div>
          <div style={cardStyles.row}>
            <span style={cardStyles.rowLabel}>🕐 Joined</span>
            <span style={cardStyles.rowVal}>{data.joinedAt ? new Date(data.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
          </div>
          <div style={cardStyles.row}>
            <span style={cardStyles.rowLabel}>🚪 Left</span>
            <span style={cardStyles.rowVal}>{data.leftAt ? new Date(data.leftAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
          </div>
          <div style={cardStyles.row}>
            <span style={cardStyles.rowLabel}>⏱ Duration</span>
            <span style={cardStyles.rowVal}>{fmt(data.totalDuration)}</span>
          </div>
          {data.sessions?.length > 1 && (
            <div style={cardStyles.row}>
              <span style={cardStyles.rowLabel}>🔄 Sessions</span>
              <span style={cardStyles.rowVal}>{data.sessions.length}</span>
            </div>
          )}
        </div>

        <div style={{ ...cardStyles.statusBanner, background: getColor(data.attendancePercent) + '22', border: `1px solid ${getColor(data.attendancePercent)}44`, color: getColor(data.attendancePercent) }}>
          {data.attendancePercent >= 75 ? '✅ Good Attendance' : data.attendancePercent >= 50 ? '⚠️ Average Attendance' : '❌ Low Attendance'}
        </div>

        <button style={cardStyles.closeBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
);

// ─── Admin Full Attendance Panel ──────────────────────────────────────────────
const Attendance = ({ meetingId, isAdmin, onClose }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState('');
  const [tab, setTab] = useState('list');
  const [search, setSearch] = useState('');
  const intervalRef = useRef(null);

  const fetchReport = async () => {
    try {
      const { data } = await axios.get(`${API}/api/meetings/${meetingId}/attendance`);
      setReport(data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchReport();
    intervalRef.current = setInterval(fetchReport, 10000);
    return () => clearInterval(intervalRef.current);
  }, [meetingId]); // eslint-disable-line

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/meeting/${meetingId}`, { width: 220, margin: 2, color: { dark: '#1a73e8', light: '#ffffff' } })
      .then(setQrUrl).catch(() => {});
  }, [meetingId]);

  const exportCSV = () => {
    if (!report) return;
    const rows = [
      ['Name', 'Email', 'Role', 'Joined At', 'Left At', 'Total Duration (sec)', 'Attendance %', 'Status'],
      ...report.participants.map(p => [
        p.name, p.email, p.role,
        p.joinedAt ? new Date(p.joinedAt).toLocaleString() : '',
        p.leftAt ? new Date(p.leftAt).toLocaleString() : 'In Meeting',
        p.totalDuration || 0,
        `${p.attendancePercent}%`,
        p.present ? 'Present' : 'Left',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `attendance-${meetingId}.csv`;
    a.click();
  };

  const filtered = report?.participants.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span>📋 {isAdmin ? 'Attendance Report' : 'My Attendance'}</span>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.tabRow}>
        <button onClick={() => setTab('list')} style={{ ...styles.tab, ...(tab === 'list' ? styles.activeTab : {}) }}>📊 Report</button>
        <button onClick={() => setTab('qr')} style={{ ...styles.tab, ...(tab === 'qr' ? styles.activeTab : {}) }}>📷 QR Join</button>
      </div>

      {tab === 'qr' && (
        <div style={styles.qrSection}>
          <p style={styles.qrLabel}>Scan to join this meeting</p>
          {qrUrl
            ? <img src={qrUrl} alt="QR" style={styles.qrImg} />
            : <div style={styles.qrPlaceholder}>Generating...</div>}
          <div style={styles.meetCode}>{meetingId}</div>
          <button style={styles.exportBtn} onClick={() => { const a = document.createElement('a'); a.href = qrUrl; a.download = `qr-${meetingId}.png`; a.click(); }}>
            💾 Download QR
          </button>
        </div>
      )}

      {tab === 'list' && (
        loading ? <div style={styles.loading}>Loading...</div> : !report ? <div style={styles.loading}>Failed to load</div> : (
          <>
            {/* Summary */}
            <div style={styles.summary}>
              {[
                { num: report.participants.length, label: 'Total', color: '#4fc3f7' },
                { num: report.participants.filter(p => p.present).length, label: 'Present', color: '#22c55e' },
                { num: report.participants.filter(p => !p.present).length, label: 'Left', color: '#ef4444' },
                { num: fmt(report.meetingDuration), label: 'Duration', color: '#f59e0b' },
              ].map(({ num, label, color }) => (
                <div key={label} style={styles.summaryItem}>
                  <span style={{ ...styles.summaryNum, color }}>{num}</span>
                  <span style={styles.summaryLabel}>{label}</span>
                </div>
              ))}
            </div>

            {/* Actions — admin only */}
            {isAdmin && (
              <div style={styles.actions}>
                <input style={styles.search} placeholder="🔍 Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
                <div style={styles.actionBtns}>
                  <button style={styles.exportBtn} onClick={exportCSV}>📥 Export CSV</button>
                  <button style={styles.refreshBtn} onClick={fetchReport}>🔄</button>
                </div>
              </div>
            )}

            {/* List */}
            <div style={styles.list}>
              {filtered.map((p, i) => (
                <div key={i} style={styles.item}>
                  <div style={styles.itemTop}>
                    <div style={styles.nameRow}>
                      <span style={{ ...styles.statusDot, background: p.present ? '#22c55e' : '#ef4444' }} />
                      <div>
                        <div style={styles.name}>{p.name} {p.role === 'admin' && <span style={styles.hostBadge}>Host</span>}</div>
                        <div style={styles.email}>{p.email}</div>
                      </div>
                    </div>
                    <div style={{ ...styles.pctBadge, background: getColor(p.attendancePercent) + '22', color: getColor(p.attendancePercent), border: `1px solid ${getColor(p.attendancePercent)}44` }}>
                      {p.attendancePercent}%
                    </div>
                  </div>

                  <div style={styles.progressBg}>
                    <div style={{ ...styles.progressFill, width: `${p.attendancePercent}%`, background: getColor(p.attendancePercent) }} />
                  </div>

                  <div style={styles.timeRow}>
                    <span style={styles.timeItem}>🕐 {p.joinedAt ? new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    <span style={styles.timeItem}>⏱ {fmt(p.totalDuration)}</span>
                    <span style={styles.timeItem}>{p.present ? '🟢 In Meeting' : '🔴 Left'}</span>
                    {p.sessions?.length > 1 && <span style={styles.timeItem}>🔄 {p.sessions.length} sessions</span>}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div style={styles.loading}>No participants found</div>}
            </div>
          </>
        )
      )}
    </div>
  );
};

const cardStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  box: { background: '#1e1e2e', borderRadius: 20, width: 340, border: '1px solid #333', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  header: { background: '#1a73e8', padding: '16px 20px', fontWeight: 700, fontSize: 16, color: '#fff', textAlign: 'center' },
  body: { padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  meetTitle: { fontSize: 16, fontWeight: 700, color: '#fff', textAlign: 'center' },
  meetId: { fontSize: 12, color: '#888' },
  pctCircle: { width: 110, height: 110, borderRadius: '50%', border: '6px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  pctNum: { fontSize: 28, fontWeight: 800 },
  pctLabel: { fontSize: 11, color: '#888' },
  rows: { width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#2d2d44', borderRadius: 8 },
  rowLabel: { fontSize: 13, color: '#888' },
  rowVal: { fontSize: 13, color: '#fff', fontWeight: 500 },
  statusBanner: { width: '100%', textAlign: 'center', padding: '10px', borderRadius: 10, fontWeight: 600, fontSize: 14 },
  closeBtn: { width: '100%', background: '#1a73e8', border: 'none', borderRadius: 10, padding: '12px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 15 },
};

const styles = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e2e', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #333', fontWeight: 600, fontSize: 15 },
  closeBtn: { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16 },
  tabRow: { display: 'flex', borderBottom: '1px solid #333' },
  tab: { flex: 1, padding: '10px', border: 'none', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  activeTab: { background: '#1a73e822', color: '#4fc3f7', borderBottom: '2px solid #1a73e8' },
  qrSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, gap: 14 },
  qrLabel: { color: '#aaa', fontSize: 13, margin: 0 },
  qrImg: { borderRadius: 12, border: '4px solid #fff', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' },
  qrPlaceholder: { width: 220, height: 220, background: '#2d2d44', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' },
  meetCode: { fontSize: 20, fontWeight: 700, letterSpacing: 3, color: '#4fc3f7', background: '#2d2d44', padding: '8px 20px', borderRadius: 8 },
  summary: { display: 'flex', borderBottom: '1px solid #333' },
  summaryItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', background: '#2d2d44' },
  summaryNum: { fontSize: 20, fontWeight: 700 },
  summaryLabel: { fontSize: 10, color: '#888', marginTop: 2 },
  actions: { padding: '10px 12px', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', gap: 8 },
  search: { background: '#2d2d44', border: '1px solid #444', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none', width: '100%' },
  actionBtns: { display: 'flex', gap: 8 },
  exportBtn: { flex: 1, background: '#1a73e8', border: 'none', borderRadius: 8, padding: '8px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  refreshBtn: { background: '#2d2d44', border: '1px solid #444', borderRadius: 8, padding: '8px 12px', color: '#aaa', cursor: 'pointer', fontSize: 14 },
  list: { flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  item: { background: '#2d2d44', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  itemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8 },
  statusDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 },
  email: { fontSize: 11, color: '#888' },
  hostBadge: { fontSize: 10, background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 4, padding: '2px 6px' },
  pctBadge: { fontSize: 13, fontWeight: 700, borderRadius: 6, padding: '3px 8px' },
  progressBg: { height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, transition: 'width 0.5s ease' },
  timeRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  timeItem: { fontSize: 11, color: '#888' },
  loading: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 14 },
};

export default Attendance;
