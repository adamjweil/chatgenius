import React, { useState } from 'react';

const StatusModal = ({ isOpen, onClose, onSave, currentStatus }) => {
  const [status, setStatus] = useState(currentStatus || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(status);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
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
            <button type="button" className="cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save">
              Save Status
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default StatusModal; 