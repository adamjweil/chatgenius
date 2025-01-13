import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

const MessageInput = ({ 
  currentUser, 
  selectedChannel, 
  onSendMessage, 
  isLoading, 
  placeholder = "Type a message..." 
}) => {
  const [messageText, setMessageText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText);
      setMessageText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input-container">
      <input
        type="text"
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        className="message-input"
      />
      <button 
        type="submit" 
        disabled={!messageText.trim() || isLoading}
        className="send-button"
      >
        <FontAwesomeIcon icon={faPaperPlane} />
      </button>
    </form>
  );
};

export default MessageInput; 