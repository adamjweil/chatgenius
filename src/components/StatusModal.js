import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase.js';

const StatusModal = ({ isOpen, onClose, onSave, currentStatus, onClear, currentUser }) => {
  const [status, setStatus] = useState(currentStatus || '');

  useEffect(() => {
    setStatus(currentStatus || '');
  }, [currentStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(status);
    
    // Fetch updated user data after saving
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        // This will trigger a re-render in the Sidebar
        const userData = userDoc.data();
        onClose(userData); // Pass the updated data back to parent
      }
    } catch (error) {
      console.error('Error fetching updated user data:', error);
      onClose();
    }
  };

  const handleClear = async () => {
    await onClear();
    setStatus('');
    
    // Fetch updated user data after clearing
    try {
      const userRef = doc(firestore, 'users', currentUser.id);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        onClose(userData);
      }
    } catch (error) {
      console.error('Error fetching updated user data:', error);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={() => onClose()} />
      <div className="status-modal">
        <h2>Set Your Status</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="What's your current status?"
            autoFocus
          />
          <div className="status-modal-buttons">
            <button type="button" className="cancel" onClick={() => onClose()}>
              Cancel
            </button>
            <button type="submit" className="save">
              Save Status
            </button>
            <button type="button" className="clear" onClick={handleClear}>
              Clear Status
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default StatusModal; 