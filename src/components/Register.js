import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { auth, firestore } from '../firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import '../App.css'; // Import the CSS file for styling

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Store additional user details in Firestore
      await setDoc(doc(firestore, 'users', user.uid), {
        name,
        email
      });

      // Redirect to the messaging screen
      navigate('/messaging');
    } catch (error) {
      console.error("Error registering: ", error);
    }
  };

  const handleSocialRegister = async (provider) => {
    try {
      console.log('Starting social registration...');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user already exists
      const userRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          joinedChannels: [],
          createdAt: new Date()
        });
      }

      navigate('/messaging');
    } catch (error) {
      console.error("Detailed error in social registration:", error);
      if (error.code) {
        console.error("Error code:", error.code);
      }
      alert(`Registration failed: ${error.message}`);
    }
  };

  const handleGoogleRegister = () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    handleSocialRegister(provider);
  };

  return (
    <div className="register-container">
      <h1>Create an Account</h1>
      <div className="social-login">
        <button onClick={handleGoogleRegister} className="social-button google">
          <FontAwesomeIcon icon={faGoogle} /> Sign up with Google
        </button>
      </div>
      <div className="divider">
        <span>or</span>
      </div>
      <form onSubmit={handleRegister} className="register-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">Register</button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
};

export default Register;
