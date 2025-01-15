import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { updateDoc, doc } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import { indexUserMessages } from '../services/personaService.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const EditProfileModal = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState({ 
    isIndexing: false, 
    count: 0, 
    total: 0,
    currentMessage: ''
  });
  const [aiPersonaEnabled, setAiPersonaEnabled] = useState(currentUser?.aiPersonaEnabled || false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setPhotoURL(currentUser.photoURL || null);
      setAiPersonaEnabled(currentUser.aiPersonaEnabled || false);
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError('');

    try {
      console.log('Starting profile save...'); // Debug log
      const userRef = doc(firestore, 'users', currentUser.id);
      
      // Create update object, only including defined values
      const updateData = {
        name,
        aiPersonaEnabled
      };

      // Only include photoURL if it's not null
      if (photoURL !== null) {
        updateData.photoURL = photoURL;
      }
      
      // Update the user document
      await updateDoc(userRef, updateData);
      console.log('User document updated successfully'); // Debug log

      // Handle AI Persona toggle (both enabling and disabling)
      if (aiPersonaEnabled !== currentUser.aiPersonaEnabled) {
        if (aiPersonaEnabled) {
          // Enabling AI Persona
          console.log('Starting message indexing...'); // Debug log
          try {
            setIndexingProgress({ isIndexing: true, count: 0, total: 0 });
            await indexUserMessages(currentUser.id, (progress) => {
              setIndexingProgress(progress);
            });
            console.log('Message indexing completed'); // Debug log
          } catch (indexError) {
            console.error('Error during message indexing:', indexError);
            setError('Failed to index messages. Please try again.');
            return;
          } finally {
            setIndexingProgress({ isIndexing: false, count: 0, total: 0 });
          }
        } else {
          // Disabling AI Persona
          console.log('Disabling AI Persona...'); // Debug log
          try {
            // You might want to add a function to clean up indexed messages
            // await clearUserPersonaData(currentUser.id);
            console.log('AI Persona disabled successfully');
          } catch (error) {
            console.error('Error disabling AI Persona:', error);
            setError('Failed to disable AI Persona. Please try again.');
            return;
          }
        }
      }

      // Update local user object
      currentUser.name = name;
      currentUser.photoURL = photoURL;
      currentUser.aiPersonaEnabled = aiPersonaEnabled;

      onClose();
    } catch (error) {
      console.error('Error in handleSave:', error);
      setError(`Failed to update profile: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1048487) { // Check file size
        setError('File size exceeds the limit of 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result);
        setError(''); // Clear error if successful
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Edit Profile"
      className="edit-profile-modal"
      overlayClassName="modal-overlay"
    >
      <h2>Edit Profile</h2>
      <div className="tabs">
        <button onClick={() => setActiveTab('profile')} className={activeTab === 'profile' ? 'active' : ''}>
          Profile
        </button>
        <button onClick={() => setActiveTab('ai-avatar')} className={activeTab === 'ai-avatar' ? 'active' : ''}>
          AI Avatar
        </button>
      </div>
      {error && <div className="error-message">{error}</div>}
      
      {indexingProgress.isIndexing && (
        <div className="indexing-progress">
          <FontAwesomeIcon icon={faSpinner} spin className="spinner" />
          <div className="progress-text">
            {indexingProgress.total > 0 ? (
              <>
                <div className="progress-header">
                  Indexing messages: {indexingProgress.count} / {indexingProgress.total}
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(indexingProgress.count / indexingProgress.total) * 100}%` }}
                  />
                </div>
                {indexingProgress.currentMessage && (
                  <div className="current-message">
                    <div className="message-label">Currently indexing:</div>
                    <div className="message-content">
                      "{indexingProgress.currentMessage}"
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="preparing-text">
                  Preparing to index messages...
                </div>
                <FontAwesomeIcon icon={faSpinner} spin className="mini-spinner" />
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <>
          <div className="input-group">
            <label htmlFor="name" className="modal-label">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="modal-input"
            />
          </div>
          <div className="input-group">
            <label htmlFor="file" className="modal-label">Profile Picture</label>
            <input id="file" type="file" onChange={handleFileChange} className="modal-input" />
          </div>
          {photoURL && <img src={photoURL} alt="Avatar Preview" className="avatar-preview" />}
        </>
      )}
      {activeTab === 'ai-avatar' && (
        <div className="ai-settings">
          <div className="toggle-group">
            <label htmlFor="aiPersona" className="modal-label">
              Enable AI Persona
              <span className="feature-description">
                Allow an AI to respond to direct messages on your behalf, using your message history to mimic your style
              </span>
            </label>
            <label className="switch">
              <input
                id="aiPersona"
                type="checkbox"
                checked={aiPersonaEnabled}
                onChange={(e) => setAiPersonaEnabled(e.target.checked)}
                disabled={indexingProgress.isIndexing}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      )}
      <div className="modal-buttons">
        <button 
          onClick={handleSave} 
          className="save-button"
          disabled={isSaving || indexingProgress.isIndexing}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button 
          onClick={onClose} 
          className="cancel-button"
          disabled={isSaving || indexingProgress.isIndexing}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

const styles = `
.indexing-progress {
  margin: 15px 0;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  text-align: center;
}

.progress-header {
  font-weight: 600;
  margin-bottom: 10px;
  color: #2c3e50;
}

.progress-bar {
  margin: 15px 0;
  height: 4px;
  background-color: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #007bff;
  transition: width 0.3s ease;
}

.current-message {
  margin-top: 15px;
  padding: 15px;
  background-color: white;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  text-align: left;
}

.message-label {
  font-size: 0.9em;
  color: #6c757d;
  margin-bottom: 5px;
}

.message-content {
  color: #2c3e50;
  font-style: italic;
  word-break: break-word;
  line-height: 1.4;
  max-height: 60px;
  overflow-y: auto;
}

.preparing-text {
  color: #495057;
  margin-bottom: 10px;
}

.mini-spinner {
  font-size: 1em;
  color: #007bff;
}

.spinner {
  color: #007bff;
  margin-bottom: 15px;
  font-size: 1.5em;
}
`;

export default EditProfileModal; 