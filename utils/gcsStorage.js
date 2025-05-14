// utils/gcsStorage.js
// Google Cloud Storage utility for Adhivakta

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const logger = require('../utils/logger');

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// let storage, bucket;
// try {
//   storage = new Storage({
//     keyFilename: GOOGLE_APPLICATION_CREDENTIALS,
//   });
//   bucket = storage.bucket(GCS_BUCKET_NAME);
// } catch (error) {
//   logger.error('GCS initialization error:', error);
// }
// To re-enable GCS, uncomment the above block.

/**
 * Upload a file buffer to GCS
 * @param {Buffer} fileBuffer
 * @param {string} destinationPath
 * @param {string} mimetype
 * @returns {Promise<string>} Public URL
 */
async function uploadFileToGCS(fileBuffer, destinationPath, mimetype) {
  if (!bucket) throw new Error('GCS bucket not initialized');
  // if (!bucket) return null; // GCS disabled for build safety
  // const file = bucket.file(destinationPath);
  // await file.save(fileBuffer, {
  //   contentType: mimetype,
  //   resumable: false,
  //   public: true,
  // });
  // return getPublicUrl(destinationPath);
  return null; // GCS disabled for build safety
}

/**
 * Get the public URL for a file
 */
function getPublicUrl(filename) {
  return `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;
}

/**
 * Delete a file from GCS
 */
async function deleteFileFromGCS(filename) {
  if (!bucket) throw new Error('GCS bucket not initialized');
  await bucket.file(filename).delete();
}

module.exports = {
  uploadFileToGCS,
  getPublicUrl,
  deleteFileFromGCS,
};
