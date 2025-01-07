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
  const [expandedThreads, setExpandedThreads] = useState({});
  const [showReplyInput, setShowReplyInput] = useState({});

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
      });

      return () => unsubscribe();
    } else {
      setMessages([]); // Clear messages if no channel or user is selected
    }
  }, [selectedChannel, selectedUser]);

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
              {selectedChannel && (
                <RepliesButton
                  messageId={message.id}
                  channelId={selectedChannel.id}
                  toggleThread={toggleThread}
                  toggleReplyInput={toggleReplyInput}
                />
              )}
              {expandedThreads[message.id] && selectedChannel && (
                <Thread
                  messageId={message.id}
                  channelId={selectedChannel.id}
                  onReply={handleReply}
                />
              )}
              {showReplyInput[message.id] && (
                <ReplyForm onReply={(text) => handleReply(message.id, text)} />
              )}
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

const RepliesButton = ({ messageId, channelId, toggleThread, toggleReplyInput }) => {
  const [hasReplies, setHasReplies] = useState(false);

  useEffect(() => {
    const q = query(
      collection(firestore, `channels/${channelId}/messages/${messageId}/replies`)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasReplies(!snapshot.empty);
    });

    return () => unsubscribe();
  }, [channelId, messageId]);

  return (
    <>
      {hasReplies ? (
        <button onClick={() => toggleThread(messageId)}>
          View Thread
        </button>
      ) : (
        <button onClick={() => toggleReplyInput(messageId)}>
          Reply
        </button>
      )}
    </>
  );
};

const Thread = ({ messageId, channelId, onReply }) => {
  const [replies, setReplies] = useState([]);

  useEffect(() => {
    const q = query(
      collection(firestore, `channels/${channelId}/messages/${messageId}/replies`),
      orderBy('createdAt')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const repliesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setReplies(repliesData);
    });

    return () => unsubscribe();
  }, [channelId, messageId]);

  return (
    <div className="thread">
      {replies.map(reply => (
        <div key={reply.id} className="reply">
          <strong>{reply.senderName}:</strong> {reply.text}
        </div>
      ))}
    </div>
  );
};

const ReplyForm = ({ onReply }) => {
  const [replyText, setReplyText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onReply(replyText);
    setReplyText('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder="Type a reply"
      />
      <button type="submit">Reply</button>
    </form>
  );
};

export default Messaging;