require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// --- Logger Setup ---
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}
const timestamp = new Date().toISOString().replace(/:/g, '-');
const logFile = path.join(logsDir, `orchestrator-${timestamp}.log`);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: logFile }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => `${level}: ${message}`) // Use winston's level for colorization
      ),
    }),
  ],
});

// --- Configuration ---
const HETZNER_TOKEN = process.env.HETZNER_API_TOKEN;
const BACKEND_API_URL = process.env.BACKEND_API_URL;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;
const GIT_REPO_URL = process.env.GIT_REPO_URL;
const SSH_KEY_ID = parseInt(process.env.HETZNER_SSH_KEY_ID, 10);

const TEST_REGIONS = ['fsn1', 'nbg1', 'hel1', 'ash'];
const SERVER_TYPE = 'cpx11';
const SERVER_IMAGE = 'ubuntu-22.04';

// --- Validation ---
function validateConfig() {
  const required = { HETZNER_TOKEN, BACKEND_API_URL, BACKEND_API_KEY, GIT_REPO_URL, SSH_KEY_ID };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);

  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:');
    missing.forEach(key => logger.error(`   - ${key}`));
    logger.error('\nPlease check your .env file.');
    process.exit(1);
  }
  if (isNaN(SSH_KEY_ID)) {
    logger.error('❌ HETZNER_SSH_KEY_ID must be a number.');
    process.exit(1);
  }
}

// --- Library-Free Server Creation with VERBOSE cURL ---
function createServer(serverData, region) {
  const jsonData = JSON.stringify(serverData);
  
  // ✅ FIX: Added -v (verbose) and -i (include headers) to curl arguments
  const args = [
    '-v', '-i',
    '-X', 'POST',
    '-H', `Authorization: Bearer ${HETZNER_TOKEN}`,
    '-H', 'Content-Type: application/json',
    '-d', jsonData,
    'https://api.hetzner.cloud/v1/servers'
  ];

  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const curl = spawn(command, args);

    let output = '';
    curl.stdout.on('data', (data) => { output += data.toString(); });
    curl.stderr.on('data', (data) => { output += data.toString(); }); // Capture stderr too for verbose output

    curl.on('close', (code) => {
      // ✅ FIX: Log the FULL raw output for debugging
      logger.info(`\n--- Raw cURL Output for region [${region}] ---\n${output}\n------------------------------------------`);

      if (code !== 0) {
        reject(new Error(`cURL process exited with code ${code}.`));
        return;
      }
      
      // Extract JSON body from the raw output (it comes after the headers)
      const jsonBodyMatch = output.match(/\{.*\}/s);
      if (jsonBodyMatch) {
        try {
          const response = JSON.parse(jsonBodyMatch[0]);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        } catch (e) {
          reject(new Error("Failed to parse JSON from cURL output."));
        }
      } else {
         reject(new Error("No JSON body found in cURL output. The API might have returned an empty response."));
      }
    });

    curl.on('error', (err) => {
      reject(new Error(`Failed to start cURL process: ${err.message}`));
    });
  });
}

// --- Main Orchestration ---
async function runOrchestration() {
  logger.info('🚀 Starting orchestration (VERBOSE MODE)...');
  validateConfig();

  try {
    const cloudInitTemplate = fs.readFileSync(path.join(__dirname, 'cloud-init.sh'), 'utf8');
    const results = [];

    for (const region of TEST_REGIONS) {
      const serverName = `latency-tester-${region}-${Date.now()}`;
      logger.info(`📍 Creating server in ${region}... (Name: ${serverName})`);

      const finalCloudInitScript = cloudInitTemplate
        .replace(/__HETZNER_API_TOKEN__/g, HETZNER_TOKEN)
        .replace(/__GIT_REPO_URL__/g, GIT_REPO_URL)
        .replace(/__BACKEND_API_URL__/g, BACKEND_API_URL)
        .replace(/__BACKEND_API_KEY__/g, BACKEND_API_KEY)
        .replace(/__REGION__/g, region);

      const serverOptions = {
        name: serverName,
        server_type: SERVER_TYPE,
        image: SERVER_IMAGE,
        location: region,
        ssh_keys: [SSH_KEY_ID],
        user_data: finalCloudInitScript,
        start_after_create: true,
        labels: { project: 'celestia-latency-monitor', region: region },
      };

      try {
        const response = await createServer(serverOptions, region);
        logger.info(`   ✅ Server creation initiated (ID: ${response.server.id})`);
        results.push({ region, success: true, serverId: response.server.id });
      } catch (error) {
        logger.error(`   ❌ Failed to create server in ${region}: ${error.message}`);
        results.push({ region, success: false, error: error.message });
      }
    }

    // Summary
    logger.info('========================================');
    logger.info('📊 Orchestration Summary:');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    logger.info(`✅ Successful creations: ${successful}/${TEST_REGIONS.length}`);
    logger.info(`❌ Failed creations: ${failed}/${TEST_REGIONS.length}`);
    if (failed > 0) {
      logger.warn('Failed regions:');
      results.filter(r => !r.success).forEach(r => logger.warn(`   - ${r.region}: ${r.error}`));
    }
    logger.info('\n🎉 Orchestration complete!');
    logger.info(`See full details in the log file: ${logFile}`);

  } catch (error) {
    logger.error('❌ A fatal error occurred during orchestration:', error.message);
    process.exit(1);
  }
}

runOrchestration();