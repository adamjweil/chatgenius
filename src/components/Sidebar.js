import React, { useState, useEffect } from 'react';
import Channels from './Channels';
import DirectMessages from './DirectMessages';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { FiLogOut, FiEdit, FiEdit2 } from 'react-icons/fi';
import StatusModal from './StatusModal';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import EditProfileModal from './EditProfileModal';

const Sidebar = ({ currentUser, selectedChannel, selectedUser, handleChannelSelect, handleUserSelect, handleLogout, status, setStatus }) => {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [userData, setUserData] = useState({ status: '', photoURL: '' });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userRef = doc(firestore, 'users', currentUser.id);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [currentUser.id]);

  const handleStatusSave = async (newStatus) => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { status: newStatus });
      setUserData(prevData => ({ ...prevData, status: newStatus }));
      setIsStatusModalOpen(false);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleClearStatus = async () => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { status: '' });
      setUserData(prevData => ({ ...prevData, status: '' }));
    } catch (error) {
      console.error('Error clearing status:', error);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        <Channels
          currentUser={currentUser}
          onChannelSelect={handleChannelSelect}
          selectedChannel={selectedChannel}
        />
        <DirectMessages
          currentUser={currentUser}
          onUserSelect={handleUserSelect}
          selectedUser={selectedUser}
        />
      </div>
      <div className="user-info">
        <img
          src={userData.photoURL || 'default-avatar-url'}
          alt="Avatar"
          className="avatar"
          onError={(e) => {
            e.target.onerror = null; // Prevents looping
            e.target.src = 'default-avatar-url'; // Fallback image
          }}
        />
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
      />

      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
};

export default Sidebar;
