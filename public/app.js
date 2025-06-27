// Import Firebase SDKs (browser module CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, query, where, getDocs, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// Your Firebase config (corrected storageBucket)
const firebaseConfig = {
  apiKey: "AIzaSyBmIfx2oHpH4fxmkmrElhPr6jDpyTOtaUA",
  authDomain: "ola-chat-10477.firebaseapp.com",
  projectId: "ola-chat-10477",
  storageBucket: "ola-chat-10477.appspot.com",
  messagingSenderId: "770012786788",
  appId: "1:770012786788:web:b5836dda07fce307c92f71",
  measurementId: "G-MV641EK9BE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const googleSignInBtn = document.getElementById('google-signin');
const signOutBtn = document.getElementById('sign-out-btn');
const chatContainer = document.getElementById('chat-container');
const authContainer = document.getElementById('auth-container');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const recipientEmail = document.getElementById('recipient-email'); // make sure this input exists in your HTML

let currentUser = null;
let recipientUid = null;
let unsubscribeMessages = null;

// Google Sign-In
googleSignInBtn.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    await setDoc(doc(db, 'users', currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      lastSeen: serverTimestamp()
    }, { merge: true });
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
  } catch (error) {
    alert('Sign-in error: ' + error.message);
  }
});

// Sign Out
if (signOutBtn) {
  signOutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert('Sign-out error: ' + error.message);
    }
  });
}

// Set recipient by email
recipientEmail.addEventListener('change', async () => {
  const email = recipientEmail.value.trim();
  if (!email) return;
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      alert('No user found with that email');
      recipientUid = null;
      sendButton.disabled = true;
      messageInput.disabled = true;
      clearMessages();
      return;
    }
    const userDoc = querySnapshot.docs[0];
    recipientUid = userDoc.id;
    sendButton.disabled = false;
    messageInput.disabled = false;
    listenForMessages();
  } catch (error) {
    alert('Error finding recipient: ' + error.message);
  }
});

// Send message
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
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
    alert('Error sending message: ' + error.message);
  }
}

// Listen for new messages (unsubscribe previous listener if any)
function listenForMessages() {
  if (!currentUser || !recipientUid) return;
  if (unsubscribeMessages) unsubscribeMessages();
  const conversationId = [currentUser.uid, recipientUid].sort().join('_');
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp'));
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    clearMessages();
    snapshot.forEach((doc) => {
      const message = doc.data();
      const messageElement = document.createElement('div');
      messageElement.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
      messageElement.innerHTML = `
        <div class="message-content">
          <p>${message.text}</p>
          <span class="message-time">${message.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || ''}</span>
        </div>
      `;
      messagesDiv.appendChild(messageElement);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

function clearMessages() {
  messagesDiv.innerHTML = '';
}

// Auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    sendButton.disabled = !recipientUid;
    messageInput.disabled = !recipientUid;
  } else {
    currentUser = null;
    authContainer.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    sendButton.disabled = true;
    messageInput.disabled = true;
    clearMessages();
  }
});