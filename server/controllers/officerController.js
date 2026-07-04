/**
 * This file handles officer endpoints by delegating to authority controller logic.
 */
// Import authority controller to reuse queue/status/note handlers.
const authorityController = require('./authorityController');

/**
 * Officer Login & Case Access module wrapper.
 */
// Proxy queue listing to authority controller implementation.
const getAssignedReports = (req, res, next) => authorityController.getAssignedReports(req, res, next);
// Proxy status update endpoint.
const updateReportStatus = (req, res, next) => authorityController.updateReportStatus(req, res, next);
// Proxy add-note endpoint.
const addResolutionNote = (req, res, next) => authorityController.addResolutionNote(req, res, next);

module.exports = {
    getAssignedReports,
    updateReportStatus,
    addResolutionNote,
};
