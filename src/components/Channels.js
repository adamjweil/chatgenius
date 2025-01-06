import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { firestore } from '../firebase';
import './Channels.css';

Modal.setAppElement('#root');

const Channels = ({ onChannelSelect, currentUser }) => {
  const [channelName, setChannelName] = useState('');
  const [channels, setChannels] = useState([]);
  const [joinedChannels, setJoinedChannels] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.id) {
      fetchChannels();
      fetchJoinedChannels();
    }
  }, [currentUser]);

  const fetchChannels = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, 'channels'));
      const channelsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChannels(channelsData);
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

  return (
    <div>
      <div className="channels-header">
        <h2>Channels</h2>
        <FontAwesomeIcon icon={faCog} onClick={() => setModalIsOpen(true)} className="gear-icon" />
      </div>
      <ul>
        {joinedChannels.map(channel => (
          <li key={channel.id} onClick={() => onChannelSelect(channel)}>
            {channel.name}
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