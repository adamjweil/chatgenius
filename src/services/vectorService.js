import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

let pineconeInstance = null;

export const initPinecone = async () => {
  if (pineconeInstance) return pineconeInstance;

  const pinecone = new Pinecone({
    apiKey: process.env.REACT_APP_PINECONE_API_KEY,
  });

  pineconeInstance = pinecone;
  return pinecone;
};

export const indexMessage = async (message, metadata = {}) => {
  try {
    const pinecone = await initPinecone();
    
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: message,
    });

    const embedding = embeddingResponse.data[0].embedding;
    const index = pinecone.index(process.env.REACT_APP_PINECONE_INDEX);

    // Simplified upsert format
    await index.upsert([{
      id: metadata.messageId || Date.now().toString(),
      values: embedding,
      metadata: {
        text: message,
        senderId: metadata.senderId,
        senderName: metadata.senderName,
        timestamp: metadata.timestamp,
        channelId: metadata.channelId
      }
    }]);

    console.log('Message indexed successfully with ID:', metadata.messageId);
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }
};

export const queryVectorDB = async (query) => {
  try {
    const pinecone = await initPinecone();
    
    console.log('Getting embedding for query:', query);
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;
    
    console.log('Querying Pinecone index...');
    const index = pinecone.index(process.env.REACT_APP_PINECONE_INDEX);
    
    // Simplified query format
    const queryResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true
    });

    console.log('Query response:', queryResponse);
    return queryResponse.matches || [];
  } catch (error) {
    console.error('Error in queryVectorDB:', error);
    throw error;
  }
};

export const clearPineconeIndex = async () => {
  try {
    console.log('Starting to clear Pinecone index...');
    const pinecone = await initPinecone();
    const index = pinecone.index(process.env.REACT_APP_PINECONE_INDEX);
    
    // Delete all vectors from the index
    await index.deleteAll();
    
    console.log('Successfully cleared Pinecone index');
  } catch (error) {
    console.error('Error clearing Pinecone index:', error);
    throw error;
  }
}; 