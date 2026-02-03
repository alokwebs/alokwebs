// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMO9CwYSF4tH4y3y0eD9IEaoYq1yIeP7g",
    authDomain: "shree-balaji-variety-store.firebaseapp.com",
    databaseURL: "https://shree-balaji-variety-store-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "shree-balaji-variety-store",
    storageBucket: "shree-balaji-variety-store.firebasestorage.app",
    messagingSenderId: "455588388635",
    appId: "1:455588388635:web:6958b0e092b7455d9a3dbe",
    measurementId: "G-H3FQZ383Y5"
};

// Initialize Firebase
let app;
let database;
let auth;

try {
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully");
    } else {
        app = firebase.app();
        console.log("Firebase already initialized");
    }
    
    database = firebase.database();
    auth = firebase.auth();
    
    console.log("Firebase services initialized");
} catch (error) {
    console.error("Firebase initialization error:", error);
    alert("Firebase initialization failed. Please check your internet connection.");
}

// Store credentials (You should change these!)
const STORE_EMAIL = "bijarniya@gmail.com";
const STORE_PASSWORD = "BalajiStore@2024";

// Login function for Firebase Authentication
async function loginToFirebase() {
    try {
        showLoading(true);
        
        // Try to sign in
        const userCredential = await auth.signInWithEmailAndPassword(STORE_EMAIL, STORE_PASSWORD);
        console.log("Firebase login successful");
        return userCredential.user;
    } catch (error) {
        console.log("Login failed, trying to create account...", error);
        
        // If user doesn't exist, create account
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(STORE_EMAIL, STORE_PASSWORD);
            console.log("Admin account created successfully");
            return userCredential.user;
        } catch (createError) {
            console.error("Account creation failed:", createError);
            throw createError;
        }
    } finally {
        showLoading(false);
    }
}

// Check Firebase connection status
function checkFirebaseConnection() {
    if (!database) {
        console.error("Database not initialized");
        return false;
    }
    
    const connectedRef = database.ref(".info/connected");
    
    connectedRef.on("value", function(snap) {
        const statusElement = document.getElementById('firebase-status');
        const syncElement = document.getElementById('sync-status');
        
        if (snap.val() === true) {
            if (statusElement) {
                statusElement.textContent = "Connected";
                statusElement.style.color = "#28a745";
            }
            if (syncElement) {
                syncElement.innerHTML = '<i class="fas fa-check-circle"></i> Synced with Firebase';
                syncElement.style.color = "#28a745";
            }
            console.log("Firebase connected");
        } else {
            if (statusElement) {
                statusElement.textContent = "Disconnected";
                statusElement.style.color = "#dc3545";
            }
            if (syncElement) {
                syncElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Offline Mode';
                syncElement.style.color = "#dc3545";
            }
            console.log("Firebase disconnected");
        }
    });
    
    return true;
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
}

// Initialize Firebase connection check
setTimeout(() => {
    if (database) {
        checkFirebaseConnection();
    }
}, 2000);

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        database,
        auth,
        loginToFirebase,
        checkFirebaseConnection,
        showLoading
    };
}