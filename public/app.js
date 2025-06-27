// Import the functions you need from the Firebase SDKs
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmIfx2oHpH4fxmkmrElhPr6jDpyTOtaUA",
  authDomain: "ola-chat-10477.firebaseapp.com",
  projectId: "ola-chat-10477",
  storageBucket: "ola-chat-10477.firebasestorage.app",
  messagingSenderId: "770012786788",
  appId: "1:770012786788:web:b5836dda07fce307c92f71",
  measurementId: "G-MV641EK9BE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const googleSignInBtn = document.getElementById('google-signin');
const chatContainer = document.getElementById('chat-container');
const authContainer = document.getElementById('auth-container');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const recipientEmail = document.getElementById('recipient-email');

let currentUser = null;
let recipientUid = null;

// Google Sign-In
googleSignInBtn.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    console.log('Logged in as:', currentUser.displayName);
    authContainer.classList.add('d-none');
    chatContainer.classList.remove('d-none');
    listenForMessages();
  } catch (error) {
    console.error('Error signing in:', error);
  }
});

// Set recipient
recipientEmail.addEventListener('change', async () => {
  const email = recipientEmail.value.trim();
  if (!email) return;
  
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      alert('No user found with that email');
      return;
    }
    
    querySnapshot.forEach((doc) => {
      recipientUid = doc.id;
      console.log('Recipient set to:', doc.data().displayName);
    });
  } catch (error) {
    console.error('Error finding recipient:', error);
  }
});

// Send message
sendButton.addEventListener('click', async () => {
  const messageText = messageInput.value.trim();
  if (!messageText || !recipientUid || !currentUser) return;
  
  try {
    const conversationId = [currentUser.uid, recipientUid].sort().join('_');
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    
    await addDoc(messagesRef, {
      text: messageText,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      timestamp: serverTimestamp()
    });
    
    messageInput.value = '';
  } catch (error) {
    console.error('Error sending message:', error);
  }
});

// Listen for new messages
function listenForMessages() {
  if (!currentUser || !recipientUid) return;
  
  const conversationId = [currentUser.uid, recipientUid].sort().join('_');
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp'));
  
  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = '';
    snapshot.forEach((doc) => {
      const message = doc.data();
      const messageElement = document.createElement('div');
      messageElement.className = `mb-2 ${message.senderId === currentUser.uid ? 'text-end' : 'text-start'}`;
      messageElement.innerHTML = `
        <strong>${message.senderName}:</strong> ${message.text}
        <div class="text-muted small">${message.timestamp?.toDate().toLocaleTimeString()}</div>
      `;
      messagesDiv.appendChild(messageElement);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// Auth state listener
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    authContainer.classList.add('d-none');
    chatContainer.classList.remove('d-none');
    
    // Store user data in Firestore
    const userRef = doc(db, 'users', user.uid);
    setDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    }, { merge: true });
    
    listenForMessages();
  } else {
    currentUser = null;
    authContainer.classList.remove('d-none');
    chatContainer.classList.add('d-none');
  }
});