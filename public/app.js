import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// Firebase configuration
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
const elements = {
  googleSignInBtn: document.getElementById('google-signin'),
  signOutBtn: document.getElementById('sign-out-btn'),
  chatContainer: document.getElementById('chat-container'),
  authContainer: document.getElementById('auth-container'),
  messagesDiv: document.getElementById('messages'),
  messageInput: document.getElementById('message-input'),
  sendButton: document.getElementById('send-button'),
  userName: document.getElementById('user-name'),
  userAvatar: document.getElementById('user-avatar'),
  recipientName: document.getElementById('recipient-name'),
  recipientAvatar: document.getElementById('recipient-avatar'),
  recipientStatus: document.getElementById('recipient-status'),
  contactsList: document.querySelector('.contacts-list'),
  searchContacts: document.getElementById('search-contacts'),
  themeCheckbox: document.getElementById('theme-checkbox'),
  body: document.body,
  callBtn: document.getElementById('call-btn'),
  videoCallBtn: document.getElementById('video-call-btn'),
  attachBtn: document.getElementById('attach-btn')
};

// App state
let currentUser = null;
let recipientUid = null;
let contacts = [];
let unsubscribeMessages = null;

/* ===== Theme Management ===== */
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    enableDarkMode();
  }
}

function enableDarkMode() {
  elements.body.classList.add('dark-mode');
  elements.themeCheckbox.checked = true;
  localStorage.setItem('theme', 'dark');
}

function disableDarkMode() {
  elements.body.classList.remove('dark-mode');
  elements.themeCheckbox.checked = false;
  localStorage.setItem('theme', 'light');
}

/* ===== UI Functions ===== */
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function formatTimestamp(timestamp) {
  try {
    const date = timestamp?.toDate?.() || new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Just now';
  }
}

function scrollToBottom() {
  elements.messagesDiv.scrollTo({
    top: elements.messagesDiv.scrollHeight,
    behavior: 'smooth'
  });
}

/* ===== Authentication ===== */
async function handleGoogleSignIn() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    
    // Store user data in Firestore
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=6C63FF`,
      lastSeen: serverTimestamp(),
      status: 'online'
    }, { merge: true });
    
    updateUserUI();
    loadContacts();
    showNotification('Successfully signed in!');
  } catch (error) {
    console.error('Sign-in error:', error);
    showNotification('Failed to sign in. Please try again.', 'error');
  }
}

async function handleSignOut() {
  try {
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        status: 'offline',
        lastSeen: serverTimestamp()
      });
    }
    await signOut(auth);
    showNotification('Successfully signed out');
  } catch (error) {
    console.error('Sign-out error:', error);
    showNotification('Failed to sign out. Please try again.', 'error');
  }
}

function updateUserUI() {
  if (currentUser) {
    elements.userName.textContent = currentUser.displayName;
    elements.userAvatar.src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=6C63FF`;
    elements.authContainer.classList.add('hidden');
    elements.chatContainer.classList.remove('hidden');
  } else {
    elements.authContainer.classList.remove('hidden');
    elements.chatContainer.classList.add('hidden');
  }
}

/* ===== Contacts and Messaging ===== */
async function loadContacts() {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '!=', currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    contacts = [];
    elements.contactsList.innerHTML = '';
    
    if (querySnapshot.empty) {
      elements.contactsList.innerHTML = `
        <div class="empty-contacts">
          <i class="fas fa-user-plus"></i>
          <p>No contacts found</p>
          <small>Invite friends to join!</small>
        </div>
      `;
      return;
    }
    
    querySnapshot.forEach((doc, index) => {
      const contact = doc.data();
      contacts.push(contact);
      
      const contactElement = document.createElement('div');
      contactElement.className = 'contact';
      contactElement.style.animationDelay = `${index * 50}ms`;
      contactElement.innerHTML = `
        <div class="avatar-container">
          <img src="${contact.photoURL}" alt="${contact.displayName}" class="avatar">
          <span class="status-indicator ${contact.status === 'online' ? 'online' : 'offline'}"></span>
        </div>
        <div class="contact-info">
          <h4>${contact.displayName}</h4>
          <p class="status-text">
            ${contact.status === 'online' ? 'Online' : 'Last seen recently'}
          </p>
        </div>
        <i class="fas fa-chevron-right contact-arrow"></i>
      `;
      
      contactElement.addEventListener('click', () => {
        selectContact(contact);
      });
      
      elements.contactsList.appendChild(contactElement);
    });
  } catch (error) {
    console.error('Load contacts error:', error);
    showNotification('Failed to load contacts', 'error');
  }
}

