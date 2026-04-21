import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

const Chat = ({ socket, roomId, user, messages, onClose }) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    socket.current?.emit('chat-message', {
      roomId,
      message: { senderName: user.name, content: text, type: 'text' },
    });
    setText('');
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await axios.post(`${API}/api/files/upload`, fd);
      socket.current?.emit('chat-message', {
        roomId,
        message: {
          senderName: user.name,
          content: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          fileUrl: `${API}${data.url}`,
          fileName: file.name,
        },
      });
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span>💬 Chat</span>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...styles.msg, ...(m.senderName === user.name ? styles.myMsg : {}) }}>
            <div style={styles.msgName}>{m.senderName}</div>
            {m.type === 'image' ? (
              <a href={m.fileUrl} target="_blank" rel="noreferrer">
                <img src={m.fileUrl} alt={m.fileName} style={styles.imgPreview} />
              </a>
            ) : m.type === 'file' ? (
              <a href={m.fileUrl} download={m.fileName} style={styles.fileLink}>📎 {m.fileName}</a>
            ) : (
              <div style={styles.msgText}>{m.content}</div>
            )}
            <div style={styles.msgTime}>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {showEmoji && (
        <div style={styles.emojiPicker}>
          <EmojiPicker onEmojiClick={(e) => { setText(t => t + e.emoji); setShowEmoji(false); }} height={350} />
        </div>
      )}
      <div style={styles.inputRow}>
        <button style={styles.iconBtn} onClick={() => setShowEmoji(s => !s)}>😊</button>
        <label style={styles.iconBtn}>
          📎 <input type="file" hidden onChange={handleFile} />
        </label>
        <input style={styles.input} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." />
        <button style={styles.sendBtn} onClick={send}>➤</button>
      </div>
    </div>
  );
};

const styles = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e2e', color: '#fff' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #333', fontWeight: 600, fontSize: 15 },
  closeBtn: { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16 },
  messages: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  msg: { background: '#2d2d44', borderRadius: 10, padding: '8px 12px', maxWidth: '80%', alignSelf: 'flex-start' },
  myMsg: { background: '#1a73e8', alignSelf: 'flex-end' },
  msgName: { fontSize: 11, color: '#aaa', marginBottom: 4 },
  msgText: { fontSize: 14 },
  msgTime: { fontSize: 10, color: '#aaa', marginTop: 4, textAlign: 'right' },
  imgPreview: { maxWidth: 180, borderRadius: 8, display: 'block' },
  fileLink: { color: '#4fc3f7', fontSize: 13, textDecoration: 'none' },
  emojiPicker: { position: 'absolute', bottom: 70, right: 0, zIndex: 100 },
  inputRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderTop: '1px solid #333' },
  iconBtn: { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 18, padding: '4px 6px' },
  input: { flex: 1, background: '#2d2d44', border: 'none', borderRadius: 20, padding: '9px 14px', color: '#fff', fontSize: 14, outline: 'none' },
  sendBtn: { background: '#1a73e8', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 16 },
};

export default Chat;
