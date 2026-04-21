import React, { useEffect, useRef, useState, useCallback } from 'react';

const COLORS = ['#000000', '#ffffff', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
const TOOLS = ['pen', 'eraser', 'rect', 'circle', 'line', 'text'];

const SmartBoard = ({ socket, roomId, canDraw, isAdmin, onClose }) => {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(3);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const snapshotRef = useRef(null);

  const getCtx = () => canvasRef.current?.getContext('2d');

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const drawShape = useCallback((ctx, data) => {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (data.tool === 'pen' || data.tool === 'eraser') {
      if (data.tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = data.size * 4; }
      else ctx.globalCompositeOperation = 'source-over';
      ctx.moveTo(data.x0, data.y0);
      ctx.lineTo(data.x1, data.y1);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else if (data.tool === 'rect') {
      ctx.strokeRect(data.x0, data.y0, data.x1 - data.x0, data.y1 - data.y0);
    } else if (data.tool === 'circle') {
      const r = Math.sqrt(Math.pow(data.x1 - data.x0, 2) + Math.pow(data.y1 - data.y0, 2));
      ctx.arc(data.x0, data.y0, r, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (data.tool === 'line') {
      ctx.moveTo(data.x0, data.y0);
      ctx.lineTo(data.x1, data.y1);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = getCtx();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;
    s.on('board-draw', (data) => drawShape(getCtx(), data));
    s.on('board-clear', () => {
      const ctx = getCtx();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });
    s.on('board-state', (dataUrl) => {
      const img = new Image();
      img.onload = () => getCtx().drawImage(img, 0, 0);
      img.src = dataUrl;
    });
    return () => { s.off('board-draw'); s.off('board-clear'); s.off('board-state'); };
  }, [socket, drawShape]);

  const onMouseDown = (e) => {
    if (!canDraw) return;
    setDrawing(true);
    const pos = getPos(e);
    setStartPos(pos);
    if (['rect', 'circle', 'line'].includes(tool)) {
      snapshotRef.current = getCtx().getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (tool === 'pen' || tool === 'eraser') {
      const ctx = getCtx();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
    if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        const ctx = getCtx();
        ctx.font = `${size * 6}px Arial`;
        ctx.fillStyle = color;
        ctx.fillText(text, pos.x, pos.y);
        socket.current?.emit('board-state', { roomId, state: canvasRef.current.toDataURL() });
      }
    }
  };

  const onMouseMove = (e) => {
    if (!drawing || !canDraw) return;
    const pos = getPos(e);
    const ctx = getCtx();
    const data = { tool, color, size, x0: startPos.x, y0: startPos.y, x1: pos.x, y1: pos.y };
    if (tool === 'pen' || tool === 'eraser') {
      drawShape(ctx, data);
      socket.current?.emit('board-draw', { roomId, data });
      setStartPos(pos);
    } else {
      ctx.putImageData(snapshotRef.current, 0, 0);
      drawShape(ctx, data);
    }
  };

  const onMouseUp = (e) => {
    if (!drawing || !canDraw) return;
    setDrawing(false);
    const pos = getPos(e);
    if (['rect', 'circle', 'line'].includes(tool)) {
      const data = { tool, color, size, x0: startPos.x, y0: startPos.y, x1: pos.x, y1: pos.y };
      socket.current?.emit('board-draw', { roomId, data });
    }
  };

  const clearBoard = () => {
    const ctx = getCtx();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.current?.emit('board-clear', { roomId });
  };

  const uploadImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        getCtx().drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        socket.current?.emit('board-state', { roomId, state: canvasRef.current.toDataURL() });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const saveBoard = () => {
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL();
    a.download = 'smartboard.png';
    a.click();
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.toolGroup}>
          {TOOLS.map(t => (
            <button key={t} onClick={() => setTool(t)}
              style={{ ...styles.toolBtn, ...(tool === t ? styles.activeTool : {}) }}
              title={t} disabled={!canDraw}>
              {t === 'pen' ? '✏️' : t === 'eraser' ? '🧹' : t === 'rect' ? '⬜' : t === 'circle' ? '⭕' : t === 'line' ? '📏' : 'T'}
            </button>
          ))}
        </div>
        <div style={styles.toolGroup}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} disabled={!canDraw}
              style={{ ...styles.colorBtn, background: c, border: color === c ? '3px solid #1a73e8' : '2px solid #ccc' }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} disabled={!canDraw}
            style={styles.colorInput} title="Custom color" />
        </div>
        <div style={styles.toolGroup}>
          <label style={styles.label}>Size:</label>
          <input type="range" min={1} max={20} value={size} onChange={e => setSize(+e.target.value)}
            disabled={!canDraw} style={{ width: 80 }} />
          <span style={styles.label}>{size}</span>
        </div>
        <div style={styles.toolGroup}>
          {isAdmin && <button style={styles.actionBtn} onClick={clearBoard}>🗑️ Clear</button>}
          <label style={{ ...styles.actionBtn, cursor: canDraw ? 'pointer' : 'not-allowed' }}>
            🖼️ Image <input type="file" accept="image/*" hidden onChange={uploadImage} disabled={!canDraw} />
          </label>
          <button style={styles.actionBtn} onClick={saveBoard}>💾 Save</button>
          <button style={{ ...styles.actionBtn, marginLeft: 'auto' }} onClick={onClose}>✕ Close</button>
        </div>
      </div>
      {!canDraw && (
        <div style={styles.noAccess}>🔒 View only — Admin has not granted you board access</div>
      )}
      <canvas ref={canvasRef} style={{ ...styles.canvas, cursor: canDraw ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'not-allowed' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onTouchStart={onMouseDown} onTouchMove={onMouseMove} onTouchEnd={onMouseUp} />
    </div>
  );
};

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: '#f0f0f0' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 12px', background: '#1e1e2e', alignItems: 'center' },
  toolGroup: { display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', borderRight: '1px solid #333' },
  toolBtn: { background: '#2d2d44', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16, color: '#fff' },
  activeTool: { background: '#1a73e8' },
  colorBtn: { width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', padding: 0 },
  colorInput: { width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 },
  label: { color: '#aaa', fontSize: 12 },
  actionBtn: { background: '#2d2d44', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#fff' },
  noAccess: { background: '#ff6b6b22', color: '#ff6b6b', padding: '6px 16px', fontSize: 13, textAlign: 'center' },
  canvas: { flex: 1, width: '100%', display: 'block' },
};

export default SmartBoard;
