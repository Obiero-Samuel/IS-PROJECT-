const authorityController = require('./authorityController');

/**
 * Officer Login & Case Access module wrapper.
 */
const getAssignedReports = (req, res, next) => authorityController.getAssignedReports(req, res, next);
const updateReportStatus = (req, res, next) => authorityController.updateReportStatus(req, res, next);
const addResolutionNote = (req, res, next) => authorityController.addResolutionNote(req, res, next);

module.exports = {
    getAssignedReports,
    updateReportStatus,
    addResolutionNote,
};
