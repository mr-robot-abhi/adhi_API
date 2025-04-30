const Case = require('../models/case.model');

exports.createCase = async (req, res) => {
  try {
    const { title, description, status, client } = req.body;
    const createdBy = req.user.id;

    const newCase = new Case({
      title,
      description,
      status,
      client,
      createdBy
    });

    await newCase.save();
    res.status(201).json(newCase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllCases = async (req, res) => {
  try {
    const cases = await Case.find()
      .populate('createdBy', 'email')
      .populate('client', 'name email');
    res.json(cases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCase = async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id)
      .populate('createdBy', 'email')
      .populate('client', 'name email');
    
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }
    
    res.json(caseData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCase = async (req, res) => {
  try {
    const updatedCase = await Case.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedCase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCase = async (req, res) => {
  try {
    await Case.findByIdAndDelete(req.params.id);
    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
