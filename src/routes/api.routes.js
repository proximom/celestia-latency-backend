const express = require('express');
const router = express.Router();
const latencyController = require('../controllers/latency.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validate = require('../middleware/validator.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { 
  uploadLatencySchema, 
  monitoringUploadSchema 
} = require('../utils/validators');

// Public endpoints (no auth)
router.get(
  '/latency/summary',
  asyncHandler(latencyController.getSummary.bind(latencyController))
);

router.get(
  '/latency/endpoint/:url',
  asyncHandler(latencyController.getEndpointDetails.bind(latencyController))
);

// Protected endpoints (require API key)
router.post(
  '/upload-latency',
  authMiddleware,
  validate(uploadLatencySchema),
  asyncHandler(latencyController.uploadLatency.bind(latencyController))
);

router.post(
  '/upload-monitoring',
  authMiddleware,
  validate(monitoringUploadSchema),
  asyncHandler(latencyController.uploadMonitoring.bind(latencyController))
);

module.exports = router;