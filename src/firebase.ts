import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  "projectId": "googly-time-38gvj",
  "appId": "1:1053638610932:web:3ae63a1df30383c45ef3a1",
  "apiKey": "AIzaSyDGjcFjlEvyGy1NvoLpKCIo-ykMS9XC__o",
  "authDomain": "googly-time-38gvj.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-c082f3bc-f0ab-44b3-aad7-9fa36baac7d2",
  "storageBucket": "googly-time-38gvj.firebasestorage.app",
  "messagingSenderId": "1053638610932",
  "measurementId": ""
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth(app);