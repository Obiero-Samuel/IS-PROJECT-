/**
 * This file handles escalation endpoints by delegating to authority controller logic.
 */
// Reuse existing authority controller logic to avoid duplication.
const authorityController = require('./authorityController');

/**
 * Escalation Engine & Audit Logger module wrapper.
 */
const createEscalation = (req, res, next) => authorityController.createEscalation(req, res, next);
// Proxy list escalations endpoint to authority controller.
const getEscalationsForAuthority = (req, res, next) => authorityController.getEscalationsForAuthority(req, res, next);
// Proxy update escalation status endpoint.
const updateEscalationStatus = (req, res, next) => authorityController.updateEscalationStatus(req, res, next);

module.exports = {
    createEscalation,
    getEscalationsForAuthority,
    updateEscalationStatus,
};
