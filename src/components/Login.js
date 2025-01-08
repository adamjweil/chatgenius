import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { auth, firestore } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import '../App.css'; // Import the CSS file for styling

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // Use the useNavigate hook

  const handleSocialLogin = async (provider) => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Create new user document if it doesn't exist
        await setDoc(doc(firestore, 'users', user.uid), {
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        });
      }
      
      navigate('/');
    } catch (error) {
      console.error("Error with social login: ", error);
      alert("Login failed. Please try again.");
    }
  };

  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    handleSocialLogin(provider);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/')
      // Redirect to the main app
    } catch (error) {
      console.error("Error logging in: ", error);
      alert("Login failed. Please check your credentials.");
    }
  };

  return (
    <div className="login-container">
      <h1>Sign in to ChatGenius</h1>
      <div className="social-login">
        <button onClick={handleGoogleLogin} className="social-button google">
          <FontAwesomeIcon icon={faGoogle} /> Sign in with Google
        </button>
      </div>
      <div className="divider">
        <span>or</span>
      </div>
      <form onSubmit={handleLogin} className="login-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@work-email.com"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">Sign In</button>
      </form>
      <p>
        New to ChatGenius? <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
};

export default Login;