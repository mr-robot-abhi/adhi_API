const { bucket } = require('../config/firebase');
const logger = require('./logger');

exports.uploadFile = async (fileBuffer, fileName, mimetype) => {
  try {
    const blob = bucket.file(`documents/${Date.now()}_${fileName}`);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: mimetype
      }
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (err) => {
        logger.error(`Firebase upload error: ${err.message}`);
        reject(err);
      });

      blobStream.on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve({
          url: publicUrl,
          filePath: blob.name
        });
      });

      blobStream.end(fileBuffer);
    });
  } catch (error) {
    logger.error(`Firebase storage error: ${error.message}`);
    throw error;
  }
};

exports.deleteFile = async (filePath) => {
  try {
    await bucket.file(filePath).delete();
    logger.info(`Deleted file from Firebase: ${filePath}`);
  } catch (error) {
    logger.error(`Error deleting file from Firebase: ${error.message}`);
    throw error;
  }
};

exports.getFileStream = (filePath) => {
  return bucket.file(filePath).createReadStream();
};
