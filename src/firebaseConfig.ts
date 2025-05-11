// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // Auth servisi için eklendi
import { getFirestore } from "firebase/firestore"; // Firestore servisi için eklendi

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyARfsJ-x4J-KEJz07Uh9WAp4oThHgBmzvk",
  authDomain: "tarabyamarte.firebaseapp.com",
  projectId: "tarabyamarte",
  storageBucket: "tarabyamarte.firebasestorage.app",
  messagingSenderId: "171027427019",
  appId: "1:171027427019:web:f151cf4f965ebf81a6754e",
  measurementId: "G-J4LLMP5PL1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app); // Auth servisi başlatıldı
const db = getFirestore(app); // Firestore servisi başlatıldı
const analytics = getAnalytics(app);

export { auth, db, analytics }; // auth ve db dışa aktarıldı