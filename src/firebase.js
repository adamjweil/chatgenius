import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDxN3a30copgpEti_JLrmMVKaM4PgMakwc",
    authDomain: "chatgenius-772f3.firebaseapp.com",
    projectId: "chatgenius-772f3",
    storageBucket: "chatgenius-772f3.firebasestorage.app",
    messagingSenderId: "201859381277",
    appId: "1:201859381277:web:23e999ed21a0b38918aef4",
    measurementId: "G-EZ4EX6LRR5"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);