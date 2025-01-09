import React, { useState } from 'react';
import Channels from './Channels';
import DirectMessages from './DirectMessages';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { FiLogOut, FiEdit, FiEdit2 } from 'react-icons/fi';
import StatusModal from './StatusModal';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import EditProfileModal from './EditProfileModal';

const Sidebar = ({ currentUser, selectedChannel, selectedUser, handleChannelSelect, handleUserSelect, handleLogout, status, setStatus }) => {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  const handleStatusSave = async (newStatus) => {
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      await updateDoc(userRef, { status: newStatus });
      setStatus(newStatus); // Update the status in parent component
      setIsStatusModalOpen(false);
    } catch (error) {
      console.error('Error updating status:', error);
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
          src={currentUser.photoURL}
          alt="Avatar"
          className="avatar"
          onError={(e) => {
            e.target.onerror = null; // Prevents looping
            e.target.src = 'default-avatar-url'; // Fallback image
          }}
        />
        <div className="name-status">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <strong>{currentUser.name}</strong>
            <FiEdit onClick={() => setIsEditProfileModalOpen(true)} style={{ cursor: 'pointer', marginLeft: '5px' }} />
          </div>
          <div className="status-row">
            {status ? (
              <>
                <span>{status}</span>
                <FiEdit2 onClick={() => setIsStatusModalOpen(true)} style={{ cursor: 'pointer' }} />
              </>
            ) : (
              <button onClick={() => setIsStatusModalOpen(true)} className="set-status-button">
                Set Status
              </button>
            )}
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
        currentStatus={status}
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
