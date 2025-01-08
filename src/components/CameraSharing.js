import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase';

const CameraSharing = ({ currentUser, selectedChannel }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [currentStreamer, setCurrentStreamer] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const channelRef = doc(firestore, 'channels', selectedChannel.id);

    const unsubscribe = onSnapshot(channelRef, (doc) => {
      const data = doc.data();
      if (data) {
        setCurrentStreamer(data.currentStreamer);
        setIsSharing(data.currentStreamer === currentUser.id);

        if (data.currentStreamer) {
          if (data.currentStreamer === currentUser.id) {
            navigator.mediaDevices.getUserMedia({ video: true })
              .then(stream => {
                if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                  videoRef.current.style.display = 'block';
                  return videoRef.current.play();
                }
              })
              .catch(error => console.error('Error accessing camera:', error));
          }
        } else {
          if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
          }
        }
      }
    });

    return () => {
      unsubscribe();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [selectedChannel, currentUser.id]);

  const startSharing = async () => {
    if (!isSharing && !currentStreamer) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.style.display = 'block';
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(error => console.error('Error playing video:', error));
        };

        const channelRef = doc(firestore, 'channels', selectedChannel.id);
        await updateDoc(channelRef, {
          currentStreamer: currentUser.id,
        });

        setIsSharing(true);
        console.log('Started sharing:', currentUser.id);
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    }
  };

  const stopSharing = async () => {
    if (isSharing) {
      console.log('Attempting to stop sharing');
      const stream = videoRef.current.srcObject;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          track.stop();
          console.log('Stopped track:', track);
        });
      }

      videoRef.current.style.display = 'none';
      const channelRef = doc(firestore, 'channels', selectedChannel.id);
      await updateDoc(channelRef, {
        currentStreamer: null,
      });

      setIsSharing(false);
      console.log('Stopped sharing');
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
        className={`camera-stream ${
          currentStreamer === currentUser.id ? 'broadcaster' : 'viewer'
        }`}
      />
    </div>
  );
};

export default CameraSharing;
