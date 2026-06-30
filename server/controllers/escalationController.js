const authorityController = require('./authorityController');

/**
 * Escalation Engine & Audit Logger module wrapper.
 */
const createEscalation = (req, res, next) => authorityController.createEscalation(req, res, next);
const getEscalationsForAuthority = (req, res, next) => authorityController.getEscalationsForAuthority(req, res, next);
const updateEscalationStatus = (req, res, next) => authorityController.updateEscalationStatus(req, res, next);

module.exports = {
    createEscalation,
    getEscalationsForAuthority,
    updateEscalationStatus,
};
