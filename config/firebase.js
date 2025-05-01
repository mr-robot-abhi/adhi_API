const admin = require('firebase-admin');
const logger = require('../utils/logger');
require('dotenv').config();

const initializeFirebase = () => {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      clientId: process.env.FIREBASE_CLIENT_ID,
      authUri: "https://accounts.google.com/o/oauth2/auth",
      tokenUri: "https://oauth2.googleapis.com/token",
      authProviderX509CertUrl: "https://www.googleapis.com/oauth2/v1/certs",
      clientX509CertUrl: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
    };

    // Validate required environment variables
    if (!serviceAccount.privateKey || !serviceAccount.clientEmail) {
      throw new Error('Missing Firebase service account credentials');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });

    logger.info('✅ Firebase Admin initialized');
    
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const auth = admin.auth();

    return { admin, bucket, db, auth };
  } catch (error) {
    logger.error(`❌ Firebase initialization failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = initializeFirebase();