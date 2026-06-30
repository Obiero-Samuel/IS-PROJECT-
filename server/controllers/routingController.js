const authorityController = require('./authorityController');

/**
 * Authority Routing Engine module wrapper.
 * Delegates to existing authority controller logic to preserve backward compatibility.
 */
const getAuthoritiesForCategory = (req, res, next) => authorityController.getAuthoritiesForCategory(req, res, next);

module.exports = {
    getAuthoritiesForCategory,
};
