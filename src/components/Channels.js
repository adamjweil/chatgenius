import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, arrayUnion, getDoc, query, orderBy, onSnapshot, writeBatch, arrayRemove, where } from 'firebase/firestore';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCog, faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import { firestore } from '../firebase.js';
import '../App.css';

const Channels = ({ onChannelSelect, currentUser, selectedChannel: propSelectedChannel, clearDirectMessage, handleUserSelect }) => {
  const [channelName, setChannelName] = useState('');
  const [channels, setChannels] = useState([]);
  const [joinedChannels, setJoinedChannels] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeDirectMessage, setActiveDirectMessage] = useState(null);
  const [activeShares, setActiveShares] = useState({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [channelStats, setChannelStats] = useState({});

  useEffect(() => {
    if (currentUser && currentUser.id) {
      // Create a real-time listener for the user document
      const userRef = doc(firestore, 'users', currentUser.id);
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          setJoinedChannels(userData.joinedChannels || []);
        }
      });

      // Cleanup subscription on unmount
      return () => unsubscribe();
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeChannel) {
      const q = query(
        collection(firestore, `channels/${activeChannel.id}/messages`),
        orderBy('createdAt')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(messagesData);
        markMessagesAsRead(messagesData, `channels/${activeChannel.id}/messages`);
      });

      return () => unsubscribe();
    }
  }, [activeChannel]);

  useEffect(() => {
    if (propSelectedChannel) {
      const q = query(
        collection(firestore, `channels/${propSelectedChannel.id}/messages`),
        orderBy('createdAt')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(messagesData);
      });

      return () => unsubscribe();
    }
  }, [propSelectedChannel]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(firestore, 'channels'), (snapshot) => {
      const channelsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Remove duplicates by creating a Map with unique IDs
      const uniqueChannels = Array.from(
        new Map(channelsData.map(channel => [channel.id, channel])).values()
      );

      setChannels(uniqueChannels);

      const shares = {};
      uniqueChannels.forEach(channel => {
        if (channel.currentStreamer) {
          shares[channel.id] = true;
        }
      });
      setActiveShares(shares);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribers = [];

    const fetchUnreadCounts = async () => {
      // Clear previous unread counts
      setUnreadCounts({});

      joinedChannels.forEach(channel => {
        const q = query(
          collection(firestore, `channels/${channel.id}/messages`),
          orderBy('createdAt')
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const unreadCount = snapshot.docs.filter(doc => {
            const data = doc.data();
            // Check if readBy exists and if not, treat as unread
            return !data.readBy || !data.readBy.includes(currentUser.id);
          }).length;
          
          setUnreadCounts(prev => ({
            ...prev,
            [channel.id]: unreadCount
          }));
        });

        unsubscribers.push(unsubscribe);
      });
    };

    if (currentUser && currentUser.id && joinedChannels.length > 0) {
      fetchUnreadCounts();
    }

    // Cleanup function to remove all listeners
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [currentUser, joinedChannels]);

  useEffect(() => {
    setActiveChannel(propSelectedChannel);
  }, [propSelectedChannel]);

  useEffect(() => {
    const fetchChannelStats = async () => {
      const stats = {};
      
      for (const channel of channels) {
        try {
          // Get messages count
          const messagesQuery = query(
            collection(firestore, `channels/${channel.id}/messages`)
          );
          const messagesSnapshot = await getDocs(messagesQuery);
          
          // Get users who have joined this channel
          const userRef = collection(firestore, 'users');
          const usersSnapshot = await getDocs(userRef);
          const joinedUsers = usersSnapshot.docs.filter(doc => {
            const userData = doc.data();
            return userData.joinedChannels?.some(c => c.id === channel.id);
          });

          stats[channel.id] = {
            messageCount: messagesSnapshot.size,
            userCount: joinedUsers.length
          };
        } catch (error) {
          console.error(`Error fetching stats for channel ${channel.id}:`, error);
        }
      }
      
      setChannelStats(stats);
    };

    if (channels.length > 0) {
      fetchChannelStats();
    }
  }, [channels]);

  useEffect(() => {
    let isChannelCreated = false;

    const createAIChatbotChannel = async () => {
      if (isChannelCreated) return;

      const channelsRef = collection(firestore, 'channels');
      const q = query(channelsRef, where('name', '==', 'ai-chatbot'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        const aiChannelRef = await addDoc(channelsRef, {
          name: 'ai-chatbot',
          description: 'Ask questions about chat history',
          createdAt: new Date(),
          isAIChannel: true,
          isDefault: true
        });

        // Auto-join all users to AI channel
        const userRef = doc(firestore, 'users', currentUser.id);
        await updateDoc(userRef, {
          joinedChannels: arrayUnion({
            id: aiChannelRef.id,
            name: 'ai-chatbot'
          })
        });
      }

      isChannelCreated = true;
    };

    createAIChatbotChannel();
  }, [currentUser.id]);

  const fetchChannels = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, 'channels'));
      const channelsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChannels(channelsData);
      calculateUnreadCounts(channelsData);
    } catch (error) {
      console.error("Error fetching channels:", error);
    }
  };

  const calculateUnreadCounts = async (channelsData) => {
    const counts = {};
    for (const channel of channelsData) {
      const q = query(
        collection(firestore, `channels/${channel.id}/messages`),
        orderBy('createdAt')
      );
      const snapshot = await getDocs(q);
      const unreadCount = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.readBy && !data.readBy.includes(currentUser.id);
      }).length;
      counts[channel.id] = unreadCount;
    }
  };

  const markMessagesAsRead = async (messages, path) => {
    const batch = writeBatch(firestore);
    messages.forEach(message => {
      if (!message.readBy.includes(currentUser.id)) {
        const messageRef = doc(firestore, path, message.id);
        batch.update(messageRef, {
          readBy: arrayUnion(currentUser.id)
        });
      }
    });
    await batch.commit();
  };

  const createChannel = async (e) => {
    e.preventDefault();
    try {
      const newChannelRef = await addDoc(collection(firestore, 'channels'), {
        name: channelName,
        createdAt: new Date()
      });

      // Just join the channel without selecting it
      const newChannel = { id: newChannelRef.id, name: channelName };
      
      // Update user's joined channels in Firestore
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, {
        joinedChannels: arrayUnion({ id: newChannelRef.id, name: channelName })
      });

      // Update local state
      setJoinedChannels(prev => [...prev, newChannel]);
      
      // Clear the input and close modal
      setChannelName('');
      setModalIsOpen(false);
      
      // Note: Removed the onChannelSelect call so the channel won't automatically open
    } catch (error) {
      console.error("Error creating channel:", error);
    }
  };

  const joinChannel = async (channel) => {
    if (!channel || !channel.id) {
      console.error("Invalid channel object:", channel);
      return;
    }

    if (!currentUser || !currentUser.id) {
      console.error("Current user is not defined");
      return;
    }

    if (!joinedChannels.some(c => c.id === channel.id)) {
      const updatedChannels = [...joinedChannels, channel];
      setJoinedChannels(updatedChannels);

      try {
        const userRef = doc(firestore, 'users', currentUser.id);
        await updateDoc(userRef, {
          joinedChannels: arrayUnion({ id: channel.id, name: channel.name })
        });
        
        // Removed the onChannelSelect(channel) call
      } catch (error) {
        console.error("Error updating Firestore:", error);
      }
    }
  };

  const handleChannelSelect = async (channel) => {
    console.log('Channel selected:', channel);
    setActiveChannel(channel);
    
    if (typeof clearDirectMessage === 'function') {
      clearDirectMessage();
    }

    try {
      const q = query(
        collection(firestore, `channels/${channel.id}/messages`),
        orderBy('createdAt')
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(firestore);
      let needsUpdate = false;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!data.readBy) {
          needsUpdate = true;
          batch.update(doc.ref, {
            readBy: [currentUser.id]
          });
        } else if (!data.readBy.includes(currentUser.id)) {
          needsUpdate = true;
          batch.update(doc.ref, {
            readBy: arrayUnion(currentUser.id)
          });
        }
      });
      
      if (needsUpdate) {
        await batch.commit();
      }
      
      setUnreadCounts(prev => ({
        ...prev,
        [channel.id]: 0
      }));

      if (typeof onChannelSelect === 'function') {
        console.log('Calling onChannelSelect with:', channel);
        onChannelSelect(channel);
      } else {
        console.log('onChannelSelect is not a function');
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const leaveChannel = async (channel) => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      const updatedJoinedChannels = userData.joinedChannels.filter(
        ch => ch.id !== channel.id
      );
      
      await updateDoc(userRef, {
        joinedChannels: updatedJoinedChannels
      });

      setJoinedChannels(prevChannels => 
        prevChannels.filter(ch => ch.id !== channel.id)
      );

      if (propSelectedChannel && propSelectedChannel.id === channel.id) {
        setActiveChannel(null);
        if (typeof onChannelSelect === 'function') {
          onChannelSelect(null);
        }
      }

      setModalIsOpen(false);
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  };

  const handleChannelClick = (channel) => {
    console.log('Channel clicked:', channel);
    console.log('onChannelSelect type:', typeof onChannelSelect);
    
    if (typeof onChannelSelect !== 'function') {
      console.error('onChannelSelect is not a function in Channels component');
      return;
    }

    setActiveChannel(channel);
    if (typeof handleUserSelect === 'function') {
      handleUserSelect(null);
    }
    onChannelSelect(channel);
  };

  return (
    <div>
      <div className="channels-header">
        <h2>
          <FontAwesomeIcon
            icon={isCollapsed ? faCaretRight : faCaretDown}
            onClick={toggleCollapse}
            className="toggle-icon"
          />
          Channels
        </h2>
        <FontAwesomeIcon
          icon={faPlus}
          onClick={() => setModalIsOpen(true)}
          className="plus-icon"
          style={{ fontSize: '1.2rem' }}
        />
      </div>
      {!isCollapsed && (
        <ul>
          {joinedChannels.map(channel => (
            <li
              key={channel.id}
              onClick={() => handleChannelClick(channel)}
              className={`
                channel-item
                ${propSelectedChannel && propSelectedChannel.id === channel.id ? 'selected' : ''}
                ${unreadCounts[channel.id] > 0 ? 'unread' : ''}
              `}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                #{channel.name}
                {activeShares[channel.id] && <span className="active-share-indicator" />}
              </div>
              {unreadCounts[channel.id] > 0 && (
                <span className="unread-indicator">{unreadCounts[channel.id]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className={modalIsOpen ? "modal-overlay" : ""} onClick={() => setModalIsOpen(false)} />
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Manage Channels"
        className="channels-modal"
        overlayClassName="modal-overlay"
      >
        <div className="channels-modal-content">
          <h2>Available Channels</h2>
          
          <form onSubmit={createChannel} className="new-channel-form">
            <input
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Create a new channel"
              className="channel-input"
              required
            />
            <button type="submit" className="save">Create Channel</button>
          </form>

          <div className="channels-list">
            {channels.map(channel => (
              <div key={channel.id} className={`channel-item ${channel.currentStreamer ? 'streaming' : ''}`}>
                <div className="channel-info">
                  <span className="channel-name">#{channel.name}</span>
                  <div className="channel-stats">
                    {channelStats[channel.id] && (
                      <>
                        <span>{channelStats[channel.id].userCount} members</span>
                        <span>•</span>
                        <span>{channelStats[channel.id].messageCount} messages</span>
                      </>
                    )}
                  </div>
                </div>
                {joinedChannels.some(c => c.id === channel.id) ? (
                  <button 
                    onClick={() => leaveChannel(channel)}
                    className="leave-button"
                  >
                    Leave
                  </button>
                ) : (
                  <button 
                    onClick={() => joinChannel(channel)}
                    className="join-button"
                  >
                    Join
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="modal-buttons">
            <button onClick={() => setModalIsOpen(false)} className="cancel">
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Channels; 