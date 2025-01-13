import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase.js';

const CameraSharing = ({ currentUser, selectedChannel }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [currentStreamer, setCurrentStreamer] = useState(null);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [iceCandidatesQueue, setIceCandidatesQueue] = useState([]);

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => cleanup();
  }, [selectedChannel]);

  const createPeerConnection = () => {
    cleanup();

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const channelRef = doc(firestore, 'channels', selectedChannel.id);
        updateDoc(channelRef, { iceCandidate: event.candidate.toJSON() })
          .catch(error => console.error('Error sending ICE candidate:', error));
      }
    };

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startSharing = async () => {
    if (!isSharing && !currentStreamer) {
      try {
        const channelRef = doc(firestore, 'channels', selectedChannel.id);
        await updateDoc(channelRef, { currentStreamer: currentUser.id });

        const pc = createPeerConnection();
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateDoc(channelRef, { offer });

        setIsSharing(true);
      } catch (error) {
        console.error('Error starting share:', error);
        cleanup();
        const channelRef = doc(firestore, 'channels', selectedChannel.id);
        await updateDoc(channelRef, { currentStreamer: null });
        setIsSharing(false);
      }
    }
  };

  const stopSharing = async () => {
    try {
      cleanup();
      const channelRef = doc(firestore, 'channels', selectedChannel.id);
      await updateDoc(channelRef, { 
        currentStreamer: null,
        offer: null,
        answer: null,
        iceCandidate: null
      });
      setIsSharing(false);
    } catch (error) {
      console.error('Error stopping share:', error);
    }
  };

  useEffect(() => {
    if (selectedChannel) {
      const channelRef = doc(firestore, 'channels', selectedChannel.id);
      const unsubscribe = onSnapshot(channelRef, (doc) => {
        const data = doc.data();
        if (data) {
          setCurrentStreamer(data.currentStreamer);
          
          if (data.offer && !isSharing && data.currentStreamer !== currentUser.id) {
            handleSignalingData({ offer: data.offer });
          }
          if (data.answer && isSharing) {
            handleSignalingData({ answer: data.answer });
          }
          if (data.iceCandidate) {
            handleSignalingData({ iceCandidate: data.iceCandidate });
          }
        }
      });

      return () => {
        unsubscribe();
        cleanup();
      };
    }
  }, [selectedChannel, isSharing, currentUser.id]);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.style.display = 'block';
        console.log('Local stream started:', stream);

        // Check each track
        stream.getTracks().forEach(track => {
          console.log(`Track kind: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
        });

        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopLocalStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleSignalingData = async (data) => {
    if (data.offer && !peerConnectionRef.current) {
      await handleOffer(data.offer);
    }
    if (data.answer && peerConnectionRef.current) {
      await handleAnswer(data.answer);
    }
    if (data.iceCandidate && peerConnectionRef.current) {
      await handleNewICECandidate(data.iceCandidate);
    }
  };

  const handleOffer = async (offer) => {
    const pc = peerConnectionRef.current || createPeerConnection();
    peerConnectionRef.current = pc;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const channelRef = doc(firestore, 'channels', selectedChannel.id);
      await updateDoc(channelRef, { answer });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer) => {
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      iceCandidatesQueue.forEach(async (candidate) => {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding queued ice candidate', error);
        }
      });
      setIceCandidatesQueue([]);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleNewICECandidate = async (candidate) => {
    try {
      if (peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('ICE candidate added:', candidate);
      } else {
        setIceCandidatesQueue((prevQueue) => [...prevQueue, candidate]);
        console.log('ICE candidate queued:', candidate);
      }
    } catch (error) {
      console.error('Error adding received ice candidate', error);
    }
  };

  return (
    <div className="camera-sharing">
      {(!currentStreamer || currentStreamer === currentUser.id) && (
        <button 
          onClick={isSharing ? stopSharing : startSharing}
          className={`camera-control-button ${isSharing ? 'stop-sharing' : 'start-sharing'}`}
        >
          {isSharing ? 'Stop Sharing' : 'Start Sharing'}
        </button>
      )}
      {currentStreamer && (
        <div className="sharing-indicator">
          {currentStreamer === currentUser.id 
            ? 'You are sharing your camera'
            : 'Someone is sharing their camera'}
        </div>
      )}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline
        muted={currentStreamer === currentUser.id}
        className={`camera-stream ${isSharing ? 'active' : ''}`}
        style={{ display: isSharing ? 'block' : 'none' }}
      />
    </div>
  );
};

export default CameraSharing;
