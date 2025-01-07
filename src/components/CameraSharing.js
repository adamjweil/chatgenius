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
        console.log('Current streamer:', data.currentStreamer);

        if (data.currentStreamer && data.currentStreamer !== currentUser.id) {
          navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
              videoRef.current.srcObject = stream;
              videoRef.current.onloadedmetadata = () => {
                videoRef.current.play().catch(error => console.error('Error playing video:', error));
              };
            })
            .catch(error => console.error('Error accessing camera:', error));
        } else if (!data.currentStreamer) {
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      } else {
        console.error('Channel does not exist');
        setCurrentStreamer(null);
      }
    });

    return () => unsubscribe();
  }, [selectedChannel, currentUser.id]);

  const startSharing = async () => {
    if (!isSharing) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
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

      const channelRef = doc(firestore, 'channels', selectedChannel.id);
      await updateDoc(channelRef, {
        currentStreamer: null,
      });

      setIsSharing(false);
      console.log('Stopped sharing');
    }
  };

  const stopAllStreams = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => {
        track.stop();
        console.log('Stopped track:', track);
      });
    }
  };

  stopAllStreams(); // Uncomment this line to run the function once

  return (
    <div className="camera-sharing">
      {currentStreamer === currentUser.id && (
        <div className="sharing-indicator">
          You are sharing your camera
        </div>
      )}
      {currentStreamer === currentUser.id ? (
        <button onClick={stopSharing}>Stop Sharing</button>
      ) : (
        <button onClick={startSharing} disabled={!!currentStreamer}>
          Start Sharing
        </button>
      )}
      <video ref={videoRef} autoPlay muted />
    </div>
  );
};

export default CameraSharing;
