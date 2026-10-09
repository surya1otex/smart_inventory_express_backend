/**
 * Pharmacy settings validation
 */

const Joi = require('joi');

const GSTIN_PATTERN = /^[0-9A-Z]{15}$/;
const LICENSE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./\-]{0,39}$/;

const saveSchema = Joi.object({
  pharmacy_name: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required()
    .messages({
      'string.empty': 'Pharmacy name is required',
      'string.min': 'Pharmacy name must be at least 2 characters',
      'string.max': 'Pharmacy name cannot exceed 200 characters',
      'any.required': 'Pharmacy name is required'
    }),

  gstin: Joi.string()
    .trim()
    .uppercase()
    .allow('', null)
    .pattern(GSTIN_PATTERN)
    .messages({
      'string.pattern.base': 'GSTIN must be exactly 15 alphanumeric characters'
    }),

  drug_license_numbers: Joi.array()
    .items(
      Joi.string()
        .trim()
        .max(40)
        .pattern(LICENSE_PATTERN)
        .messages({
          'string.pattern.base':
            'Each drug license may contain letters, numbers, spaces, dots, slashes, and hyphens',
          'string.max': 'Each drug license cannot exceed 40 characters'
        })
    )
    .max(10)
    .messages({
      'array.max': 'You can store up to 10 drug license numbers'
    })
});

const validateSave = (body = {}) => {
  const licenses = Array.isArray(body.drug_license_numbers)
    ? body.drug_license_numbers.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  return saveSchema.validate(
    {
      pharmacy_name: body.pharmacy_name,
      gstin: body.gstin ?? '',
      drug_license_numbers: licenses
    },
    { abortEarly: false, stripUnknown: true }
  );
};

module.exports = { validateSave };
