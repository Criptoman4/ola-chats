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
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// Modern color palette
const colors = {
  primary: '#6C63FF',
  secondary: '#4D44DB',
  accent: '#FF6584',
  success: '#4CC9F0',
  warning: '#F8961E',
  darkBg: '#1A1A2E',
  lightBg: '#F8F9FA',
  textDark: '#2B2D42',
  textLight: '#F8F9FA'
};

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

/* ===== UI Enhancements ===== */
function applyRippleEffect(element) {
  element.addEventListener('click', function(e) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size/2;
    const y = e.clientY - rect.top - size/2;
    
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    element.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  });
}

function animateElement(element, animation, duration = 300) {
  element.style.animation = `${animation} ${duration}ms ease-out`;
  setTimeout(() => element.style.animation = '', duration);
}

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
  document.documentElement.style.setProperty('--primary-color', colors.secondary);
  document.documentElement.style.setProperty('--accent-color', '#FF8E9E');
}

function disableDarkMode() {
  elements.body.classList.remove('dark-mode');
  elements.themeCheckbox.checked = false;
  localStorage.setItem('theme', 'light');
  document.documentElement.style.setProperty('--primary-color', colors.primary);
  document.documentElement.style.setProperty('--accent-color', colors.accent);
}

// Initialize theme and set CSS variables
initTheme();
document.documentElement.style.setProperty('--primary-color', colors.primary);
document.documentElement.style.setProperty('--secondary-color', colors.secondary);
document.documentElement.style.setProperty('--accent-color', colors.accent);

/* ===== Authentication ===== */
async function handleGoogleSignIn() {
  animateElement(elements.googleSignInBtn, 'pulse');
  
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    
    // Store user data
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=${colors.primary.replace('#', '')}`,
      lastSeen: serverTimestamp(),
      status: 'online'
    }, { merge: true });
    
    updateUserUI();
    loadContacts();
    animateElement(elements.chatContainer, 'fadeIn');
  } catch (error) {
    console.error('Sign-in error:', error);
    showError('Failed to sign in. Please try again.', 'error');
  }
}

async function handleSignOut() {
  animateElement(elements.signOutBtn, 'pulse');
  
  try {
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        status: 'offline',
        lastSeen: serverTimestamp()
      });
    }
    await signOut(auth);
    animateElement(elements.authContainer, 'fadeIn');
  } catch (error) {
    console.error('Sign-out error:', error);
    showError('Failed to sign out. Please try again.', 'error');
  }
}

/* ===== UI Functions ===== */
function updateUserUI() {
  if (currentUser) {
    elements.userName.textContent = currentUser.displayName;
    elements.userAvatar.src = currentUser.photoURL || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=${colors.primary.replace('#', '')}`;
    elements.authContainer.classList.add('hidden');
    elements.chatContainer.classList.remove('hidden');
  } else {
    elements.authContainer.classList.remove('hidden');
    elements.chatContainer.classList.add('hidden');
  }
}

function showError(message, type = 'error') {
  const errorElement = document.createElement('div');
  errorElement.className = `notification ${type}`;
  errorElement.innerHTML = `
    <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(errorElement);
  animateElement(errorElement, 'slideInUp');
  
  setTimeout(() => {
    animateElement(errorElement, 'slideOutDown');
    setTimeout(() => errorElement.remove(), 300);
  }, 3000);
}

/* ===== Chat Functions ===== */
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
        animateElement(contactElement, 'pulse');
        selectContact(contact);
      });
      
      elements.contactsList.appendChild(contactElement);
      animateElement(contactElement, 'fadeIn');
    });
  } catch (error) {
    console.error('Load contacts error:', error);
    showError('Failed to load contacts', 'error');
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
  
  // Animate chat header
  animateElement(elements.recipientAvatar, 'bounceIn');
}

function listenForMessages() {
  if (!currentUser || !recipientUid) return;
  
  const conversationId = [currentUser.uid, recipientUid].sort().join('_');
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('timestamp'));
  
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    elements.messagesDiv.innerHTML = '';
    snapshot.forEach((doc, index) => {
      const message = doc.data();
      displayMessage(message, index);
    });
    scrollToBottom();
  });
}

function displayMessage(message, index) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
  messageElement.style.animationDelay = `${index * 50}ms`;
  
  // Add typing indicator animation for received messages
  if (message.senderId !== currentUser.uid) {
    messageElement.innerHTML = `
      <div class="message-avatar">
        <img src="${elements.recipientAvatar.src}" alt="Avatar" class="avatar">
      </div>
      <div class="message-content">
        <div class="message-bubble">
          <p>${message.text}</p>
          <span class="message-time">
            ${message.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
      </div>
    `;
  } else {
    messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-bubble">
          <p>${message.text}</p>
          <span class="message-time">
            ${message.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            <i class="fas fa-check-double status-icon"></i>
          </span>
        </div>
      </div>
    `;
  }
  
  elements.messagesDiv.appendChild(messageElement);
  animateElement(messageElement, 'fadeIn');
}

function scrollToBottom() {
  elements.messagesDiv.scrollTo({
    top: elements.messagesDiv.scrollHeight,
    behavior: 'smooth'
  });
}

async function sendMessage() {
  const messageText = elements.messageInput.value.trim();
  if (!messageText || !recipientUid || !currentUser) return;
  
  // Add temporary local message for instant feedback
  const tempId = Date.now();
  const tempMessage = {
    text: messageText,
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    timestamp: new Date()
  };
  
  displayMessage(tempMessage, 0);
  scrollToBottom();
  elements.messageInput.value = '';
  
  try {
    const conversationId = [currentUser.uid, recipientUid].sort().join('_');
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    
    await addDoc(messagesRef, {
      text: messageText,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      timestamp: serverTimestamp()
    });
    
    // Remove temporary message when real one arrives
    const tempElement = document.querySelector(`[data-temp-id="${tempId}"]`);
    if (tempElement) tempElement.remove();
  } catch (error) {
    console.error('Send message error:', error);
    showError('Failed to send message', 'error');
    
    // Mark temporary message as failed
    const tempElement = document.querySelector(`[data-temp-id="${tempId}"]`);
    if (tempElement) {
      tempElement.classList.add('failed');
      tempElement.querySelector('.status-icon').className = 'fas fa-exclamation-circle status-icon';
    }
  }
}

/* ===== Event Listeners ===== */
function setupEventListeners() {
  // Auth
  elements.googleSignInBtn.addEventListener('click', handleGoogleSignIn);
  elements.signOutBtn.addEventListener('click', handleSignOut);
  
  // Messages
  elements.sendButton.addEventListener('click', sendMessage);
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // UI Effects
  applyRippleEffect(elements.googleSignInBtn);
  applyRippleEffect(elements.sendButton);
  [elements.callBtn, elements.videoCallBtn, elements.attachBtn].forEach(btn => {
    applyRippleEffect(btn);
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
  
  // Theme toggle
  elements.themeCheckbox.addEventListener('change', () => {
    if (elements.themeCheckbox.checked) {
      enableDarkMode();
    } else {
      disableDarkMode();
    }
    animateElement(elements.body, 'fadeIn');
  });
}

// Initialize
setupEventListeners();
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    updateUserUI();
  } else {
    currentUser = null;
    updateUserUI();
  }
});