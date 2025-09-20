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

// Firebase configuration
const firebaseConfig = {
 //pate firebase config here"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements with null protection
const getElement = (id) => document.getElementById(id) || {
  addEventListener: () => {},
  removeEventListener: () => {},
  disabled: false,
  value: '',
  textContent: '',
  src: '',
  classList: { add: () => {}, remove: () => {}, contains: () => false },
  style: {}
};

const elements = {
  googleSignInBtn: getElement('google-signin'),
  signOutBtn: getElement('sign-out-btn'),
  chatContainer: getElement('chat-container'),
  authContainer: getElement('auth-container'),
  messagesDiv: getElement('messages'),
  messageInput: getElement('message-input'),
  sendButton: getElement('send-button'),
  userName: getElement('user-name'),
  userAvatar: getElement('user-avatar'),
  recipientName: getElement('recipient-name'),
  recipientAvatar: getElement('recipient-avatar'),
  recipientStatus: getElement('recipient-status'),
  contactsList: document.querySelector('.contacts-list') || { innerHTML: '', appendChild: () => {} },
  searchContacts: getElement('search-contacts'),
  themeCheckbox: getElement('theme-checkbox'),
  body: document.body,
  attachBtn: getElement('attach-btn'),
  quickHideBtn: getElement('quick-hide-btn'),
  quickHideOverlay: getElement('quick-hide-overlay')
};

// App state
let currentUser = null;
let recipientUid = null;
let contacts = [];
let unsubscribeMessages = null;
let unsubscribeContacts = null;

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
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'assertive');
  notification.innerHTML = `
    <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}" aria-hidden="true"></i>
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
  if (elements.messagesDiv.scrollTo) {
    elements.messagesDiv.scrollTo({
      top: elements.messagesDiv.scrollHeight,
      behavior: 'smooth'
    });
  }
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
      photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=6C5CE7`,
      lastSeen: serverTimestamp(),
      status: 'online'
    }, { merge: true });
    
    updateUserUI();
    loadContacts();
    showNotification('Welcome to Ola Chat!');
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
    
    // Clean up listeners
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    if (unsubscribeContacts) {
      unsubscribeContacts();
      unsubscribeContacts = null;
    }
    
    showNotification('Signed out successfully');
  } catch (error) {
    console.error('Sign-out error:', error);
    showNotification('Failed to sign out. Please try again.', 'error');
  }
}

function updateUserUI() {
  if (currentUser) {
    elements.userName.textContent = currentUser.displayName;
    elements.userAvatar.src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=6C5CE7`;
    elements.userAvatar.alt = `${currentUser.displayName}'s avatar`;
    elements.authContainer.classList.add('hidden');
    elements.chatContainer.classList.remove('hidden');
  } else {
    elements.authContainer.classList.remove('hidden');
    elements.chatContainer.classList.add('hidden');
    elements.messagesDiv.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-comments" aria-hidden="true"></i>
        <p>Please sign in to start chatting</p>
      </div>
    `;
  }
}

/* ===== Contacts and Messaging ===== */
async function loadContacts() {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '!=', currentUser?.uid || ''));
    
    // Clean up previous listener if exists
    if (unsubscribeContacts) {
      unsubscribeContacts();
    }
    
    unsubscribeContacts = onSnapshot(q, (querySnapshot) => {
      contacts = [];
      elements.contactsList.innerHTML = '';
      
      if (querySnapshot.empty) {
        elements.contactsList.innerHTML = `
          <div class="empty-contacts">
            <i class="fas fa-user-plus" aria-hidden="true"></i>
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
        contactElement.setAttribute('role', 'button');
        contactElement.tabIndex = 0;
        contactElement.innerHTML = `
          <div class="avatar-container">
            <img src="${contact.photoURL}" alt="${contact.displayName}" class="avatar">
            <span class="status-indicator ${contact.status === 'online' ? 'online' : 'offline'}"></span>
          </div>
          <div class="contact-info">
            <h4>${contact.displayName}</h4>
            <p class="status-text ${contact.status === 'online' ? 'online' : 'offline'}">
              ${contact.status === 'online' ? 'Online' : 'Last seen recently'}
            </p>
          </div>
          <i class="fas fa-chevron-right contact-arrow" aria-hidden="true"></i>
        `;
        
        contactElement.addEventListener('click', () => {
          selectContact(contact);
        });
        
        contactElement.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            selectContact(contact);
          }
        });
        
        elements.contactsList.appendChild(contactElement);
      });
    }, (error) => {
      console.error('Contacts listener error:', error);
      showNotification('Error loading contacts', 'error');
    });
    
  } catch (error) {
    console.error('Load contacts error:', error);
    showNotification('Failed to load contacts', 'error');
  }
}

