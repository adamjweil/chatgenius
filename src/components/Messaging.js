import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, arrayUnion, writeBatch } from 'firebase/firestore';
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
        markMessagesAsRead(messagesData, `channels/${selectedChannel.id}/messages`);
      });

      return () => unsubscribe();
    }
  }, [selectedChannel]);

  useEffect(() => {
    if (selectedUser) {
      const messageId = [currentUser.id, selectedUser.id].sort().join('_');
      const q = query(
        collection(firestore, `directMessages/${messageId}/messages`),
        orderBy('createdAt')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(messagesData);
        markMessagesAsRead(messagesData, `directMessages/${messageId}/messages`);
      });

      return () => unsubscribe();
    }
  }, [selectedUser, currentUser.id]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const messageData = {
      text: newMessage,
      createdAt: new Date(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      readBy: [],
    };

    if (selectedChannel) {
      await addDoc(collection(firestore, `channels/${selectedChannel.id}/messages`), messageData);
    } else if (selectedUser) {
      const messageId = [currentUser.id, selectedUser.id].sort().join('_');
      await addDoc(collection(firestore, `directMessages/${messageId}/messages`), messageData);
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

  const hasUnreadMessages = (messages) => {
    return messages.some(message => !message.readBy.includes(currentUser.id));
  };

  return (
    <div className="messaging-container">
      <div className="sidebar">
        <Channels
          currentUser={currentUser}
          onChannelSelect={handleChannelSelect}
          selectedChannel={selectedChannel}
        />
        <DirectMessages
          currentUser={currentUser}
          onUserSelect={handleUserSelect}
          selectedUser={selectedUser}
        />
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