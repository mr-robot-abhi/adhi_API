const mongoose = require("mongoose");

const PartySchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['Petitioner', 'Appellant', 'Plaintiff', 'Complainant', 'Respondent', 'Accused', 'Defendant', 'Opponent'],
    required: true
  },
  type: {
    type: String,
    enum: ['Individual', 'Corporation', 'Organization'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  phone: {
    type: String
  },
  stakeholder: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Party', PartySchema);
