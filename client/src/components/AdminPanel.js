import React from 'react';

const AdminPanel = ({ participants, socket, roomId, onClose }) => {
  const emit = (event, payload) => socket.current?.emit(event, { roomId, ...payload });

  const togglePerm = (socketId, permission, current) => {
    emit('update-permission', { targetSocketId: socketId, permission, value: !current });
  };

  const kick = (socketId, name) => {
    if (window.confirm(`Remove ${name} from the meeting?`)) {
      emit('kick-participant', { targetSocketId: socketId });
    }
  };

  const muteAll = () => emit('mute-all', {});

  const nonAdmins = participants.filter(p => p.role !== 'admin');

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span>👑 Admin Panel</span>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.stats}>
        <div style={styles.statBox}>
          <span style={styles.statNum}>{participants.length}</span>
          <span style={styles.statLabel}>Total</span>
        </div>
        <div style={styles.statBox}>
          <span style={styles.statNum}>{nonAdmins.length}</span>
          <span style={styles.statLabel}>Participants</span>
        </div>
        <div style={styles.statBox}>
          <span style={styles.statNum}>{nonAdmins.filter(p => p.handRaised).length}</span>
          <span style={styles.statLabel}>Hands ✋</span>
        </div>
      </div>

      <div style={styles.actions}>
        <button style={styles.dangerBtn} onClick={muteAll}>🔇 Mute All</button>
      </div>

      <div style={styles.permLegend}>
        <span style={styles.legendItem}><span style={styles.greenDot} />Allowed</span>
        <span style={styles.legendItem}><span style={styles.redDot} />Blocked</span>
      </div>

      <div style={styles.list}>
        {nonAdmins.length === 0 && (
          <div style={styles.empty}>
            <div style={{ fontSize: 32 }}>👥</div>
            <p>No participants yet</p>
            <p style={{ fontSize: 12, color: '#555' }}>Share the meeting link to invite people</p>
          </div>
        )}
        {nonAdmins.map(p => (
          <div key={p.socketId} style={styles.item}>
            <div style={styles.itemTop}>
              <div style={styles.itemName}>
                <span style={{ ...styles.dot, background: p.active ? '#22c55e' : '#aaa' }} />
                <span>{p.name}</span>
                {p.handRaised && <span title="Hand raised">✋</span>}
              </div>
              <div style={styles.itemStatus}>
                <span title="Mic">{p.audioOn === false ? '🔇' : '🎤'}</span>
                <span title="Camera">{p.videoOn === false ? '📵' : '📷'}</span>
              </div>
            </div>
            <div style={styles.permRow}>
              {[
                { key: 'mic', icon: '🎤', label: 'Mic' },
                { key: 'camera', icon: '📷', label: 'Cam' },
                { key: 'screenShare', icon: '🖥️', label: 'Screen' },
                { key: 'smartBoard', icon: '🎨', label: 'Board' },
              ].map(({ key, icon, label }) => {
                const allowed = p.permissions?.[key] ?? true;
                return (
                  <button key={key} title={`${allowed ? 'Revoke' : 'Grant'} ${label}`}
                    style={{ ...styles.permBtn, background: allowed ? '#22c55e22' : '#ef444422', color: allowed ? '#22c55e' : '#ef4444', border: `1px solid ${allowed ? '#22c55e44' : '#ef444444'}` }}
                    onClick={() => togglePerm(p.socketId, key, allowed)}>
                    {icon}
                    <span style={styles.permLabel}>{label}</span>
                  </button>
                );
              })}
              <button style={styles.kickBtn} title="Remove participant" onClick={() => kick(p.socketId, p.name)}>
                🚫<span style={styles.permLabel}>Kick</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e2e', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #333', fontWeight: 600, fontSize: 15 },
  closeBtn: { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16 },
  stats: { display: 'flex', gap: 1, borderBottom: '1px solid #333' },
  statBox: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', background: '#2d2d44' },
  statNum: { fontSize: 20, fontWeight: 700, color: '#4fc3f7' },
  statLabel: { fontSize: 11, color: '#888' },
  actions: { padding: '10px 16px', borderBottom: '1px solid #333', display: 'flex', gap: 8 },
  dangerBtn: { background: '#ef444422', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13 },
  permLegend: { display: 'flex', gap: 12, padding: '6px 16px', borderBottom: '1px solid #222' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' },
  greenDot: { width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' },
  redDot: { width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' },
  list: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  item: { background: '#2d2d44', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
  itemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 },
  itemStatus: { display: 'flex', gap: 4, fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  permRow: { display: 'flex', gap: 6 },
  permBtn: { flex: 1, border: 'none', borderRadius: 6, padding: '5px 4px', cursor: 'pointer', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  kickBtn: { background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, padding: '5px 4px', cursor: 'pointer', fontSize: 13, color: '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  permLabel: { fontSize: 9, color: 'inherit' },
  empty: { textAlign: 'center', color: '#666', marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
};

export default AdminPanel;
