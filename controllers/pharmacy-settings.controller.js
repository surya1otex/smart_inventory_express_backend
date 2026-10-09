/**
 * Pharmacy settings HTTP handlers
 */

const pharmacySettingsService = require('../services/pharmacy-settings.service');
const { validateSave } = require('../validations/pharmacy-settings.validation');

const get = async (req, res) => {
  try {
    const result = await pharmacySettingsService.getSettings();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error loading pharmacy settings:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error loading pharmacy settings',
      data: null
    });
  }
};

const save = async (req, res) => {
  try {
    const { error, value } = validateSave(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((detail) => detail.message).join(' '),
        data: null
      });
    }

    const result = await pharmacySettingsService.saveSettings(value);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error saving pharmacy settings:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error saving pharmacy settings',
      data: null
    });
  }
};

module.exports = { get, save };
