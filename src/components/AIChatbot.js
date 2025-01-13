import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import { queryVectorDB } from '../services/vectorService.js';
import MessageList from './MessageList.js';

const AIChatbot = ({ currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userNames, setUserNames] = useState({});
  const [expandedThreads, setExpandedThreads] = useState({});
  const [showReplyInput, setShowReplyInput] = useState({});
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const q = query(
      collection(firestore, 'channels/ai-chatbot/messages'),
      orderBy('createdAt')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, []);

  const clearChat = async () => {
    if (window.confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
      setIsClearing(true);
      try {
        const q = query(collection(firestore, 'channels/ai-chatbot/messages'));
        const querySnapshot = await getDocs(q);
        
        // Delete all documents in batches
        const deletePromises = querySnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        
        await Promise.all(deletePromises);
        console.log('Chat history cleared successfully');
      } catch (error) {
        console.error('Error clearing chat:', error);
      } finally {
        setIsClearing(false);
      }
    }
  };

  const handleLike = async (messageId, path) => {
    console.log('Like clicked:', messageId);
  };

  const toggleThread = (messageId) => {
    setExpandedThreads(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const toggleReplyInput = (messageId) => {
    setShowReplyInput(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handleReply = async (messageId, text) => {
    console.log('Reply to message:', messageId, text);
  };

  const fetchUserNames = async (userIds) => {
    console.log('Fetching user names for:', userIds);
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    try {
      // First, add the user's message to Firestore
      const userMessageRef = await addDoc(collection(firestore, 'channels/ai-chatbot/messages'), {
        text,
        senderId: currentUser.id,
        senderName: currentUser.name,
        createdAt: new Date(),
        channelId: 'ai-chatbot',
        isAI: false
      });

      try {
        // Then query the vector DB and generate AI response
        const relevantMessages = await queryVectorDB(text);
        console.log('Relevant messages:', relevantMessages);

        // Add the AI's response to Firestore
        await addDoc(collection(firestore, 'channels/ai-chatbot/messages'), {
          text: relevantMessages.length > 0 
            ? `Based on the chat history, here's what I found: ${relevantMessages.map(match => match.metadata.text).join('\n')}` 
            : "I couldn't find any relevant information in the chat history.",
          senderId: 'ai-bot',
          senderName: 'AI Assistant',
          createdAt: new Date(),
          channelId: 'ai-chatbot',
          isAI: true
        });
      } catch (vectorError) {
        console.error('Error with vector search:', vectorError);
        // Send an error response
        await addDoc(collection(firestore, 'channels/ai-chatbot/messages'), {
          text: "I'm having trouble searching the chat history right now. Please try again later.",
          senderId: 'ai-bot',
          senderName: 'AI Assistant',
          createdAt: new Date(),
          channelId: 'ai-chatbot',
          isAI: true
        });
      }
    } catch (error) {
      console.error('Error in AI chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-chatbot">
      <div className="ai-chatbot-header">
        <h2>AI Chatbot</h2>
        <button 
          onClick={clearChat} 
          disabled={isClearing || messages.length === 0}
          className="clear-chat-button"
        >
          {isClearing ? 'Clearing...' : 'Clear Chat History'}
        </button>
      </div>
      <MessageList 
        messages={messages}
        currentUser={currentUser}
        selectedChannel={{ id: 'ai-chatbot', name: 'AI Chatbot' }}
        selectedUser={null}
        handleLike={handleLike}
        expandedThreads={expandedThreads}
        showReplyInput={showReplyInput}
        toggleThread={toggleThread}
        toggleReplyInput={toggleReplyInput}
        handleReply={handleReply}
        userNames={userNames}
        fetchUserNames={fetchUserNames}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </div>
  );
};

export default AIChatbot; 