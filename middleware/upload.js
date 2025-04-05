const multer = require('multer');
const path = require('path');

// Set up storage engine
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const filetypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only document and image files are allowed!'));
  }
};

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

module.exports = upload;
