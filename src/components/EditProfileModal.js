import React, { useState } from 'react';
import Modal from 'react-modal';
import { updateDoc, doc } from 'firebase/firestore';
import { firestore } from '../firebase';

const EditProfileModal = ({ isOpen, onClose, currentUser }) => {
  const [name, setName] = useState(currentUser.name);
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL);

  const handleSave = async () => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { name, photoURL });

      currentUser.name = name;
      currentUser.photoURL = photoURL;

      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result);
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
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full Name"
        className="modal-input"
      />
      <input type="file" onChange={handleFileChange} className="modal-input" />
      {photoURL && <img src={photoURL} alt="Avatar Preview" className="avatar-preview" />}
      <div className="modal-buttons">
        <button onClick={handleSave} className="save-button">Save</button>
        <button onClick={onClose} className="cancel-button">Cancel</button>
      </div>
    </Modal>
  );
};

export default EditProfileModal; 