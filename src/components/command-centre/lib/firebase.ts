/**
 * Firebase init for the Command Centre.
 *
 * The web app config below is public-safe — anyone can see it in the bundle.
 * Real security comes from Firebase Auth + Firestore rules locked to the
 * single allowed UID.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyABKgqY0rvtgO7e5Tqb4Amy9XeUUdRswNs',
  authDomain: 'parkertechfire.firebaseapp.com',
  projectId: 'parkertechfire',
  storageBucket: 'parkertechfire.firebasestorage.app',
  messagingSenderId: '1062459084325',
  appId: '1:1062459084325:web:7b1aaa9692a14e6c8ff9cc',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/** The single UID allowed to use this app. */
export const ALLOWED_UID = 'vLqAisb7mAd93ZSF6Lq0IaS32hy2';
