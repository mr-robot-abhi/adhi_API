const Party = require('../models/party.model');

// Create a new party
exports.createParty = async (req, res) => {
  try {
    const party = await Party.create(req.body);
    res.status(201).json({ success: true, data: party });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Get a specific party by ID
exports.getParty = async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) {
      return res.status(404).json({ success: false, error: 'Party not found' });
    }
    res.status(200).json({ success: true, data: party });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update a party by ID
exports.updateParty = async (req, res) => {
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!party) {
      return res.status(404).json({ success: false, error: 'Party not found' });
    }
    res.status(200).json({ success: true, data: party });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete a party by ID
exports.deleteParty = async (req, res) => {
  try {
    const party = await Party.findByIdAndDelete(req.params.id);
    if (!party) {
      return res.status(404).json({ success: false, error: 'Party not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
