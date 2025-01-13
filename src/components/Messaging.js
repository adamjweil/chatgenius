import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, arrayUnion, arrayRemove, writeBatch, updateDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, firestore } from '../firebase.js';
import CameraSharing from './CameraSharing.js';
import MessageList from './MessageList.js';
import '../App.css';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faHeart } from '@fortawesome/free-solid-svg-icons';
import Sidebar from './Sidebar.js';

const Messaging = ({ currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [file, setFile] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [status, setStatus] = useState(currentUser.status || '');
  const [expandedThreads, setExpandedThreads] = useState({});
  const [showReplyInput, setShowReplyInput] = useState({});
  const [userNames, setUserNames] = useState({});
  const [channelFiles, setChannelFiles] = useState([]);
  const [currentStreamer, setCurrentStreamer] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser.name) {
        try {
          const userRef = doc(firestore, 'users', currentUser.id);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUser.name = userData.name;
            setStatus(userData.status || '');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUserData();
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
        setChannelFiles(messagesData.filter(msg => msg.fileURL).map(msg => ({
          fileName: msg.fileName,
          fileURL: msg.fileURL
        })));
        markMessagesAsRead(messagesData, `channels/${selectedChannel.id}/messages`);
      });

      return () => unsubscribe();
    } else if (selectedUser) {
      const messageId = [currentUser.id, selectedUser.id].sort().join('_');
      const q = query(
        collection(firestore, `directMessages/${messageId}/messages`),
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
        markMessagesAsRead(messagesData, `directMessages/${messageId}/messages`);
      });

      return () => unsubscribe();
    } else {
      setMessages([]); // Clear messages if no channel or user is selected
      setChannelFiles([]); // Clear files if no channel is selected
    }
  }, [selectedChannel, selectedUser]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!currentUser.name) {
      console.error('Sender name is missing');
      return;
    }

    const messageData = {
      text: newMessage,
      createdAt: new Date(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      readBy: [currentUser.id],
      likes: [], // Initialize likes as an empty array
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
    setNewMessage('');
  };

  const handleLike = async (messageId, path) => {
    const messageRef = doc(firestore, path, messageId);
    const messageDoc = await getDoc(messageRef);
    if (messageDoc.exists()) {
      const messageData = messageDoc.data();
      if (messageData.likes.includes(currentUser.id)) {
        await updateDoc(messageRef, {
          likes: arrayRemove(currentUser.id)
        });
      } else {
        await updateDoc(messageRef, {
          likes: arrayUnion(currentUser.id)
        });
      }
    }
  };

  const fetchUserNames = async (userIds) => {
    const names = {};
    for (const userId of userIds) {
      if (!userNames[userId]) {
        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          names[userId] = userDoc.data().name;
        }
      } else {
        names[userId] = userNames[userId];
      }
    }
    setUserNames(prev => ({ ...prev, ...names }));
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

  const toggleThread = (messageId) => {
    setExpandedThreads(prev => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const toggleReplyInput = (messageId) => {
    setShowReplyInput(prev => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleReply = async (messageId, replyText) => {
    const replyData = {
      text: replyText,
      createdAt: new Date(),
      senderId: currentUser.id,
      senderName: currentUser.name,
    };

    await addDoc(collection(firestore, `channels/${selectedChannel.id}/messages/${messageId}/replies`), replyData);
  };

  const leaveChannel = async () => {
    if (!selectedChannel || !currentUser) return;

    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, {
        joinedChannels: arrayRemove({ id: selectedChannel.id, name: selectedChannel.name })
      });

      setSelectedChannel(null);
      console.log('Left the channel');
    } catch (error) {
      console.error("Error leaving channel:", error);
    }
  };

  return (
    <div className="messaging-container">
      <Sidebar
        currentUser={currentUser}
        selectedChannel={selectedChannel}
        selectedUser={selectedUser}
        handleChannelSelect={handleChannelSelect}
        handleUserSelect={handleUserSelect}
        handleLogout={handleLogout}
        status={status}
        setStatus={setStatus}
      />
      <div className="chat-area">
        <div className={`chat-header ${currentStreamer ? 'with-stream' : ''}`}>
          <div className="chat-header-top">
            <div className="header-left">
              {selectedChannel && (
                <CameraSharing 
                  currentUser={currentUser} 
                  selectedChannel={selectedChannel}
                  setCurrentStreamer={setCurrentStreamer}
                />
              )}
            </div>
            <h2>
              {selectedChannel 
                ? `#${selectedChannel.name}` 
                : selectedUser 
                  ? `Chat with ${selectedUser.name}`
                  : 'Select a channel or user'}
            </h2>
            <div className="header-right">
              {selectedChannel && (
                <button onClick={leaveChannel} className="leave-channel-button">
                  Leave Channel
                </button>
              )}
            </div>
          </div>
        </div>
        
        {selectedChannel && (
          <div className="files-section">
            <h3>Files in this Channel:</h3>
            <div className="files-list">
              {channelFiles.map(file => (
                <a 
                  key={file.fileName}
                  href={file.fileURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="file-item"
                >
                  {file.fileName}
                </a>
              ))}
            </div>
          </div>
        )}
        
        <MessageList
          messages={messages}
          currentUser={currentUser}
          selectedChannel={selectedChannel}
          selectedUser={selectedUser}
          handleLike={handleLike}
          expandedThreads={expandedThreads}
          showReplyInput={showReplyInput}
          toggleThread={toggleThread}
          toggleReplyInput={toggleReplyInput}
          handleReply={handleReply}
          userNames={userNames}
          fetchUserNames={fetchUserNames}
        />
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