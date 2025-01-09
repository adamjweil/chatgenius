import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { updateDoc, doc } from 'firebase/firestore';
import { firestore } from '../firebase';

const EditProfileModal = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
    }
  }, [currentUser]);

  const handleSave = async () => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { name, photoURL });

      currentUser.name = name;
      currentUser.photoURL = photoURL;

      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
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
        <div>
          <p>AI Avatar settings will go here.</p>
        </div>
      )}
      <div className="modal-buttons">
        <button onClick={handleSave} className="save-button">Save</button>
        <button onClick={onClose} className="cancel-button">Cancel</button>
      </div>
    </Modal>
  );
};

export default EditProfileModal; 