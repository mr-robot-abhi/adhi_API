const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } = require('firebase/storage');
const logger = require('./logger');

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Upload file to Firebase Storage
exports.uploadFile = async (fileBuffer, path, contentType) => {
  try {
    const storageRef = ref(storage, path);
    const metadata = {
      contentType: contentType
    };
    
    await uploadBytes(storageRef, fileBuffer, metadata);
    
    // Return the file path (not the URL)
    return path;
  } catch (error) {
    logger.error(`Error uploading file to Firebase Storage: ${error.message}`);
    throw error;
  }
};

// Get signed URL for file access
exports.getSignedUrl = async (path) => {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    logger.error(`Error getting signed URL: ${error.message}`);
    throw error;
  }
};

// Delete file from Firebase Storage
exports.deleteFile = async (path) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    logger.error(`Error deleting file from Firebase Storage: ${error.message}`);
    throw error;
  }
};