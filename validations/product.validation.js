/**
 * Product Validation Schema
 * Uses Joi for request body validation
 */

const Joi = require('joi');

const createProductSchema = Joi.object({
  category_id: Joi.number()
    .integer()
    .allow(null)
    .optional()
    .messages({
      'number.base': 'category_id must be a number'
    }),

  product_name: Joi.string()
    .max(150)
    .required()
    .messages({
      'string.empty': 'Product name is required',
      'string.max': 'Product name cannot exceed 150 characters',
      'any.required': 'Product name is required'
    }),

  sku: Joi.string()
    .max(100)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'SKU cannot exceed 100 characters'
    }),

  barcode: Joi.string()
    .max(100)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Barcode cannot exceed 100 characters'
    }),

  unit: Joi.string()
    .max(50)
    .required()
    .messages({
      'string.empty': 'Unit is required',
      'string.max': 'Unit cannot exceed 50 characters',
      'any.required': 'Unit is required'
    }),

  base_unit: Joi.string()
    .max(20)
    .default('pcs')
    .optional()
    .messages({
      'string.max': 'Base unit cannot exceed 20 characters'
    }),

  unit_per_pack: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional()
    .messages({
      'number.base': 'Unit per pack must be a number',
      'number.min': 'Unit per pack must be at least 1'
    }),

  hsn_code: Joi.string()
    .max(20)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'HSN code cannot exceed 20 characters'
    }),

  tax_percent: Joi.number()
    .min(0)
    .max(28)
    .precision(2)
    .allow(null)
    .optional()
    .messages({
      'number.base': 'Tax percent must be a number',
      'number.min': 'Tax percent cannot be negative',
      'number.max': 'Tax percent cannot exceed 28%'
    }),

  purchase_price: Joi.number()
    .min(0)
    .precision(2)
    .allow(null)
    .optional()
    .messages({
      'number.base': 'Purchase price must be a number',
      'number.min': 'Purchase price cannot be negative'
    }),

  selling_price: Joi.number()
    .min(0)
    .precision(2)
    .allow(null)
    .optional()
    .messages({
      'number.base': 'Selling price must be a number',
      'number.min': 'Selling price cannot be negative'
    }),

  min_stock_alert: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .optional()
    .messages({
      'number.base': 'Min stock alert must be a number',
      'number.min': 'Min stock alert cannot be negative'
    }),

  is_batch_tracked: Joi.number()
    .integer()
    .valid(0, 1)
    .default(1)
    .optional()
    .messages({
      'any.only': 'is_batch_tracked must be 0 or 1'
    }),

  batch_mandatory: Joi.number()
    .integer()
    .valid(0, 1)
    .default(1)
    .optional()
    .messages({
      'any.only': 'batch_mandatory must be 0 or 1'
    }),

  default_batch_allocation: Joi.string()
    .valid('FIFO', 'FEFO', 'LIFO')
    .default('FEFO')
    .optional()
    .messages({
      'any.only': 'default_batch_allocation must be FIFO, FEFO, or LIFO'
    }),

  schedule_category: Joi.string()
    .max(50)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Schedule category cannot exceed 50 characters'
    }),

  salt_composition: Joi.array()
    .items(
      Joi.object({
        salt: Joi.string().required(),
        strength: Joi.string().required()
      }).unknown(true)
    )
    .allow(null)
    .optional()
    .messages({
      'array.base': 'salt_composition must be a valid JSON array',
      'array.includes': 'Each salt composition must have salt and strength properties'
    }),

  manufacturer: Joi.string()
    .max(150)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Manufacturer cannot exceed 150 characters'
    })
});

/**
 * Validate product creation request
 * @param {Object} data - Request body data
 * @returns {Object} - { error, value }
 */
const validateCreateProduct = (data) => {
  return createProductSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
};

module.exports = { validateCreateProduct, createProductSchema };

