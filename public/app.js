// Firebase v9 modular (browser CDN imports)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, query, where, getDocs, onSnapshot, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyBmIfx2oHpH4fxmkmrElhPr6jDpyTOtaUA",
  authDomain: "ola-chat-10477.firebaseapp.com",
  projectId: "ola-chat-10477",
  storageBucket: "ola-chat-10477.appspot.com",
  messagingSenderId: "770012786788",
  appId: "1:770012786788:web:b5836dda07fce307c92f71",
  measurementId: "G-MV641EK9BE"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
const googleSignInBtn = document.getElementById('google-signin');
const signOutBtn = document.getElementById('sign-out-btn');
const chatContainer = document.getElementById('chat-container');
const authContainer = document.getElementById('auth-container');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');
const recipientName = document.getElementById('recipient-name');
const recipientAvatar = document.getElementById('recipient-avatar');
const contactsList = document.querySelector('.contacts-list');
const searchContacts = document.getElementById('search-contacts');
const chatLoading = document.getElementById('chat-loading');
const recipientStatus = document.getElementById('recipient-status');

let currentUser = null;
let recipient = null;
let contacts = [];
let unsubscribeMessages = null;

// --- Google Sign-In ---
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
    // contacts will be loaded by auth listener
  } catch (error) {
    alert('Sign-in error: ' + error.message);
  }
});

// --- Sign Out ---
signOutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    alert('Sign-out error: ' + error.message);
  }
});

// --- Load Contacts ---
async function loadContacts() {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '!=', currentUser.uid));
    const querySnapshot = await getDocs(q);

    contacts = [];
    contactsList.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
      const contact = docSnap.data();
      contacts.push(contact);
      const contactElement = document.createElement('div');
      contactElement.className = 'contact';
      contactElement.innerHTML = `
        <img src="${contact.photoURL || `https://ui-avatars.com/api/?name=${contact.displayName}&background=random`}" alt="${contact.displayName}">
        <div class="contact-info">
          <h4>${contact.displayName}</h4>
          <p class="status">Last seen: ${contact.lastSeen ? new Date(contact.lastSeen.seconds * 1000).toLocaleString() : "recently"}</p>
        </div>
      `;
      contactElement.addEventListener('click', () => selectContact(contact));
      contactsList.appendChild(contactElement);
    });
  } catch (error) {
    contactsList.innerHTML = '<div style="color:red;">Failed to load contacts.</div>';
  }
}

// --- Search Contacts ---
searchContacts.addEventListener('input', () => {
  const val = searchContacts.value.toLowerCase();
  document.querySelectorAll('.contact').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(val) ? '' : 'none';
  });
});

// --- Select Contact ---
function selectContact(contact) {
  recipient = contact;
  recipientName.textContent = contact.displayName;
  recipientAvatar.src = contact.photoURL || `https://ui-avatars.com/api/?name=${contact.displayName}&background=random`;
  recipientStatus.textContent = contact.lastSeen ? `Last seen: ${new Date(contact.lastSeen.seconds * 1000).toLocaleString()}` : "recently";
  messageInput.disabled = false;
  sendButton.disabled = false;
  // highlight selected contact
  document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
  Array.from(contactsList.children).find(el => el.textContent.includes(contact.displayName))?.classList.add('active');
  // load chat
  listenForMessages();
}

// --- Send Message ---
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const messageText = messageInput.value.trim();
  if (!messageText || !recipient || !currentUser) return;
  try {
    const conversationId = [currentUser.uid, recipient.uid].sort().join('_');
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

// --- Listen for new messages ---
function listenForMessages() {
  if (!currentUser || !recipient) return;
  if (unsubscribeMessages) unsubscribeMessages();
  messagesDiv.innerHTML = '';
  chatLoading.classList.remove('hidden');
  const conversationId = [currentUser.uid, recipient.uid].sort().join('_');
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp'));
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    chatLoading.classList.add('hidden');
    messagesDiv.innerHTML = '';
    if (snapshot.empty) {
      messagesDiv.innerHTML = `<div class="empty-state"><i class="fas fa-comments"></i><p>No messages yet</p></div>`;
    }
    snapshot.forEach((doc) => {
      const message = doc.data();
      const messageElement = document.createElement('div');
      messageElement.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
      messageElement.innerHTML = `
        <div class="message-content">${message.text}</div>
        <span class="message-time">${message.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || ''}</span>
      `;
      messagesDiv.appendChild(messageElement);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// --- Auth State Listener ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    userName.textContent = user.displayName;
    userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`;
    messageInput.disabled = true;
    sendButton.disabled = true;
    loadContacts();
  } else {
    currentUser = null;
    authContainer.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    messagesDiv.innerHTML = `<div class="empty-state"><i class="fas fa-comments"></i><p>Select a contact to start chatting</p></div>`;
    if (unsubscribeMessages) unsubscribeMessages();
  }
});