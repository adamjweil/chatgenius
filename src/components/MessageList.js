import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { firestore } from '../firebase.js';

const MessageList = ({ 
  messages, 
  currentUser, 
  selectedChannel, 
  selectedUser, 
  handleLike, 
  expandedThreads,
  showReplyInput,
  toggleThread,
  toggleReplyInput,
  handleReply,
  userNames,
  fetchUserNames,
  onSendMessage
}) => {
  const [currentStreamer, setCurrentStreamer] = useState(null);
  const [messageText, setMessageText] = useState('');

  // Listen for streamer changes
  useEffect(() => {
    if (selectedChannel) {
      const channelRef = doc(firestore, 'channels', selectedChannel.id);
      const unsubscribe = onSnapshot(channelRef, (doc) => {
        const data = doc.data();
        if (data) {
          setCurrentStreamer(data.currentStreamer);
        }
      });
      return () => unsubscribe();
    }
  }, [selectedChannel]);

  // Add timestamp formatting helper
  const formatTimestamp = (timestamp) => {
    try {
      // Check if timestamp is a Firebase Timestamp
      if (timestamp && typeof timestamp.toDate === 'function') {
        return format(timestamp.toDate(), 'p');
      }
      // Check if timestamp is a Date object or can be converted to one
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return format(date, 'p');
      }
      return 'No timestamp';
    } catch (error) {
      console.error('Error formatting timestamp:', error, timestamp);
      return 'Invalid date';
    }
  };

  // Thread component functionality
  const Thread = ({ messageId, channelId }) => {
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
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        }));
        setReplies(repliesData);
      });

      return () => unsubscribe();
    }, [messageId, channelId]);

    return (
      <div className="thread">
        {replies.map(reply => (
          <div key={reply.id} className="reply">
            <strong>{reply.senderName}</strong>
            {reply.text}
            <div className="reply-info">
              {formatTimestamp(reply.createdAt)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ReplyForm component functionality
  const ReplyForm = ({ onReply }) => {
    const [replyText, setReplyText] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (replyText.trim()) {
        onReply(replyText);
        setReplyText('');
      }
    };

    return (
      <form onSubmit={handleSubmit} className="reply-form">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write a reply..."
        />
        <button type="submit">Reply</button>
      </form>
    );
  };

  // RepliesButton component functionality
  const RepliesButton = ({ messageId, channelId, toggleThread, toggleReplyInput }) => {
    const [replyCount, setReplyCount] = useState(0);

    useEffect(() => {
      const fetchReplyCount = async () => {
        const q = query(
          collection(firestore, `channels/${channelId}/messages/${messageId}/replies`)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          setReplyCount(snapshot.docs.length);
        });

        return () => unsubscribe();
      };

      fetchReplyCount();
    }, [messageId, channelId]);

    return (
      <div className="replies-actions">
        {replyCount > 0 && (
          <button onClick={() => toggleThread(messageId)}>
            {expandedThreads[messageId] ? 'Hide Replies' : `Show ${replyCount} ${replyCount === 1 ? 'Reply' : 'Replies'}`}
          </button>
        )}
        <button onClick={() => toggleReplyInput(messageId)}>
          {showReplyInput[messageId] ? 'Cancel Reply' : 'Reply'}
        </button>
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      await onSendMessage(messageText);
      setMessageText('');
    }
  };

  return (
    <div className="messages-container">
      <div className={`messages ${currentStreamer && currentStreamer !== currentUser.id ? 'viewing-stream' : ''}`}>
        {messages.map(message => (
          <div
            key={message.id}
            className={`message ${
              selectedChannel 
                ? 'channel-message' 
                : message.senderId === currentUser.id 
                  ? 'my-message' 
                  : 'other-message'
            }`}
          >
            <div className="message-header">
              <strong>{message.senderName}</strong>
              <span className="message-timestamp">
                {formatTimestamp(message.createdAt)}
              </span>
            </div>
            
            <div className="message-content">
              {message.text}
              {selectedChannel && message.fileURL && (
                <div className="file-attachment">
                  <a href={message.fileURL} target="_blank" rel="noopener noreferrer">
                    {message.fileName}
                  </a>
                </div>
              )}
            </div>

            <div className="message-actions">
              <div className="like-section">
                <button onClick={() => handleLike(message.id, selectedChannel ? 
                  `channels/${selectedChannel.id}/messages` : 
                  `directMessages/${[currentUser.id, selectedUser.id].sort().join('_')}/messages`)}>
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
            </div>

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
      <form onSubmit={handleSubmit} className="message-input-container">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={selectedChannel?.id === 'ai-chatbot' 
            ? "Ask me anything about the chat history..." 
            : "Type a message..."}
          className="message-input"
        />
        <button type="submit" className="send-button">
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </form>
    </div>
  );
};

export default MessageList; 