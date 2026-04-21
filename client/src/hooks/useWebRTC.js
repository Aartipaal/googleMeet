import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const useWebRTC = (socket, roomId, localStream) => {
  const peersRef = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});

  const addRemoteStream = useCallback((socketId, stream) => {
    setRemoteStreams(prev => ({ ...prev, [socketId]: stream }));
  }, []);

  const removeRemoteStream = useCallback((socketId) => {
    setRemoteStreams(prev => {
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
      delete peersRef.current[socketId];
    }
  }, []);

  const createPeer = useCallback((socketId, initiator) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    if (localStream) {
      localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    }

    peer.ontrack = (e) => addRemoteStream(socketId, e.streams[0]);

    peer.onicecandidate = (e) => {
      if (e.candidate && socket.current) {
        socket.current.emit('ice-candidate', { to: socketId, candidate: e.candidate });
      }
    };

    if (initiator) {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.current?.emit('offer', { to: socketId, offer });
      });
    }

    peersRef.current[socketId] = peer;
    return peer;
  }, [localStream, socket, addRemoteStream]);

  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;

    s.on('existing-participants', (participants) => {
      participants.forEach(({ socketId }) => createPeer(socketId, true));
    });

    s.on('user-joined', ({ socketId }) => createPeer(socketId, false));

    s.on('offer', async ({ from, offer }) => {
      const peer = peersRef.current[from] || createPeer(from, false);
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      s.emit('answer', { to: from, answer });
    });

    s.on('answer', ({ from, answer }) => {
      peersRef.current[from]?.setRemoteDescription(answer);
    });

    s.on('ice-candidate', ({ from, candidate }) => {
      peersRef.current[from]?.addIceCandidate(candidate);
    });

    s.on('user-left', ({ socketId }) => removeRemoteStream(socketId));

    return () => {
      s.off('existing-participants');
      s.off('user-joined');
      s.off('offer');
      s.off('answer');
      s.off('ice-candidate');
      s.off('user-left');
    };
  }, [socket, createPeer, removeRemoteStream]);

  const replaceTrack = useCallback((newStream) => {
    Object.values(peersRef.current).forEach(peer => {
      newStream.getTracks().forEach(newTrack => {
        const sender = peer.getSenders().find(s => s.track?.kind === newTrack.kind);
        if (sender) sender.replaceTrack(newTrack);
      });
    });
  }, []);

  const closeAll = useCallback(() => {
    Object.values(peersRef.current).forEach(p => p.close());
    peersRef.current = {};
    setRemoteStreams({});
  }, []);

  return { remoteStreams, replaceTrack, closeAll };
};

export default useWebRTC;