function selectContact(contact) {
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }
  
  recipientUid = contact.uid;
  elements.recipientName.textContent = contact.displayName;
  elements.recipientAvatar.src = contact.photoURL;
  elements.recipientStatus.textContent = contact.status === 'online' ? 'Online' : 'Offline';
  elements.recipientStatus.className = `status-text ${contact.status === 'online' ? 'online' : 'offline'}`;
  
  elements.messageInput.disabled = false;
  elements.sendButton.disabled = false;
  elements.callBtn.disabled = false;
  elements.videoCallBtn.disabled = false;
  
  elements.messagesDiv.innerHTML = '';
  listenForMessages();
}

function listenForMessages() {
  if (!currentUser || !recipientUid) return;
  
  const conversationId = [currentUser.uid, recipientUid].sort().join('_');
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp'));
  
  unsubscribeMessages = onSnapshot(q, 
    (snapshot) => {
      elements.messagesDiv.innerHTML = '';
      snapshot.forEach((doc) => {
        const message = doc.data();
        displayMessage(message);
      });
      scrollToBottom();
    },
    (error) => {
      console.error('Message listener error:', error);
      showNotification('Connection error - reconnecting...', 'error');
      setTimeout(listenForMessages, 3000);
    }
  );
}

function displayMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
  
  messageElement.innerHTML = `
    ${message.senderId !== currentUser.uid ? `
      <div class="message-avatar">
        <img src="${elements.recipientAvatar.src}" alt="Avatar" class="avatar">
      </div>
    ` : ''}
    <div class="message-content">
      <div class="message-bubble">
        <p>${message.text}</p>
        <span class="message-time">
          ${formatTimestamp(message.timestamp)}
          ${message.senderId === currentUser.uid ? '<i class="fas fa-check-double status-icon"></i>' : ''}
        </span>
      </div>
    </div>
  `;
  
  elements.messagesDiv.appendChild(messageElement);
}

async function sendMessage() {
  const messageText = elements.messageInput.value.trim();
  if (!messageText || !recipientUid || !currentUser) return;

  try {
    const conversationId = [currentUser.uid, recipientUid].sort().join('_');
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      text: messageText,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      timestamp: serverTimestamp()
    });
    elements.messageInput.value = '';
  } catch (error) {
    console.error('Send error:', error);
    showNotification('Failed to send message', 'error');
  }
}

/* ===== Event Listeners ===== */
function setupEventListeners() {
  // Theme toggle
  elements.themeCheckbox.addEventListener('change', () => {
    if (elements.themeCheckbox.checked) {
      enableDarkMode();
    } else {
      disableDarkMode();
    }
  });

  // Auth
  elements.googleSignInBtn.addEventListener('click', handleGoogleSignIn);
  elements.signOutBtn.addEventListener('click', handleSignOut);

  // Messaging
  elements.sendButton.addEventListener('click', sendMessage);
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Search
  elements.searchContacts.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const contactElements = document.querySelectorAll('.contact');
    
    contactElements.forEach(contact => {
      const name = contact.querySelector('h4').textContent.toLowerCase();
      contact.style.display = name.includes(searchTerm) ? 'flex' : 'none';
    });
  });

  // Placeholder buttons
  elements.callBtn.addEventListener('click', () => {
    showNotification('Call functionality coming soon!');
  });
  elements.videoCallBtn.addEventListener('click', () => {
    showNotification('Video call functionality coming soon!');
  });
  elements.attachBtn.addEventListener('click', () => {
    showNotification('File attachment coming soon!');
  });
}

/* ===== Initialize App ===== */
function initApp() {
  setupEventListeners();
  initTheme();
  
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      updateUserUI();
      loadContacts();
    } else {
      currentUser = null;
      updateUserUI();
    }
  });
}

// Start the app
initApp();