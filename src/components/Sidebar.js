import React from 'react';
import Channels from './Channels';
import DirectMessages from './DirectMessages';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Sidebar = ({ currentUser, selectedChannel, selectedUser, handleChannelSelect, handleUserSelect, handleLogout, status, setStatusModalOpen }) => {
  return (
    <div className="sidebar">
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
      <div className="user-info">
        <strong>{currentUser.name}</strong>
        <div className="status">
          <span>{status || "Set your status"}</span>
          <button onClick={() => setStatusModalOpen(true)}>
            {status ? "Change Status" : "Set Status"}
          </button>
        </div>
      </div>
      <button onClick={handleLogout} className="logout-button">Logout</button>
    </div>
  );
};

export default Sidebar;
