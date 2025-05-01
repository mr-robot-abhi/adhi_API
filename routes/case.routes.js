const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Case = require('../models/case.model');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

// Validation rules
const createCaseRules = [
  check('title').not().isEmpty().trim().escape(),
  check('caseType').isIn(['civil', 'criminal', 'family', 'commercial', 'writ', 'arbitration']),
  check('filingDate').isISO8601(),
  check('petitionerNames.*').not().isEmpty().trim().escape(),
  check('opposingPartyNames.*').not().isEmpty().trim().escape()
];

const updateCaseRules = [
  check('status').optional().isIn(['draft', 'active', 'inactive', 'closed', 'archived']),
  check('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  check('caseStage').optional().isIn(['filing', 'evidence', 'arguments', 'judgment', 'execution', 'appeal'])
];

// @route    POST api/cases
// @desc     Create new case
// @access   Private (Admin, Lawyer)
router.post('/', 
  auth.verify, 
  createCaseRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const caseData = {
        ...req.body,
        user: req.user.id,
        lawyers: [req.user.id], // Assign creator as primary lawyer
        caseTitle: req.body.title // Denormalize for easier queries
      };

      const newCase = await CaseService.createCase(caseData);
      
      res.status(201).json(newCase);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

// @route    GET api/cases
// @desc     Get all cases (with filters)
// @access   Private
router.get('/', auth.verify, async (req, res) => {
  try {
    let query = {};
    const userRole = req.user.role;

    // Role-based filtering
    if (userRole === 'client') {
      query.client = req.user.id;
    } else if (userRole === 'lawyer') {
      query.lawyers = req.user.id;
    }
    // Admins can see all cases

    // Apply search filters
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { title: searchRegex },
        { caseNumber: searchRegex },
        { 'petitionerNames': searchRegex },
        { 'opposingPartyNames': searchRegex }
      ];
    }

    // Status filter
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    // Type filter
    if (req.query.type && req.query.type !== 'all') {
      query.caseType = req.query.type;
    }

    // District filter
    if (req.query.district && req.query.district !== 'all') {
      query.district = req.query.district;
    }

    // Priority filter
    if (req.query.priority && req.query.priority !== 'all') {
      query.priority = req.query.priority;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const cases = await Case.find(query)
      .sort({ hearingDate: 1, priority: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email')
      .populate('client', 'name email')
      .populate('lawyers', 'name specialization');

    const total = await Case.countDocuments(query);

    res.json({
      cases,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    GET api/cases/:id
// @desc     Get single case
// @access   Private
router.get('/:id', auth.verify, async (req, res) => {
  try {
    const caseItem = await Case.findOne({
      _id: req.params.id,
      $or: [
        { user: req.user.id },
        { client: req.user.id },
        { lawyers: req.user.id }
      ]
    })
    .populate('user', 'name email')
    .populate('client', 'name email')
    .populate('lawyers', 'name specialization')
    .populate('documents', 'name type createdAt')
    .populate('events', 'title start end type');

    if (!caseItem) {
      return res.status(404).json({ errors: [{ msg: 'Case not found' }] });
    }

    // Get case statistics
    const stats = await DocumentService.getStatsByCase(caseItem._id);
    const timeline = await CaseService.getCaseTimeline(caseItem._id);

    res.json({
      ...caseItem.toObject(),
      stats,
      timeline
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    PUT api/cases/:id
// @desc     Update case
// @access   Private (Admin, Lawyer)
router.put('/:id', 
  auth.verify, 
  updateCaseRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Verify user has access to this case
      const existingCase = await Case.findOne({
        _id: req.params.id,
        lawyers: req.user.id
      });

      if (!existingCase) {
        return res.status(404).json({ errors: [{ msg: 'Case not found' }] });
      }

      const updatedCase = await CaseService.updateCase(
        req.params.id, 
        req.user.id,
        req.body
      );

      res.json(updatedCase);
    } catch (err) {
      console.error(err.message);
      if (err.message.includes('not found')) {
        return res.status(404).json({ errors: [{ msg: err.message }] });
      }
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

// @route    DELETE api/cases/:id
// @desc     Delete case
// @access   Private (Admin)
router.delete('/:id', 
  auth.verify, 
  async (req, res) => {
    try {
      await CaseService.deleteCase(req.params.id);
      res.json({ msg: 'Case deleted successfully' });
    } catch (err) {
      console.error(err.message);
      if (err.message.includes('not found')) {
        return res.status(404).json({ errors: [{ msg: err.message }] });
      }
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

module.exports = router;