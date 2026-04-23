import { useEffect, useRef, useState, useCallback } from 'react';

// Free TURN servers from Open Relay Project (works on mobile + different networks)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

const useWebRTC = (socket, roomId, localStream) => {
  const peersRef = useRef({});
  const pendingCandidates = useRef({}); // queue ICE candidates before remote desc
  const [remoteStreams, setRemoteStreams] = useState({});
  const localStreamRef = useRef(localStream);

  // Keep localStreamRef in sync
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

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
    delete pendingCandidates.current[socketId];
  }, []);

  const createPeer = useCallback((socketId, initiator) => {
    // Close existing peer if any
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    pendingCandidates.current[socketId] = [];

    // Add local tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
    }

    // Receive remote stream
    peer.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        addRemoteStream(socketId, e.streams[0]);
      }
    };

    // Send ICE candidates
    peer.onicecandidate = (e) => {
      if (e.candidate && socket.current) {
        socket.current.emit('ice-candidate', { to: socketId, candidate: e.candidate });
      }
    };

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed') {
        peer.restartIce();
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') {
        removeRemoteStream(socketId);
      }
    };

    if (initiator) {
      peer.onnegotiationneeded = async () => {
        try {
          const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await peer.setLocalDescription(offer);
          socket.current?.emit('offer', { to: socketId, offer: peer.localDescription });
        } catch (err) {
          console.error('Offer error:', err);
        }
      };
    }

    peersRef.current[socketId] = peer;
    return peer;
  }, [socket, addRemoteStream, removeRemoteStream]);

  // Flush queued ICE candidates after remote description is set
  const flushCandidates = useCallback(async (socketId) => {
    const peer = peersRef.current[socketId];
    const candidates = pendingCandidates.current[socketId] || [];
    for (const candidate of candidates) {
      try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
    pendingCandidates.current[socketId] = [];
  }, []);

  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;

    s.on('existing-participants', (participants) => {
      participants.forEach(({ socketId }) => createPeer(socketId, true));
    });

    s.on('user-joined', ({ socketId }) => createPeer(socketId, false));

    s.on('offer', async ({ from, offer }) => {
      try {
        let peer = peersRef.current[from];
        if (!peer) peer = createPeer(from, false);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        await flushCandidates(from);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        s.emit('answer', { to: from, answer: peer.localDescription });
      } catch (err) {
        console.error('Answer error:', err);
      }
    });

    s.on('answer', async ({ from, answer }) => {
      try {
        const peer = peersRef.current[from];
        if (peer && peer.signalingState !== 'stable') {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
          await flushCandidates(from);
        }
      } catch (err) {
        console.error('Set answer error:', err);
      }
    });

    s.on('ice-candidate', async ({ from, candidate }) => {
      try {
        const peer = peersRef.current[from];
        if (!peer) return;
        if (peer.remoteDescription && peer.remoteDescription.type) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Queue until remote description is set
          if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
          pendingCandidates.current[from].push(candidate);
        }
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
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
