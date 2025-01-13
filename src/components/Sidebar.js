import React, { useState, useEffect } from 'react';
import Channels from './Channels.js';
import DirectMessages from './DirectMessages.js';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { FiLogOut, FiEdit, FiEdit2 } from 'react-icons/fi';
import StatusModal from './StatusModal.js';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import EditProfileModal from './EditProfileModal.js';

const Sidebar = ({ currentUser, selectedChannel, selectedUser, handleChannelSelect, handleUserSelect, handleLogout, status, setStatus }) => {
  console.log('Sidebar - handleChannelSelect type:', typeof handleChannelSelect);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [userData, setUserData] = useState({ status: '', photoURL: '' });
  const [avatarError, setAvatarError] = useState(false);

  const fetchUserData = async () => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        setUserData(userDoc.data());
        setAvatarError(false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [currentUser.id]);

  const handleStatusSave = async (newStatus) => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { status: newStatus });
      await fetchUserData(); // Refresh user data
      setIsStatusModalOpen(false);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleClearStatus = async () => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { status: '' });
      await fetchUserData(); // Refresh user data
    } catch (error) {
      console.error('Error clearing status:', error);
    }
  };

  const handleAvatarError = () => {
    setAvatarError(true);
  };

  const handleEditProfileClose = async (updated = false) => {
    if (updated) {
      await fetchUserData(); // Refresh user data if profile was updated
    }
    setIsEditProfileModalOpen(false);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        <Channels
          currentUser={currentUser}
          onChannelSelect={handleChannelSelect}
          selectedChannel={selectedChannel}
          handleUserSelect={handleUserSelect}
          clearDirectMessage={() => handleUserSelect(null)}
        />
        <DirectMessages
          currentUser={currentUser}
          onUserSelect={handleUserSelect}
          selectedUser={selectedUser}
        />
      </div>
      <div className="user-info">
        {!avatarError ? (
          <img
            src={userData.photoURL || 'default-avatar-url'}
            alt="Avatar"
            className="avatar"
            onError={handleAvatarError}
            key={userData.photoURL} // Add key to force re-render when URL changes
          />
        ) : (
          <img
            src="default-avatar-url"
            alt="Default Avatar"
            className="avatar"
          />
        )}
        <div className="name-status">
          <div className="name-row">
            <strong>{currentUser.name}</strong>
            <FiEdit
              className="edit-icon"
              onClick={() => setIsEditProfileModalOpen(true)}
            />
          </div>
          <div className="status-row">
            <span className="status-text">{userData.status}</span>
            <FiEdit2
              className="edit-icon"
              onClick={() => setIsStatusModalOpen(true)}
            />
          </div>
        </div>
      </div>
      <button onClick={handleLogout} className="logout-button">
        <FiLogOut color="white" size={16} />
        Logout
      </button>

      <StatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onSave={handleStatusSave}
        currentStatus={userData.status}
        onClear={handleClearStatus}
        currentUser={currentUser}
      />

      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={handleEditProfileClose}
        currentUser={currentUser}
        onProfileUpdate={fetchUserData}
      />
    </div>
  );
};

export default Sidebar;
