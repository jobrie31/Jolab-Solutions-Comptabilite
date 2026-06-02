import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCQ91hqjTeWLFLVJTh4J4Ncm5Cg7_4x3Ps",
  authDomain: "test-36f40.firebaseapp.com",
  projectId: "test-36f40",
  storageBucket: "test-36f40.firebasestorage.app",
  messagingSenderId: "1049642913690",
  appId: "1:1049642913690:web:7100b90c1891dda4ebb423",
  measurementId: "G-3KK6825BM7",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export async function getFirebaseMessaging() {
  const supported = await isSupported();

  if (!supported) {
    return null;
  }

  return getMessaging(app);
}