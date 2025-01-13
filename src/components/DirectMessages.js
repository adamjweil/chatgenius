import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase.js';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCommentDots, faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import '../App.css';

const DirectMessages = ({ currentUser, onUserSelect, selectedUser, clearChannel }) => {
  const [users, setUsers] = useState([]);
  const [messageUsers, setMessageUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [visibleStatus, setVisibleStatus] = useState({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userStats, setUserStats] = useState({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      
      setMessageUsers(prevMessageUsers => {
        return prevMessageUsers.map(prevUser => {
          const updatedUser = usersData.find(u => u.id === prevUser.id);
          return updatedUser || prevUser;
        });
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
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

    if (users.length > 0) {
      fetchMessageUsers();
    }
  }, [currentUser, users]);

  useEffect(() => {
    const fetchUserStats = async () => {
      const stats = {};
      for (const user of users) {
        if (user.id === currentUser.id) continue;
        
        try {
          const messageId = [currentUser.id, user.id].sort().join('_');
          const messagesQuery = query(
            collection(firestore, `directMessages/${messageId}/messages`)
          );
          const messagesSnapshot = await getDocs(messagesQuery);
          
          stats[user.id] = {
            messageCount: messagesSnapshot.size
          };
        } catch (error) {
          console.error(`Error fetching stats for user ${user.id}:`, error);
        }
      }
      setUserStats(stats);
    };

    if (users.length > 0) {
      fetchUserStats();
    }
  }, [users, currentUser.id]);

  useEffect(() => {
    const unsubscribers = [];

    messageUsers.forEach(user => {
      const messageId = [currentUser.id, user.id].sort().join('_');
      const q = query(
        collection(firestore, `directMessages/${messageId}/messages`),
        orderBy('createdAt')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const unreadCount = snapshot.docs.filter(doc => {
          const data = doc.data();
          return !data.readBy?.includes(currentUser.id);
        }).length;
        
        setUnreadCounts(prev => ({
          ...prev,
          [user.id]: unreadCount
        }));
      });

      unsubscribers.push(unsubscribe);
    });

    // Cleanup listeners on unmount or when messageUsers changes
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [messageUsers, currentUser.id]);

  const calculateUnreadCounts = async (messageUsersData) => {
    const counts = {};
    for (const user of messageUsersData) {
      const messageId = [currentUser.id, user.id].sort().join('_');
      const q = query(
        collection(firestore, `directMessages/${messageId}/messages`),
        orderBy('createdAt')
      );
      const snapshot = await getDocs(q);
      const unreadCount = snapshot.docs.filter(doc => !doc.data().readBy?.includes(currentUser.id)).length;
      counts[user.id] = unreadCount;
    }
    setUnreadCounts(counts);
  };

  const startNewMessage = async (user) => {
    const messageId = [currentUser.id, user.id].sort().join('_');
    await setDoc(doc(firestore, `directMessages/${messageId}`), { createdAt: new Date() });
    setMessageUsers([...messageUsers, user]);
  };

  const toggleStatusVisibility = (userId) => {
    setVisibleStatus(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleUserSelect = (user) => {
    if (typeof clearChannel === 'function') {
      clearChannel();
    }
    onUserSelect(user);
  };

  return (
    <div>
      <div className="direct-messages-header">
        <h2>
          <FontAwesomeIcon
            icon={isCollapsed ? faCaretRight : faCaretDown}
            onClick={toggleCollapse}
            className="toggle-icon"
          />
          Direct Messages
        </h2>
        <FontAwesomeIcon 
          icon={faPlus} 
          onClick={() => setModalIsOpen(true)} 
          className="plus-icon" 
          style={{ fontSize: '1.2rem' }} 
        />
      </div>
      {!isCollapsed && (
        <ul>
          {messageUsers.map(user => (
            <li
              key={user.id}
              onClick={() => handleUserSelect(user)}
              className={`${selectedUser && selectedUser.id === user.id ? 'selected' : ''}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div className="user-info-container">
                <span className="user-name">{user.name}</span>
                {user.status && <span className="user-status">[{user.status}]</span>}
              </div>
              {unreadCounts[user.id] > 0 && (
                <span className="unread-indicator">{unreadCounts[user.id]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Start New Direct Message"
        className="channels-modal"
        overlayClassName="modal-overlay"
      >
        <div className="channels-modal-content">
          <h2>Start a New Conversation</h2>
          
          <div className="channels-list">
            {users
              .filter(user => user.id !== currentUser.id)
              .map(user => (
                <div key={user.id} className="channel-item">
                  <div className="channel-info">
                    <span className="channel-name">{user.name}</span>
                    <div className="channel-stats">
                      {userStats[user.id] && (
                        <span>{userStats[user.id].messageCount} messages in conversation</span>
                      )}
                      {user.status && (
                        <>
                          <span>•</span>
                          <span>Status: {user.status}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {messageUsers.some(u => u.id === user.id) ? (
                    <button 
                      onClick={() => {
                        handleUserSelect(user);
                        setModalIsOpen(false);
                      }}
                      className="join-button"
                    >
                      Message
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        startNewMessage(user);
                        setModalIsOpen(false);
                      }}
                      className="join-button"
                    >
                      Start Chat
                    </button>
                  )}
                </div>
              ))}
          </div>

          <div className="modal-buttons">
            <button onClick={() => setModalIsOpen(false)} className="cancel">
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DirectMessages; 