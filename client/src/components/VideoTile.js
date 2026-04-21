import React, { useEffect, useRef, useState } from 'react';

const VideoTile = ({ stream, name, muted = false, isLocal = false, audioOn = true, videoOn = true }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={styles.tile}>
      <video ref={videoRef} autoPlay playsInline muted={muted || isLocal}
        style={{ ...styles.video, display: videoOn ? 'block' : 'none' }} />
      {!videoOn && (
        <div style={styles.avatar}>
          <span style={styles.avatarText}>{name?.charAt(0)?.toUpperCase() || '?'}</span>
        </div>
      )}
      <div style={styles.nameBar}>
        <span>{isLocal ? `${name} (You)` : name}</span>
        <span style={{ marginLeft: 8 }}>
          {!audioOn && '🔇'}
          {!videoOn && '📷'}
        </span>
      </div>
    </div>
  );
};

const styles = {
  tile: { position: 'relative', background: '#1e1e2e', borderRadius: 12, overflow: 'hidden', aspectRatio: '16/9', minWidth: 200 },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  avatar: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2d2d44' },
  avatarText: { fontSize: 48, fontWeight: 700, color: '#4fc3f7' },
  nameBar: { position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center' },
};

export default VideoTile;
