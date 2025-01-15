import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import { indexMessage, queryVectorDB } from './vectorService.js';
import openai from './openai.js';

export const indexUserMessages = async (userId) => {
  try {
    // Get all messages from all channels
    const channelsSnapshot = await getDocs(collection(firestore, 'channels'));
    let userMessages = [];

    // Collect messages from channels
    for (const channelDoc of channelsSnapshot.docs) {
      const messagesQuery = query(
        collection(firestore, `channels/${channelDoc.id}/messages`),
        where('senderId', '==', userId)
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      
      userMessages = [...userMessages, ...messagesSnapshot.docs.map(doc => ({
        ...doc.data(),
        messageId: doc.id,
        source: 'channel',
        channelId: channelDoc.id
      }))];
    }

    // Get direct messages
    const dmQuery = query(
      collection(firestore, 'directMessages'),
      where('senderId', '==', userId)
    );
    const dmSnapshot = await getDocs(dmQuery);
    userMessages = [...userMessages, ...dmSnapshot.docs.map(doc => ({
      ...doc.data(),
      messageId: doc.id,
      source: 'dm'
    }))];

    // Index each message
    for (const message of userMessages) {
      await indexMessage(message.text, {
        messageId: message.messageId,
        senderId: userId,
        source: message.source,
        channelId: message.channelId,
        isDM: message.source === 'dm',
        isPersonaData: true // Mark as persona data
      });
    }

    return true;
  } catch (error) {
    console.error('Error indexing user messages:', error);
    throw error;
  }
};

export const generatePersonaResponse = async (userId, incomingMessage) => {
  console.log('Starting persona response generation for user:', userId);
  try {
    // Query vector DB for relevant messages from this user
    const relevantMessages = await queryVectorDB(incomingMessage, {
      filter: { 
        senderId: userId,
        isPersonaData: true 
      },
      topK: 10
    });

    console.log('Found relevant messages:', relevantMessages);

    // Create context from relevant messages
    const context = relevantMessages
      .map(msg => msg.metadata.text)
      .join('\n');

    console.log('Generated context:', context);

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are acting as an AI persona based on the user's message history. 
                   Analyze the following messages to understand their communication style, 
                   tone, and typical responses. Then respond to the incoming message in a 
                   way that matches their style. Keep responses concise and natural.`
        },
        {
          role: "user",
          content: `Context (previous messages from this user):\n${context}\n\n
                   Incoming message to respond to: ${incomingMessage}\n\n
                   Please respond in a way that matches the user's style and tone.`
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const response = completion.choices[0].message.content;
    console.log('Generated AI response:', response);
    return response;
  } catch (error) {
    console.error('Error generating persona response:', error);
    throw error;
  }
}; 