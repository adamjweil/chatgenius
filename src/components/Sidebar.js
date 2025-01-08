import React, { useState } from 'react';
import Channels from './Channels';
import DirectMessages from './DirectMessages';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { FiLogOut } from 'react-icons/fi';
import StatusModal from './StatusModal';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../firebase';

const Sidebar = ({ currentUser, selectedChannel, selectedUser, handleChannelSelect, handleUserSelect, handleLogout, status, setStatus }) => {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

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
        <strong>{currentUser.name}</strong>
        <div className="status">
          <span>{status || "Set your status"}</span>
          <button onClick={() => setIsStatusModalOpen(true)}>
            {status ? "Change Status" : "Set Status"}
          </button>
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
    </div>
  );
};

export default Sidebar;
