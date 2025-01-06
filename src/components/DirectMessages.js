import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { firestore } from '../firebase';

const DirectMessages = ({ currentUser, onUserSelect }) => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(firestore, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    };

    fetchUsers();
  }, []);

  return (
    <div>
      <h2>Direct Messages</h2>
      <ul>
        {users.map(user => (
          <li key={user.id} onClick={() => onUserSelect(user)}>
            {user.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DirectMessages; 