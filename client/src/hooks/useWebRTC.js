import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
};

const useWebRTC = (socket, roomId, localStream) => {
  const peersRef = useRef({});
  const pendingCandidates = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const localStreamRef = useRef(localStream);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  const addRemoteStream = useCallback((socketId, stream) => {
    setRemoteStreams(prev => ({ ...prev, [socketId]: stream }));
  }, []);

  const removeRemoteStream = useCallback((socketId) => {
    setRemoteStreams(prev => { const u = { ...prev }; delete u[socketId]; return u; });
    if (peersRef.current[socketId]) { peersRef.current[socketId].close(); delete peersRef.current[socketId]; }
    delete pendingCandidates.current[socketId];
  }, []);

  const addTracksToP = useCallback((peer) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const senders = peer.getSenders();
    stream.getTracks().forEach(track => {
      const exists = senders.find(s => s.track?.kind === track.kind);
      if (!exists) peer.addTrack(track, stream);
    });
  }, []);

  const createPeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
      delete peersRef.current[socketId];
    }
    pendingCandidates.current[socketId] = [];

    const peer = new RTCPeerConnection(ICE_SERVERS);
    addTracksToP(peer);

    peer.ontrack = (e) => {
      if (e.streams?.[0]) addRemoteStream(socketId, e.streams[0]);
    };

    peer.onicecandidate = (e) => {
      if (e.candidate) socket.current?.emit('ice-candidate', { to: socketId, candidate: e.candidate });
    };

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed') peer.restartIce();
    };

    peersRef.current[socketId] = peer;
    return peer;
  }, [socket, addRemoteStream, addTracksToP]);

  const flushCandidates = useCallback(async (socketId) => {
    const peer = peersRef.current[socketId];
    if (!peer) return;
    for (const c of (pendingCandidates.current[socketId] || [])) {
      try { await peer.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingCandidates.current[socketId] = [];
  }, []);

  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;

    // New joiner receives list of existing users → initiates offer to each
    s.on('existing-participants', (participants) => {
      participants.forEach(({ socketId }) => {
        const peer = createPeer(socketId);
        peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
          .then(offer => peer.setLocalDescription(offer))
          .then(() => s.emit('offer', { to: socketId, offer: peer.localDescription }))
          .catch(err => console.error('Offer error:', err));
      });
    });

    // Existing user receives notification that someone new joined → waits for offer
    s.on('user-joined', ({ socketId }) => {
      createPeer(socketId); // just create peer, wait for their offer
    });

    s.on('offer', async ({ from, offer }) => {
      try {
        let peer = peersRef.current[from];
        if (!peer) peer = createPeer(from);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        await flushCandidates(from);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        s.emit('answer', { to: from, answer: peer.localDescription });
      } catch (err) { console.error('Answer error:', err); }
    });

    s.on('answer', async ({ from, answer }) => {
      try {
        const peer = peersRef.current[from];
        if (peer && peer.signalingState !== 'stable') {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
          await flushCandidates(from);
        }
      } catch (err) { console.error('Answer set error:', err); }
    });

    s.on('ice-candidate', async ({ from, candidate }) => {
      try {
        const peer = peersRef.current[from];
        if (!peer) return;
        if (peer.remoteDescription?.type) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
          pendingCandidates.current[from].push(candidate);
        }
      } catch {}
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
  }, [socket, createPeer, removeRemoteStream, flushCandidates]);

  // When localStream becomes available, add tracks to existing peers
  useEffect(() => {
    if (!localStream) return;
    Object.values(peersRef.current).forEach(peer => addTracksToP(peer));
  }, [localStream, addTracksToP]);

  const replaceTrack = useCallback((newStream) => {
    Object.values(peersRef.current).forEach(peer => {
      newStream.getTracks().forEach(newTrack => {
        const sender = peer.getSenders().find(s => s.track?.kind === newTrack.kind);
        if (sender) sender.replaceTrack(newTrack);
        else peer.addTrack(newTrack, newStream);
      });
    });
  }, []);

  const closeAll = useCallback(() => {
    Object.values(peersRef.current).forEach(p => p.close());
    peersRef.current = {};
    pendingCandidates.current = {};
    setRemoteStreams({});
  }, []);

  return { remoteStreams, replaceTrack, closeAll };
};

export default useWebRTC;
