const Joi = require('joi');
const logger = require('./logger');

// Common schemas
const emailSchema = Joi.string().email().required().lowercase().trim();
const passwordSchema = Joi.string()
  .min(8)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
  .message('Password must contain at least one lowercase letter, one uppercase letter, and one number');

// Schemas
const schemas = {
  login: Joi.object({
    email: emailSchema,
    password: passwordSchema
  }),
  register: Joi.object({
    email: emailSchema,
    password: passwordSchema,
    name: Joi.string().min(2).max(100).required().trim(),
    role: Joi.string().valid('client', 'lawyer').required()
  }),
  case: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(1000).required(),
    status: Joi.string().valid('active', 'closed')
  }),
  document: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(500)
  })
};

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    logger.warn(`Validation failed: ${JSON.stringify(errors)}`);
    return res.status(400).json({ errors });
  }
  next();
};

const validatePassword = (password) => {
  const { error } = passwordSchema.validate(password);
  return !error;
};

const createCaseSchema = Joi.object({
  // Core Required Fields
  title: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'Case title cannot be empty',
    'string.min': 'Case title must be at least 1 character long',
    'string.max': 'Case title cannot exceed 100 characters',
    'any.required': 'Case title is required'
  }),
  caseNumber: Joi.string().required().messages({
    'string.empty': 'Case number cannot be empty',
    'any.required': 'Case number is required'
  }),
  caseType: Joi.string().valid("civil", "criminal", "family", "commercial", "writ", "arbitration", "labour", "revenue", "motor_accident", "appeal", "revision", "execution", "other").required().messages({
    'any.only': 'Invalid case type',
    'any.required': 'Case type is required'
  }),
  status: Joi.string().valid("active", "closed").required().messages({
    'any.only': 'Invalid status',
    'any.required': 'Status is required'
  }),

  // Optional Fields
  description: Joi.string().allow('', null).optional(),
  courtState: Joi.string().valid("karnataka", "maharashtra", "delhi", "tamil_nadu", "andhra_pradesh", "kerala", "telangana", "goa").allow('', null).optional(),
  district: Joi.string().allow('', null).optional(), // Consider adding specific enums if strict validation is needed
  bench: Joi.string().valid("bengaluru", "dharwad", "kalaburagi", "").allow('', null).optional(),
  courtType: Joi.string().valid("high_court", "district_court", "supreme_court", "tribunal", "family_court", "consumer_court", "labour_court", "sessions_court", "civil_court", "magistrate_court", "special_court").allow('', null).optional(),
  court: Joi.string().allow('', null).optional(),
  courtHall: Joi.string().allow('', null).optional(),
  courtComplex: Joi.string().allow('', null).optional(),
  filingDate: Joi.date().optional(),
  hearingDate: Joi.date().optional(),
  nextHearingDate: Joi.date().required().messages({
    'any.required': 'Next hearing date is required',
    'date.base': 'Next hearing date must be a valid date'
  }),
  priority: Joi.string().valid("low", "normal", "high", "urgent").allow('', null).optional(),
  isUrgent: Joi.boolean().optional(),
  caseStage: Joi.string().valid("filing", "pre_trial", "trial", "evidence", "arguments", "judgment", "execution", "appeal").allow('', null).optional(),
  actSections: Joi.string().allow('', null).optional(),
  reliefSought: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  lawyer: Joi.string().hex().length(24).allow(null).optional(), // Primary lawyer reference
  client: Joi.string().hex().length(24).allow(null).optional(), // Primary client reference
  // Array of lawyers associated with the case
  lawyers: Joi.array().items(
    Joi.object({
      user: Joi.string().hex().length(24).allow(null).optional(),
      name: Joi.string().required(),
      email: Joi.string().email().allow('').optional(),
      contact: Joi.string().allow('').optional(),
      company: Joi.string().allow('').optional(),
      gst: Joi.string().allow('').optional(),
      role: Joi.string().valid('lead', 'associate', 'junior', 'senior', 'counsel', 'other').default('associate'),
      position: Joi.string().valid('first_chair', 'second_chair', 'supporting', 'other').default('supporting'),
      isPrimary: Joi.boolean().default(false),
      level: Joi.string().valid('Senior', 'Junior', 'Associate').allow('').optional(),
      chairPosition: Joi.string().valid('first_chair', 'second_chair', 'supporting').default('supporting'),
      addedBy: Joi.string().hex().length(24).optional(),
      addedAt: Joi.date().default(() => new Date())
    })
  ).optional().default([]),

  parties: Joi.object({
    petitioner: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string().valid('Individual', 'Corporation', 'Organization').default('Individual').optional(),
        role: Joi.string().valid('Petitioner', 'Appellant', 'Plaintiff', 'Complainant').optional(),
        email: Joi.string().email().allow('', null).optional(),
        contact: Joi.string().allow('', null).optional(),
        address: Joi.string().allow('', null).optional()
      })
    ).min(0).optional().default([]),
    respondent: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string().valid('Individual', 'Corporation', 'Organization').default('Individual').optional(),
        role: Joi.string().valid('Respondent', 'Accused', 'Defendant', 'Opponent').optional(),
        email: Joi.string().email().allow('', null).optional(),
        contact: Joi.string().allow('', null).optional(),
        address: Joi.string().allow('', null).optional(),
        opposingCounsel: Joi.string().allow('', null).optional()
      })
    ).min(0).optional().default([])
  }).optional().default({ petitioner: [], respondent: [] }),
  // Legacy advocates field - kept for backward compatibility
  advocates: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().allow('', null).optional(),
      contact: Joi.string().allow('', null).optional(),
      company: Joi.string().allow('', null).optional(),
      gst: Joi.string().allow('', null).optional(),
      spock: Joi.string().allow('', null).optional(),
      poc: Joi.string().allow('', null).optional(),
      isLead: Joi.boolean().optional().default(false),
      level: Joi.string().valid('Senior', 'Junior', 'Associate').allow('', null).optional()
    })
  ).default([]),

  clients: Joi.array().items(
    Joi.object({
      name: Joi.string().required().messages({
        'string.empty': 'Client name cannot be empty',
        'any.required': 'Client name is required if a client object is provided'
      }),
      email: Joi.string().email().allow('', null).optional(),
      contact: Joi.string().allow('', null).optional(),
      address: Joi.string().allow('', null).optional()
    })
  ).default([]), // clients array is optional, defaults to empty

  stakeholders: Joi.array().items(
    Joi.object({
      name: Joi.string().required().messages({
        'string.empty': 'Stakeholder name cannot be empty',
        'any.required': 'Stakeholder name is required if a stakeholder object is provided'
      }),
      roleInCase: Joi.string().allow('', null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      contact: Joi.string().allow('', null).optional(),
      address: Joi.string().allow('', null).optional()
    })
  ).default([]), // stakeholders array is optional, defaults to empty
}).unknown(false);

