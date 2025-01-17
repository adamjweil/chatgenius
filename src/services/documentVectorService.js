import { PineconeClient } from '@pinecone-database/pinecone';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import openai from './openai.js';

let pineconeIndex = null;

const initPinecone = async () => {
  if (!pineconeIndex) {
    const pinecone = new PineconeClient();
    await pinecone.init({
      environment: process.env.REACT_APP_PINECONE_ENVIRONMENT,
      apiKey: process.env.REACT_APP_PINECONE_API_KEY,
    });
    
    pineconeIndex = pinecone.Index(process.env.REACT_APP_PINECONE_INDEX);
  }
  return pineconeIndex;
};

export const indexDocument = async (file) => {
  try {
    const index = await initPinecone();
    // Get the file content (you'll need to implement this based on your file type)
    const content = await getFileContent(file);
    
    // Split content into chunks
    const chunks = splitIntoChunks(content);
    
    // Get embeddings for each chunk
    const embeddings = await Promise.all(
      chunks.map(async (chunk) => {
        const response = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunk,
        });
        return response.data[0].embedding;
      })
    );

    // Upsert vectors to Pinecone
    await index.upsert({
      vectors: chunks.map((chunk, i) => ({
        id: `${file.fileName}-${i}`,
        values: embeddings[i],
        metadata: {
          text: chunk,
          fileName: file.fileName,
          fileURL: file.fileURL
        }
      }))
    });

    return true;
  } catch (error) {
    console.error('Error indexing document:', error);
    return false;
  }
};

export const queryDocumentVectors = async (question, fileName) => {
  try {
    const index = await initPinecone();
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: question,
    });

    const queryResponse = await index.query({
      vector: queryEmbedding.data[0].embedding,
      filter: { fileName: fileName },
      topK: 5,
      includeMetadata: true
    });

    return queryResponse.matches;
  } catch (error) {
    console.error('Error querying vectors:', error);
    return [];
  }
};

// Helper functions for processing different file types
const getFileContent = async (file) => {
  // Implement based on your file types
  // You might need different parsers for PDFs, DOCs, etc.
  return "file content";
};

const splitIntoChunks = (content, chunkSize = 1000) => {
  // Implement chunking logic
  return [content];
}; 