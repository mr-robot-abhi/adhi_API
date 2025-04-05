const Document = require('../models/document.model');
const { bucket } = require('../config/firebase');
const path = require('path');

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { caseId } = req.body;
    const uploadedBy = req.user.id;
    const file = req.file;

    // Upload to Firebase Storage
    const blob = bucket.file(`documents/${Date.now()}_${file.originalname}`);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype
      }
    });

    blobStream.on('error', (err) => {
      throw new Error('Error uploading file');
    });

    blobStream.on('finish', async () => {
      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      // Save document metadata to database
      const newDocument = new Document({
        name: file.originalname,
        url: publicUrl,
        case: caseId,
        uploadedBy,
        type: path.extname(file.originalname).substring(1)
      });

      await newDocument.save();
      res.status(201).json(newDocument);
    });

    blobStream.end(file.buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCaseDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ case: req.params.caseId })
      .populate('uploadedBy', 'email');
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.redirect(document.url);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findByIdAndDelete(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Delete from Firebase Storage
    const fileUrl = document.url;
    const filePath = fileUrl.split(`${bucket.name}/`)[1];
    await bucket.file(filePath).delete();
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