const updateCaseSchema = Joi.object({
  title: Joi.string().min(1).max(100).optional().messages({
    'string.min': 'Case title must be at least 1 character long',
    'string.max': 'Case title cannot exceed 100 characters'
  }),
  caseNumber: Joi.string().optional(), // Usually not updatable, but making optional for schema
  caseType: Joi.string().valid("civil", "criminal", "family", "commercial", "writ", "arbitration", "labour", "revenue", "motor_accident", "appeal", "revision", "execution", "other").optional().messages({
    'any.only': 'Invalid case type'
  }),
  status: Joi.string().valid("active", "closed").optional().messages({
    'any.only': 'Invalid status'
  }),
  description: Joi.string().allow('', null).optional(),
  courtState: Joi.string().valid("karnataka", "maharashtra", "delhi", "tamil_nadu", "andhra_pradesh", "kerala", "telangana", "goa").allow('', null).optional(),
  district: Joi.string().allow('', null).optional(),
  bench: Joi.string().valid("bengaluru", "dharwad", "kalaburagi", "").allow('', null).optional(),
  courtType: Joi.string().valid("high_court", "district_court", "supreme_court", "tribunal", "family_court", "consumer_court", "labour_court", "sessions_court", "civil_court", "magistrate_court", "special_court").allow('', null).optional(),
  court: Joi.string().allow('', null).optional(),
  courtHall: Joi.string().allow('', null).optional(),
  courtComplex: Joi.string().allow('', null).optional(),
  filingDate: Joi.date().optional(),
  hearingDate: Joi.date().optional(),
  nextHearingDate: Joi.date().allow(null).optional(),
  priority: Joi.string().valid("low", "normal", "high", "urgent").allow('', null).optional(),
  isUrgent: Joi.boolean().optional(),
  caseStage: Joi.string().valid("filing", "pre_trial", "trial", "evidence", "arguments", "judgment", "execution", "appeal").allow('', null).optional(),
  actSections: Joi.string().allow('', null).optional(),
  reliefSought: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  lawyer: Joi.string().hex().length(24).allow(null).optional(),
  client: Joi.string().hex().length(24).allow(null).optional(),
  parties: Joi.object({
    petitioner: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string().valid('Individual', 'Corporation', 'Organization').default('Individual').optional(),
        role: Joi.string().valid('Petitioner', 'Appellant', 'Plaintiff', 'Complainant').optional(),
        email: Joi.string().email().allow('', null).optional(),
        contact: Joi.string().allow('', null).optional(),
        address: Joi.string().allow('', null).optional()
      })
    ).min(0).optional(),
    respondent: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string().valid('Individual', 'Corporation', 'Organization').default('Individual').optional(),
        role: Joi.string().valid('Respondent', 'Accused', 'Defendant', 'Opponent').optional(),
        email: Joi.string().email().allow('', null).optional(),
        contact: Joi.string().allow('', null).optional(),
        address: Joi.string().allow('', null).optional(),
        opposingCounsel: Joi.string().allow('', null).optional()
      })
    ).min(0).optional()
  }).optional(),
  advocates: Joi.array().items(
    Joi.object({
      name: Joi.string().required(), // Name still required if advocate object is provided
      email: Joi.string().email().allow('', null).optional(),
      contact: Joi.string().allow('', null).optional(),
      company: Joi.string().allow('', null).optional(),
      gst: Joi.string().allow('', null).optional(),
      spock: Joi.string().allow('', null).optional(),
      poc: Joi.string().allow('', null).optional(),
      isLead: Joi.boolean().optional(),
      level: Joi.string().valid('Senior', 'Junior').allow(null).optional()
    })
  ).min(0).optional(),
  clients: Joi.array().items(
    Joi.object({
      name: Joi.string().required(), // Name still required if client object is provided
      email: Joi.string().email().allow('', null).optional(),
      contact: Joi.string().allow('', null).optional(),
      address: Joi.string().allow('', null).optional()
    })
  ).min(0).optional(),
  stakeholders: Joi.array().items(
    Joi.object({
      name: Joi.string().required(), // Name still required if stakeholder object is provided
      roleInCase: Joi.string().allow('', null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      contact: Joi.string().allow('', null).optional(),
      address: Joi.string().allow('', null).optional()
    })
  ).min(0).optional()
}).unknown(false);

module.exports = {
  validateLogin: validate(schemas.login),
  validateRegister: validate(schemas.register),
  validateCase: validate(schemas.case),
  validateDocument: validate(schemas.document),
  validatePassword,
  schemas,
  createCaseSchema,
  updateCaseSchema
};