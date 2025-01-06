import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, firestore } from '../firebase';
import Channels from './Channels';
import DirectMessages from './DirectMessages';
import './Messaging.css';

const Messaging = ({ currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (selectedChannel) {
      const q = query(
        collection(firestore, `channels/${selectedChannel.id}/messages`),
        orderBy('createdAt')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(messagesData);
      });

      return () => unsubscribe();
    }
  }, [selectedChannel]);

  useEffect(() => {
    if (selectedUser) {
      const q = query(
        collection(firestore, `directMessages/${currentUser.id}_${selectedUser.id}/messages`),
        orderBy('createdAt')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(messagesData);
      });

      return () => unsubscribe();
    }
  }, [selectedUser, currentUser.id]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (selectedChannel) {
      await addDoc(collection(firestore, `channels/${selectedChannel.id}/messages`), {
        text: newMessage,
        createdAt: new Date(),
        senderName: currentUser.name
      });
    } else if (selectedUser) {
      await addDoc(collection(firestore, `directMessages/${currentUser.id}_${selectedUser.id}/messages`), {
        text: newMessage,
        createdAt: new Date(),
        senderName: currentUser.name
      });
    }
    setNewMessage('');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Redirect to login page or handle logout
    } catch (error) {
      console.error("Error logging out: ", error);
    }
  };

  const handleChannelSelect = (channel) => {
    console.log("Channel selected:", channel);
    setSelectedChannel(channel);
    setSelectedUser(null);
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setSelectedChannel(null);
  };

  return (
    <div className="messaging-container">
      <div className="sidebar">
        <Channels currentUser={currentUser} onChannelSelect={handleChannelSelect} />
        <DirectMessages currentUser={currentUser} onUserSelect={handleUserSelect} />
        <button onClick={handleLogout}>Logout</button>
      </div>
      <div className="chat-area">
        {(selectedChannel || selectedUser) && (
          <div className="chat-header">
            <h2>
              {selectedChannel ? `Channel: ${selectedChannel.name}` : `Chat with ${selectedUser.name}`}
            </h2>
          </div>
        )}
        <div className="messages">
          {messages.map(message => (
            <div key={message.id} className="message">
              <strong>{message.senderName}:</strong> {message.text}
            </div>
          ))}
        </div>
        {(selectedChannel || selectedUser) && (
          <form onSubmit={sendMessage} className="message-form">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message"
            />
            <button type="submit">Send</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Messaging;