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
    role: Joi.string().valid('client', 'lawyer', 'admin').required()
  }),
  case: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(1000).required(),
    status: Joi.string().valid('draft', 'active', 'closed', 'archived')
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

module.exports = {
  validateLogin: validate(schemas.login),
  validateRegister: validate(schemas.register),
  validateCase: validate(schemas.case),
  validateDocument: validate(schemas.document),
  validatePassword,
  schemas
};