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
import AIChatbot from './AIChatbot.js';
import MessageInput from './MessageInput.js';
import { generatePersonaResponse } from '../services/personaService.js';
// import { FishAudio } from 'fish-audio-sdk';
// import FishAudio from 'fish-audio-sdk'; // If it's a default export

const storage = getStorage(); // Add this line

const Messaging = ({ 
  currentUser, 
  selectedChannel, 
  selectedUser, 
  handleChannelSelect,
  handleUserSelect,
//   handleLogout
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [status, setStatus] = useState(currentUser.status || '');
  const [expandedThreads, setExpandedThreads] = useState({});
  const [showReplyInput, setShowReplyInput] = useState({});
  const [userNames, setUserNames] = useState({});
  const [channelFiles, setChannelFiles] = useState([]);
  const [currentStreamer, setCurrentStreamer] = useState(null);
//   const fishAudio = new FishAudio();

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
    let unsubscribe = () => {};

    if (selectedChannel) {
      const q = query(
        collection(firestore, `channels/${selectedChannel.id}/messages`),
        orderBy('createdAt')
      );
      unsubscribe = onSnapshot(q, async (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(messagesData);
        
        // Mark channel messages as read
        await markMessagesAsRead(messagesData, `channels/${selectedChannel.id}/messages`);
      });
    } else if (selectedUser) {
      const dmId = [currentUser.id, selectedUser.id].sort().join('_');
      const q = query(
        collection(firestore, `directMessages/${dmId}/messages`),
        orderBy('createdAt')
      );
      
      unsubscribe = onSnapshot(q, async (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(messagesData);
        
        // Mark direct messages as read
        await markMessagesAsRead(messagesData, `directMessages/${dmId}/messages`);
      });
    }

    return () => unsubscribe();
  }, [selectedChannel, selectedUser, currentUser.id]);

  useEffect(() => {
    if (messages && selectedChannel) {
      // Filter messages to get only those with files
      const filesFromMessages = messages
        .filter(message => message.fileURL && message.fileName)
        .map(message => ({
          fileName: message.fileName,
          fileURL: message.fileURL
        }));
      
      setChannelFiles(filesFromMessages);
    }
  }, [messages, selectedChannel]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    console.log('Selected file:', selectedFile); // Debug log
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    // Ensure either message or file is present
    if (!newMessage.trim() && !file) {
      console.log('No message or file to send'); // Debug log
      return; 
    }

    try {
      const messageData = {
        text: newMessage,
        senderId: currentUser.id,
        senderName: currentUser.name,
        createdAt: new Date(),
        likes: [],
        readBy: [currentUser.id],
        fileURL: null,
        fileName: null,
      };

      if (file) {
        const storageRef = ref(storage, `messages/${file.name}`);
        await uploadBytes(storageRef, file);
        const fileURL = await getDownloadURL(storageRef);

        messageData.fileURL = fileURL;
        messageData.fileName = file.name;
      }

      if (selectedChannel) {
        await addDoc(collection(firestore, `channels/${selectedChannel.id}/messages`), messageData);
      } else if (selectedUser) {
        const dmId = [currentUser.id, selectedUser.id].sort().join('_');
        const dmRef = collection(firestore, `directMessages/${dmId}/messages`);
        await addDoc(dmRef, messageData);
      }

      // Reset input fields
      setNewMessage('');
      setFile(null); // Reset the file input
    } catch (error) {
      console.error('Error sending message:', error);
    }
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

  const markMessagesAsRead = async (messages, path) => {
    const batch = writeBatch(firestore);
    let hasUpdates = false;

    messages.forEach(message => {
      if (!message.readBy?.includes(currentUser.id)) {
        const messageRef = doc(firestore, path, message.id);
        batch.update(messageRef, {
          readBy: arrayUnion(currentUser.id)
        });
        hasUpdates = true;
      }
    });

    // Only commit the batch if there are updates to make
    if (hasUpdates) {
      try {
        await batch.commit();
        console.log('Messages marked as read');
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }
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
      
      console.log('Left the channel');
    } catch (error) {
      console.error("Error leaving channel:", error);
    }
  };

  const handleKeyPress = async (e) => {
    if (e.key === 'Enter' && newMessage.trim()) {
      e.preventDefault();
      sendMessage(e);
    }
  };

//   const readMessage = async (text) => {
//     try {
//       await FishAudio.speak(text);
//     } catch (error) {
//       console.error('Error with text-to-speech:', error);
//     }
//   };

  const renderContent = () => {
    if (selectedChannel && selectedChannel.name === 'ai-chatbot') {
      return <AIChatbot currentUser={currentUser} />;
    }

    return (
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
        onSendMessage={handleKeyPress}
      />
    );
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (selectedUser) {
        try {
          const userRef = doc(firestore, 'users', selectedUser.id);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            selectedUser.aiPersonaEnabled = userData.aiPersonaEnabled;
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUserData();
  }, [selectedUser]);

  return (
    <div className="messaging-container">
      <Sidebar
        currentUser={currentUser}
        selectedChannel={selectedChannel}
        selectedUser={selectedUser}
        handleChannelSelect={handleChannelSelect}
        handleUserSelect={handleUserSelect}
        handleLogout={handleLogout}
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
        
        {renderContent()}
        {(selectedChannel && selectedChannel.name !== 'ai-chatbot') || selectedUser ? (
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
            {file && (
              <div className="file-preview">
                <span>Selected file: {file.name}</span>
              </div>
            )}
          </form>
        ) : null}
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