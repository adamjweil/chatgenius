import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, arrayUnion, getDoc, query, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { firestore } from '../firebase';
import './Channels.css';

Modal.setAppElement('#root');

const Channels = ({ onChannelSelect, currentUser, selectedChannel: propSelectedChannel, onDirectMessageSelect }) => {
  const [channelName, setChannelName] = useState('');
  const [channels, setChannels] = useState([]);
  const [joinedChannels, setJoinedChannels] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeDirectMessage, setActiveDirectMessage] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);

  useEffect(() => {
    if (currentUser && currentUser.id) {
      fetchChannels();
      fetchJoinedChannels();
      fetchDirectMessages();
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

  const fetchJoinedChannels = async () => {
    try {
      if (!currentUser || !currentUser.id) {
        console.error("Current user is not defined");
        return;
      }

      const userDocRef = doc(firestore, 'users', currentUser.id);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setJoinedChannels(userData.joinedChannels || []);
      } else {
        console.error("User document does not exist");
      }
    } catch (error) {
      console.error("Error fetching joined channels:", error);
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
      setChannelName('');
      fetchChannels();
      joinChannel({ id: newChannelRef.id, name: channelName });
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

        onChannelSelect(channel);
      } catch (error) {
        console.error("Error updating Firestore:", error);
      }
    }
  };

  const handleChannelSelect = (channel) => {
    setActiveChannel(channel);
    setActiveDirectMessage(null);
    if (typeof onChannelSelect === 'function') {
      onChannelSelect(channel);
    }
  };

  const handleDirectMessageSelect = (directMessage) => {
    console.log('Direct Message Selected:', directMessage);
    setActiveDirectMessage(directMessage);
    setActiveChannel(null); // Clear channel selection
    console.log('Active Channel after DM select:', activeChannel);

    if (typeof onDirectMessageSelect === 'function') {
      onDirectMessageSelect(directMessage);
    }
  };

  const fetchDirectMessages = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, 'directMessages'));
      const directMessagesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDirectMessages(directMessagesData);
    } catch (error) {
      console.error("Error fetching direct messages:", error);
    }
  };

//   const sendMessage = async (e) => {
//     e.preventDefault();
//     const messageData = {
//       text: newMessage,
//       createdAt: new Date(),
//       senderId: currentUser.id,
//       senderName: currentUser.name,
//       readBy: [],
//     };

//     if (selectedChannel) {
//       await addDoc(collection(firestore, `channels/${selectedChannel.id}/messages`), messageData);
//     } else if (selectedUser) {
//       const messageId = [currentUser.id, selectedUser.id].sort().join('_');
//       await addDoc(collection(firestore, `directMessages/${messageId}/messages`), messageData);
//     }
//     setNewMessage('');
//   };

  return (
    <div>
      <div className="channels-header">
        <h2>Channels</h2>
        <FontAwesomeIcon icon={faCog} onClick={() => setModalIsOpen(true)} className="gear-icon" />
      </div>
      <ul>
        {joinedChannels.map(channel => (
          <li
            key={channel.id}
            onClick={() => handleChannelSelect(channel)}
            className={`${activeChannel && activeChannel.id === channel.id ? 'selected' : ''}`}
          >
             #{channel.name}
            {unreadCounts[channel.id] > 0 && (
              <span className="unread-indicator">{unreadCounts[channel.id]}</span>
            )}
          </li>
        ))}
      </ul>
      <ul>
        {directMessages.map(directMessage => (
          <li
            key={directMessage.id}
            onClick={() => handleDirectMessageSelect(directMessage)}
            className={`${activeDirectMessage && activeDirectMessage.id === directMessage.id ? 'selected' : ''}`}
          >
            {directMessage.name}
          </li>
        ))}
      </ul>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Manage Channels"
        className="modal"
        overlayClassName="overlay"
      >
        <h2>Available Channels</h2>
        <ul>
          {channels.map(channel => (
            <li key={channel.id}>
              {channel.name} 
              {joinedChannels.some(c => c.id === channel.id) ? ' (Joined)' : (
                <button onClick={() => joinChannel(channel)}>Join</button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={createChannel}>
          <input
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="New Channel Name"
            required
          />
          <button type="submit">Create Channel</button>
        </form>
        <button onClick={() => setModalIsOpen(false)}>Close</button>
      </Modal>
    </div>
  );
};

export default Channels; 