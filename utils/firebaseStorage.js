const { bucket } = require('../config/firebase');
const logger = require('./logger');
const retry = require('async-retry');

exports.uploadFile = async (fileBuffer, fileName, mimetype, metadata = {}) => {
  return retry(
    async (bail) => {
      try {
        const filePath = `documents/${Date.now()}_${fileName}`;
        const blob = bucket.file(filePath);

        await blob.save(fileBuffer, {
          metadata: {
            contentType: mimetype,
            metadata: metadata
          },
          public: true,
          validation: 'md5'
        });

        const [url] = await blob.getSignedUrl({
          action: 'read',
          expires: '03-09-2491' // Far future date
        });

        return {
          url,
          filePath,
          size: fileBuffer.length,
          contentType: mimetype
        };
      } catch (error) {
        logger.error(`Firebase upload attempt failed: ${error.message}`);
        if (error.code === 401) {
          bail(new Error('Authentication failed'));
          return;
        }
        throw error;
      }
    },
    {
      retries: 3,
      minTimeout: 1000
    }
  );
};

exports.deleteFile = async (filePath) => {
  try {
    await bucket.file(filePath).delete();
    logger.info(`File deleted: ${filePath}`);
    return true;
  } catch (error) {
    if (error.code === 404) {
      logger.warn(`File not found: ${filePath}`);
      return false;
    }
    logger.error(`Error deleting file: ${error.message}`);
    throw error;
  }
};

exports.getFileStream = (filePath) => {
  return bucket.file(filePath).createReadStream();
};

exports.generateDownloadUrl = async (filePath, expiresInMinutes = 15) => {
  const [url] = await bucket.file(filePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000
  });
  return url;
};