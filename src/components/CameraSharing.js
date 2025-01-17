import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import Draggable from 'react-draggable';

const CameraSharing = ({ currentUser, selectedChannel, setCurrentStreamer, currentStreamer }) => {
  const [isSharing, setIsSharing] = useState(false);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const streamRef = useRef(null);
  const dragNodeRef = useRef(null);
  const [iceCandidatesQueue, setIceCandidatesQueue] = useState([]);
  
  // Calculate initial position based on the channel content area
  const getInitialPosition = () => {
    const channelContent = document.querySelector('.channel-content');
    if (channelContent) {
      const rect = channelContent.getBoundingClientRect();
      return {
        x: rect.left + (rect.width / 2) - 80,  // 80 is half the video width
        y: rect.top + (rect.height / 2) - 60   // 60 is half the video height
      };
    }
    // Fallback to center of window if channel content not found
    return {
      x: window.innerWidth / 2 - 80,
      y: window.innerHeight / 2 - 60
    };
  };

  // Track whether initial position has been set
  const [position, setPosition] = useState(null);

  // Set initial position when stream starts or viewer sees stream
  useEffect(() => {
    if ((isSharing || currentStreamer) && !position) {
      setPosition(getInitialPosition());
    }
  }, [isSharing, currentStreamer]);

  useEffect(() => {
    if (isSharing && videoRef.current && streamRef.current) {
      console.log('Setting up video stream...');
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play()
        .then(() => console.log('Video playback started'))
        .catch(e => console.error('Error playing video:', e));
    }
  }, [isSharing, streamRef.current]);

  // Add debugging logs for viewer state
  useEffect(() => {
    console.log('Current streamer:', currentStreamer);
    console.log('Current user:', currentUser.id);
    console.log('Is viewing:', currentStreamer && currentStreamer !== currentUser.id);
  }, [currentStreamer, currentUser]);

  useEffect(() => {
    let unsubscribe;
    
    const initializeViewer = async () => {
      console.log('Initializing viewer connection...');
      if (currentStreamer && currentStreamer !== currentUser.id) {
        console.log('Setting up peer connection for viewer');
        unsubscribe = await setupPeerConnection();
      }
    };

    initializeViewer();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      cleanup();
    };
  }, [currentStreamer]);

  const setupPeerConnection = async () => {
    try {
      console.log('Creating new RTCPeerConnection for viewer');
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      peerConnectionRef.current = pc;

      // Set up track handler before creating offer
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.streams[0]);
        if (videoRef.current && event.streams[0]) {
          console.log('Setting video source for viewer');
          videoRef.current.srcObject = event.streams[0];
        }
      };

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);
      console.log('Created and set local offer');

      const channelRef = doc(firestore, 'channels', selectedChannel.id);
      await updateDoc(channelRef, {
        [`rtcConnections.${currentUser.id}`]: {
          offer: {
            type: offer.type,
            sdp: offer.sdp
          },
          iceCandidates: []
        }
      });

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('New ICE candidate for viewer:', event.candidate);
          await updateDoc(channelRef, {
            [`rtcConnections.${currentUser.id}.iceCandidates`]: arrayUnion(event.candidate.toJSON())
          });
        }
      };

      // Listen for answer and remote ICE candidates
      return onSnapshot(channelRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data?.rtcConnections?.[currentUser.id]) return;

        const connectionData = data.rtcConnections[currentUser.id];

        // Handle answer if we haven't already
        if (connectionData.answer && !pc.currentRemoteDescription) {
          console.log('Setting remote description for viewer');
          await pc.setRemoteDescription(new RTCSessionDescription(connectionData.answer));
        }
      });
    } catch (error) {
      console.error('Error in setupPeerConnection:', error);
    }
  };

  // Update cleanup function
  const cleanup = () => {
    console.log('Cleaning up streams and connections');
    try {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        if (tracks && tracks.length > 0) {
          tracks.forEach(track => {
            try {
              track.stop();
            } catch (e) {
              console.error('Error stopping track:', e);
            }
          });
        }
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch (e) {
          console.error('Error closing peer connection:', e);
        }
        peerConnectionRef.current = null;
      }

      setIceCandidatesQueue([]);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Add listener for currentStreamer changes
  useEffect(() => {
    if (!selectedChannel) return;

    console.log('Setting up channel listener');
    const channelRef = doc(firestore, 'channels', selectedChannel.id);
    const unsubscribe = onSnapshot(channelRef, (snapshot) => {
      const data = snapshot.data();
      if (data && data.currentStreamer) {
        console.log('Current streamer updated:', data.currentStreamer);
        setCurrentStreamer(data.currentStreamer);
      } else {
        console.log('No current streamer');
        setCurrentStreamer(null);
      }
    });

    return () => {
      console.log('Cleaning up channel listener');
      unsubscribe();
    };
  }, [selectedChannel]);

  // Update startSharing function to handle viewer connections
  const startSharing = async () => {
    if (!isSharing && !currentStreamer) {
      try {
        console.log('Starting camera share...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 160 },
            height: { ideal: 120 }
          },
          audio: false 
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const channelRef = doc(firestore, 'channels', selectedChannel.id);
        await updateDoc(channelRef, { 
          currentStreamer: currentUser.id,
          rtcConnections: {}
        });

        // Listen for viewer offers
        const unsubscribe = onSnapshot(channelRef, async (snapshot) => {
          const data = snapshot.data();
          if (!data?.rtcConnections) return;

          for (const [viewerId, connectionData] of Object.entries(data.rtcConnections)) {
            if (connectionData.offer && !connectionData.answer) {
              console.log('Processing viewer offer:', viewerId);
              const pc = new RTCPeerConnection({
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' }
                ]
              });

              // Add local stream tracks to peer connection
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                  console.log('Adding track to peer connection:', track.kind);
                  pc.addTrack(track, streamRef.current);
                });
              }

              // Handle ICE candidates from viewer
              if (connectionData.iceCandidates) {
                for (const candidate of connectionData.iceCandidates) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
              }

              // Set remote description (viewer's offer)
              await pc.setRemoteDescription(new RTCSessionDescription(connectionData.offer));

              // Create and send answer
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              await updateDoc(channelRef, {
                [`rtcConnections.${viewerId}.answer`]: {
                  type: answer.type,
                  sdp: answer.sdp
                }
              });

              // Handle streamer's ICE candidates
              pc.onicecandidate = async (event) => {
                if (event.candidate) {
                  console.log('New ICE candidate for streamer:', event.candidate);
                  await updateDoc(channelRef, {
                    [`rtcConnections.${viewerId}.streamerCandidates`]: arrayUnion(event.candidate.toJSON())
                  });
                }
              };
            }
          }
        });

        setIsSharing(true);
      } catch (error) {
        console.error('Error starting share:', error);
        cleanup();
        const channelRef = doc(firestore, 'channels', selectedChannel.id);
        await updateDoc(channelRef, { 
          currentStreamer: null,
          rtcConnections: {}
        });
        setIsSharing(false);
      }
    }
  };

  const stopSharing = async () => {
    if (isSharing) {
      cleanup();
      const channelRef = doc(firestore, 'channels', selectedChannel.id);
      await updateDoc(channelRef, { 
        currentStreamer: null,
        rtcConnections: {}
      });
      setIsSharing(false);
    }
  };

  return (
    <>
      <div className="camera-controls">
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
              : `User ${currentStreamer} is sharing their camera`}
          </div>
        )}
      </div>
      
      {(isSharing || (currentStreamer && currentStreamer !== currentUser.id)) && (
        <div className="video-container-wrapper">
          <Draggable
            nodeRef={dragNodeRef}
            defaultPosition={position || getInitialPosition()}
            bounds="body"
            handle=".drag-handle"
            position={null}
            onStop={(e, data) => {
              setPosition({ x: data.x, y: data.y });
            }}
          >
            <div ref={dragNodeRef} className="draggable-video-container">
              <div className="drag-handle">
                <span className="drag-indicator">⋮⋮</span>
              </div>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted={currentStreamer === currentUser.id}
                className={`camera-stream ${isSharing ? 'active' : ''}`}
                style={{ 
                  display: 'block',
                  width: '160px',
                  height: '120px',
                  backgroundColor: '#000',
                  transform: 'scaleX(-1)',
                  borderRadius: '8px',
                  objectFit: 'cover'
                }}
              />
            </div>
          </Draggable>
        </div>
      )}
    </>
  );
};

export default CameraSharing;