function selectContact(contact) {
  if (!contact || !contact.uid) return;
  
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  
  recipientUid = contact.uid;
  elements.recipientName.textContent = contact.displayName;
  elements.recipientAvatar.src = contact.photoURL;
  elements.recipientAvatar.alt = `${contact.displayName}'s avatar`;
  elements.recipientStatus.textContent = contact.status === 'online' ? 'Online' : 'Offline';
  elements.recipientStatus.className = `status-text ${contact.status === 'online' ? 'online' : 'offline'}`;
  
  elements.messageInput.disabled = false;
  elements.sendButton.disabled = false;
  
  elements.messagesDiv.innerHTML = '';
  listenForMessages();
}

function listenForMessages() {
  if (!currentUser?.uid || !recipientUid) return;
  
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
  if (!message?.text || !message?.senderId) return;
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.senderId === currentUser?.uid ? 'sent' : 'received'}`;
  
  messageElement.innerHTML = `
    ${message.senderId !== currentUser?.uid ? `
      <div class="message-avatar">
        <img src="${elements.recipientAvatar.src}" alt="${message.senderName || 'User'}" class="avatar">
      </div>
    ` : ''}
    <div class="message-content">
      <div class="message-bubble">
        <p>${message.text}</p>
        <span class="message-time">
          ${formatTimestamp(message.timestamp)}
          ${message.senderId === currentUser?.uid ? '<i class="fas fa-check-double status-icon" aria-hidden="true"></i>' : ''}
        </span>
      </div>
    </div>
  `;
  
  elements.messagesDiv.appendChild(messageElement);
}

async function sendMessage() {
  const messageText = elements.messageInput.value.trim();
  if (!messageText || !recipientUid || !currentUser?.uid) return;

  try {
    const conversationId = [currentUser.uid, recipientUid].sort().join('_');
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      text: messageText,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      timestamp: serverTimestamp()
    });
    elements.messageInput.value = '';
    elements.messageInput.focus();
  } catch (error) {
    console.error('Send error:', error);
    showNotification('Failed to send message', 'error');
  }
}

/* ===== Quick Hide Feature ===== */
function toggleQuickHide() {
  const isHidden = elements.quickHideOverlay.style.display === 'block';
  elements.quickHideOverlay.style.display = isHidden ? 'none' : 'block';
  
  // Update icon and tooltip
  const icon = elements.quickHideBtn.querySelector('i');
  if (isHidden) {
    elements.quickHideBtn.title = "Quick Hide";
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    elements.quickHideBtn.title = "Show Chat";
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

/* ===== Insert Feature ===== */
function setupInsertFeature() {
  elements.attachBtn.addEventListener('click', () => {
    showNotification('Insert feature coming soon!');
    // Future implementation for file/emoji insertion
  });
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
      const name = contact.querySelector('h4')?.textContent?.toLowerCase() || '';
      contact.style.display = name.includes(searchTerm) ? 'flex' : 'none';
    });
  });

  // Quick Hide
  elements.quickHideBtn.addEventListener('click', toggleQuickHide);
  elements.quickHideOverlay.addEventListener('click', toggleQuickHide);

  // Insert Feature
  setupInsertFeature();
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

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
