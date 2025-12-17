const Joi = require('joi');

const endpointSchema = Joi.object({
  type: Joi.string().valid('rpc', 'grpc').required(),
  endpoint: Joi.string().required().max(500),
  reachable: Joi.boolean().required(),
  timeout: Joi.boolean().required(),
  error: Joi.string().allow('').max(1000),
  http_status: Joi.string().allow('', '-').max(10),
  latest_height: Joi.alternatives().try(
    Joi.string().allow('', '-'),
    Joi.number().integer()
  ),
  block1_status: Joi.string().allow('', '-').max(100),
  latency_ms: Joi.number().integer().min(-1).required(),
  chain: Joi.string().default('celestia').max(50)
});

const uploadLatencySchema = Joi.object({
  region: Joi.string().required().max(50),
  timestamp: Joi.string().isoDate(),
  endpoints: Joi.array().items(endpointSchema).min(1).required()
});

// Alternative schema for monitor_endpoints.sh direct upload
const monitoringUploadSchema = Joi.array().items(endpointSchema).min(1);

module.exports = {
  uploadLatencySchema,
  monitoringUploadSchema,
  endpointSchema
};
