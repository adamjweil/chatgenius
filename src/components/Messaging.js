import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, arrayUnion, arrayRemove, writeBatch, updateDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, firestore } from '../firebase';
import Channels from './Channels';
import DirectMessages from './DirectMessages';
import CameraSharing from './CameraSharing';
import './Messaging.css';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faHeart } from '@fortawesome/free-solid-svg-icons';

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
            {selectedChannel && (
              <CameraSharing currentUser={currentUser} selectedChannel={selectedChannel} />
            )}
          </div>
        )}
        {selectedChannel && channelFiles.length > 0 && (
          <div className="channel-files">
            <h3>Files in this Channel:</h3>
            <div className="file-chips">
              {channelFiles.map((file, index) => (
                <a
                  key={index}
                  href={file.fileURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="file-chip"
                >
                  {file.fileName}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="messages">
          {messages.map(message => (
            <div
              key={message.id}
              className={`message ${message.senderId === currentUser.id ? 'my-message' : 'other-message'}`}
            >
              <div>
                {message.text}
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
              <div className="like-section">
                <button onClick={() => handleLike(message.id, selectedChannel ? `channels/${selectedChannel.id}/messages` : `directMessages/${[currentUser.id, selectedUser.id].sort().join('_')}/messages`)}>
                  <FontAwesomeIcon icon={faHeart} />
                </button>
                {message.likes && message.likes.map((like, index) => (
                  <span
                    key={index}
                    onMouseEnter={() => fetchUserNames(message.likes)}
                    title={message.likes.map(userId => userNames[userId]).join(', ')}
                  >
                    <FontAwesomeIcon icon={faHeart} style={{ color: 'red', marginLeft: '4px' }} />
                  </span>
                ))}
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
      <ReplyForm onReply={(text) => onReply(messageId, text)} />
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