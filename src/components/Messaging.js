import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, arrayUnion, writeBatch, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, firestore } from '../firebase';
import Channels from './Channels';
import DirectMessages from './DirectMessages';
import './Messaging.css';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';

const Messaging = ({ currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [file, setFile] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [status, setStatus] = useState(currentUser.status || '');

  useEffect(() => {
    console.log('Current User:', currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (selectedChannel) {
      const q = query(
        collection(firestore, `channels/${selectedChannel.id}/messages`),
        orderBy('createdAt')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          };
        });
        setMessages(messagesData);
      });

      return () => unsubscribe();
    } else {
      setMessages([]); // Clear messages if no channel is selected
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
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        }));
        setMessages(messagesData);
        markMessagesAsRead(messagesData, `directMessages/${messageId}/messages`);
      });

      return () => unsubscribe();
    }
  }, [selectedUser, currentUser.id]);

  useEffect(() => {
    const userRef = doc(firestore, 'users', currentUser.id);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setStatus(userData.status);
      }
    });

    return () => unsubscribe();
  }, [currentUser.id]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const messageData = {
      text: newMessage,
      createdAt: new Date(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      readBy: [currentUser.id],
    };

    if (file) {
      const storage = getStorage();
      const storageRef = ref(storage, `uploads/${file.name}`);
      await uploadBytes(storageRef, file);
      const fileURL = await getDownloadURL(storageRef);
      messageData.fileURL = fileURL;
      messageData.fileName = file.name;
      setFile(null);
    }

    if (selectedChannel) {
      await addDoc(collection(firestore, `channels/${selectedChannel.id}/messages`), messageData);
    } else if (selectedUser) {
      const messageId = [currentUser.id, selectedUser.id].sort().join('_');
      await addDoc(collection(firestore, `directMessages/${messageId}/messages`), messageData);
    }
    console.log('Sending message:', messageData);
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
    console.log("User selected:", user);
    setSelectedUser(user);
    setSelectedChannel(null);
    console.log("Selected Channel after user select:", selectedChannel);
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

  const handleStatusChange = () => {
    const userRef = doc(firestore, 'users', currentUser.id);
    updateDoc(userRef, { status: newStatus })
      .then(() => {
        setStatus(newStatus);
        setStatusModalOpen(false);
        setNewStatus('');
      })
      .catch((error) => {
        console.error('Error updating status:', error);
      });
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

    <div className="user-info">
          <strong>{currentUser.name}</strong>
          <div className="status">
            <span>{status || "Set your status"}</span>
            <button onClick={() => setStatusModalOpen(true)}>
              {status ? "Change Status" : "Set Status"}
            </button>
          </div>
        </div>
        
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>
      <div className="chat-area">
        {(selectedChannel || selectedUser) && (
          <div className="chat-header">
            <h2>
              {selectedChannel ? `#${selectedChannel.name}` : `Chat with ${selectedUser.name}`}
            </h2>
          </div>
        )}
        <div className="messages">
          {messages.map(message => (
            <div
              key={message.id}
              className={`message ${message.senderId === currentUser.id ? 'my-message' : 'other-message'}`}
            >
              <div>
                <strong>{message.senderName}:</strong> {message.text}
                {message.fileURL && (
                  <div>
                    <a href={message.fileURL} target="_blank" rel="noopener noreferrer">
                      {message.fileName}
                    </a>
                  </div>
                )}
              </div>
              <div className={`message-info ${message.senderId === currentUser.id ? 'my-info' : 'other-info'}`}>
                Sent by {message.senderName} at {format(new Date(message.createdAt), 'p, MMM d')}
              </div>
            </div>
          ))}
        </div>
        {(selectedChannel || selectedUser) && (
          <form onSubmit={sendMessage} className="message-form">
            <div className="input-container">
              <label htmlFor="file-input" className="file-icon">
                <FontAwesomeIcon icon={faPaperclip} />
              </label>
              <input
                id="file-input"
                type="file"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message"
                className="text-input"
              />
              <button type="submit" className="send-button">Send</button>
            </div>
          </form>
        )}
      </div>
      {statusModalOpen && (
        <div className="status-modal">
          <input
            type="text"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            placeholder="Enter your status"
          />
          <button onClick={handleStatusChange}>Save</button>
        </div>
      )}
    </div>
  );
};

export default Messaging;