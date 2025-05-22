const express = require('express');
const router = express.Router();
const partyController = require('../controllers/party.controller');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Create a new party
router.post('/', partyController.createParty);

// Get a specific party by ID
router.get('/:id', partyController.getParty);

// Update a party by ID
router.put('/:id', partyController.updateParty);

// Delete a party by ID
router.delete('/:id', partyController.deleteParty);

module.exports = router;
