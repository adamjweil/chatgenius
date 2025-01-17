import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import openai from '../services/openai.js';
import { indexDocument, queryDocumentVectors } from '../services/documentVectorService.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner, faPaperPlane, faRobot } from '@fortawesome/free-solid-svg-icons';

const DocumentQAModal = ({ file, isOpen, onClose, currentUser }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    
    setIsLoading(true);
    try {
      // Query the vector DB for relevant document chunks
      const relevantChunks = await queryDocumentVectors(question, file.fileName);
      
      // Prepare context from relevant chunks
      const context = relevantChunks
        .filter(chunk => chunk.score > 0.5)
        .map(chunk => chunk.metadata.text)
        .join('\n');

      // Get AI response using ChatGPT with context
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [
          {
            role: "system",
            content: `You are a knowledgeable assistant analyzing the document "${file.fileName}". 
Your task is to:
1. Provide detailed, accurate answers based on the document content
2. Cite specific sections or quotes from the document to support your answers
3. Clearly indicate when you're making inferences vs stating direct facts
4. If the answer cannot be fully derived from the document, acknowledge this and explain what additional information might be needed
5. Structure your responses with clear sections:
   - Main Answer
   - Supporting Evidence
   - Additional Context/Caveats (if applicable)
6. If the question is unclear, ask for clarification rather than making assumptions`
          },
          {
            role: "user",
            content: `Document Context:\n${context}\n\nQuestion: ${question}\n\nPlease provide a comprehensive answer with citations and reasoning.`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const aiResponse = completion.choices[0].message.content;
      setAnswer(aiResponse);

      // Store the Q&A interaction
      await addDoc(collection(firestore, 'documentQA'), {
        fileName: file.fileName,
        fileURL: file.fileURL,
        question,
        answer: aiResponse,
        userId: currentUser.id,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error processing question:', error);
      setAnswer('Sorry, there was an error processing your question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="document-qa-modal">
        <div className="modal-header">
          <h2>Ask about <span className="filename">{file.fileName}</span></h2>
          <button onClick={onClose} className="close-button">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {isIndexing ? (
          <div className="indexing-message">
            <FontAwesomeIcon icon={faSpinner} spin />
            <p>Preparing document for questions...</p>
          </div>
        ) : (
          <div className="modal-content">
            <div className="question-section">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask any question about this document..."
                className="question-input"
                rows={3}
              />
              <button 
                onClick={handleAskQuestion}
                disabled={isLoading || !question.trim()}
                className="ask-button"
              >
                {isLoading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} />
                    <span>Ask Question</span>
                  </>
                )}
              </button>
            </div>

            {answer && (
              <div className="answer-section">
                <h3>
                  <FontAwesomeIcon icon={faRobot} className="ai-icon" />
                  Answer
                </h3>
                <div className="answer-content">
                  {answer.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentQAModal; 