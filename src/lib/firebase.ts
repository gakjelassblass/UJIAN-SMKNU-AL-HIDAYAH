import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBDeAniTdzwAngNGEenNxjXh2XaNc3iLms",
  authDomain: "ujian-smknu.firebaseapp.com",
  projectId: "ujian-smknu",
  storageBucket: "ujian-smknu.firebasestorage.app",
  messagingSenderId: "986323149043",
  appId: "1:986323149043:web:fea7e4ca00067ee79d9786"
};

export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const auth = getAuth(app);
