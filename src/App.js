import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';
import Login from './components/Login.js';
import Register from './components/Register.js';
import Messaging from './components/Messaging.js';
import { startMessageIndexing } from './services/messageIndexingService.js';
import { initPinecone } from './services/vectorService.js';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        setCurrentUser({ id: user.uid, name: user.displayName });
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const initServices = async () => {
      try {
        console.log('Initializing Pinecone...');
        await initPinecone();
        console.log('Pinecone initialized successfully');
        startMessageIndexing();
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    initServices();
  }, []);

  const handleChannelSelect = (channel) => {
    console.log('App - handleChannelSelect called with:', channel);
    setSelectedChannel(channel);
    setSelectedUser(null);
  };

  const handleUserSelect = (user) => {
    console.log('App - handleUserSelect called with:', user);
    setSelectedUser(user);
    setSelectedChannel(null);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setSelectedChannel(null);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/messaging" /> : <Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/messaging" 
          element={
            isAuthenticated ? (
              <Messaging 
                currentUser={currentUser}
                selectedChannel={selectedChannel}
                selectedUser={selectedUser}
                handleChannelSelect={handleChannelSelect}
                handleUserSelect={handleUserSelect}
                handleLogout={handleLogout}
              />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
      </Routes>
    </Router>
  );
};

export default App;
