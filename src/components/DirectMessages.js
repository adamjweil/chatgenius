import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tooltip';

const DirectMessages = ({ currentUser, onUserSelect, selectedUser }) => {
  const [users, setUsers] = useState([]);
  const [messageUsers, setMessageUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [visibleStatus, setVisibleStatus] = useState({});

  useEffect(() => {
    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(firestore, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    };

    const fetchMessageUsers = async () => {
      const messageUsersSnapshot = await getDocs(collection(firestore, `directMessages`));
      const messageUsersData = messageUsersSnapshot.docs
        .filter(doc => doc.id.includes(currentUser.id))
        .map(doc => {
          const userId = doc.id.split('_').find(id => id !== currentUser.id);
          return users.find(user => user.id === userId);
        })
        .filter(Boolean);

      setMessageUsers(messageUsersData);
      calculateUnreadCounts(messageUsersData);
    };

    fetchUsers();
    fetchMessageUsers();
  }, [currentUser, users]);

//   useEffect(() => {
//     console.log('Message Users:', messageUsers);
//   }, [messageUsers]);

  const calculateUnreadCounts = async (messageUsersData) => {
    const counts = {};
    for (const user of messageUsersData) {
      const messageId = [currentUser.id, user.id].sort().join('_');
      const q = query(
        collection(firestore, `directMessages/${messageId}/messages`),
        orderBy('createdAt')
      );
      const snapshot = await getDocs(q);
      const unreadCount = snapshot.docs.filter(doc => !doc.data().readBy.includes(currentUser.id)).length;
      counts[user.id] = unreadCount;
    }
    setUnreadCounts(counts);
  };

  const startNewMessage = async (user) => {
    const messageId = [currentUser.id, user.id].sort().join('_');
    await setDoc(doc(firestore, `directMessages/${messageId}`), { createdAt: new Date() });
    setMessageUsers([...messageUsers, user]);
    setModalIsOpen(false);
  };

  const toggleStatusVisibility = (userId) => {
    setVisibleStatus(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  return (
    <div>
      <div className="direct-messages-header">
        <h2 className="direct-messages-title">Direct Messages</h2>
        <FontAwesomeIcon icon={faPlus} onClick={() => setModalIsOpen(true)} className="plus-icon" />
      </div>
      <ul>
        {messageUsers.map(user => (
          <li
            key={user.id}
            onClick={() => onUserSelect(user)}
            className={`${selectedUser && selectedUser.id === user.id ? 'selected' : ''}`}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>{user.name}</span>
            {user.status && (
              <>
                {!visibleStatus[user.id] ? (
                  <FontAwesomeIcon
                    icon={faCommentDots}
                    onClick={() => toggleStatusVisibility(user.id)}
                    className="status-indicator"
                    style={{ marginLeft: '8px', color: 'blue', cursor: 'pointer' }}
                  />
                ) : (
                  <span
                    className="status-text"
                    onClick={() => toggleStatusVisibility(user.id)}
                    style={{ marginLeft: '8px', cursor: 'pointer' }}
                  >
                    {user.status}
                  </span>
                )}
              </>
            )}
            {unreadCounts[user.id] > 0 && (
              <span className="unread-indicator">{unreadCounts[user.id]}</span>
            )}
          </li>
        ))}
      </ul>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Start New Direct Message"
        className="modal"
        overlayClassName="overlay"
      >
        <h2>Start a New Direct Message</h2>
        <ul>
          {users.map(user => (
            <li key={user.id}>
              {user.name}
              <button onClick={() => startNewMessage(user)}>Message</button>
            </li>
          ))}
        </ul>
        <button onClick={() => setModalIsOpen(false)}>Close</button>
      </Modal>
    </div>
  );
};

export default DirectMessages; 