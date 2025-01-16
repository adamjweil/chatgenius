import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import { indexMessage } from './vectorService.js';

const AI_CHATBOT_CHANNEL_ID = 'ai-chatbot'; // Define the channel ID to exclude

const formatTimestamp = (timestamp) => {
  if (!timestamp) return new Date().toISOString();
  
  // Handle Firestore Timestamp
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  
  // Handle regular Date object
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  // If it's already an ISO string, return it
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  
  // Handle numeric timestamp
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }

  // Default fallback
  return new Date().toISOString();
};

const getAllChannelMessages = async () => {
  try {
    const channelsSnapshot = await getDocs(collection(firestore, 'channels'));
    let allMessages = [];

    for (const channelDoc of channelsSnapshot.docs) {
      // Skip the AI chatbot channel
      if (channelDoc.id === AI_CHATBOT_CHANNEL_ID) continue;

      const messagesSnapshot = await getDocs(
        query(
          collection(firestore, `channels/${channelDoc.id}/messages`),
          orderBy('createdAt', 'desc')
        )
      );
      
      const messages = messagesSnapshot.docs.map(doc => ({
        ...doc.data(),
        messageId: doc.id,
        channelId: channelDoc.id
      }));
      
      allMessages = [...allMessages, ...messages];
    }

    return allMessages;
  } catch (error) {
    console.error('Error getting all messages:', error);
    return [];
  }
};

export const reindexAllMessages = async () => {
  console.log('Starting full message reindexing...');
  try {
    const allMessages = await getAllChannelMessages();
    console.log(`Found ${allMessages.length} messages to index`);
    
    for (const message of allMessages) {
      if (!message.isAI) { // Don't index AI responses
        try {
          // console.log('Indexing message:', message.text);
          await indexMessage(message.text, {
            messageId: message.messageId,
            senderId: message.senderId,
            senderName: message.senderName,
            timestamp: formatTimestamp(message.createdAt), // Format timestamp
            channelId: message.channelId
          });
          // console.log('Successfully indexed message:', message.messageId);
        } catch (error) {
          console.error('Error indexing message:', message.messageId, error);
        }
      }
    }
    console.log('Finished reindexing all messages');
  } catch (error) {
    console.error('Error during full reindex:', error);
  }
};

export const startMessageIndexing = () => {
  console.log('Starting message indexing service...');
  
  // First, reindex all existing messages
  reindexAllMessages();
  
  // Then listen for new messages in all channels
  const channelsRef = collection(firestore, 'channels');
  
  const unsubscribeChannels = onSnapshot(channelsRef, (channelsSnapshot) => {
    channelsSnapshot.docs.forEach(channelDoc => {
      // Skip the AI chatbot channel
      if (channelDoc.id === AI_CHATBOT_CHANNEL_ID) return;

      const messagesRef = collection(firestore, `channels/${channelDoc.id}/messages`);
      const q = query(messagesRef, orderBy('createdAt', 'desc'));
      
      onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const message = change.doc.data();
            const messageId = change.doc.id;
            
            if (!message.isAI) { // Don't index AI responses
              try {
                // console.log('Indexing new message:', message.text);
                await indexMessage(message.text, {
                  messageId,
                  senderId: message.senderId,
                  senderName: message.senderName,
                  timestamp: formatTimestamp(message.createdAt),
                  channelId: channelDoc.id
                });
                // console.log('Successfully indexed new message:', messageId);
              } catch (error) {
                console.error('Error indexing new message:', messageId, error);
              }
            }
          }
        });
      });
    });
  });

  return () => {
    unsubscribeChannels();
  };
}; 