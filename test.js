const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'your-super-secret-api-key-change-this-in-production';

// Sample test data
const sampleData = {
  region: 'EU-DE-FSN',
  timestamp: new Date().toISOString(),
  endpoints: [
    {
      type: 'rpc',
      endpoint: 'celestia-rpc.publicnode.com',
      reachable: true,
      timeout: false,
      error: '',
      http_status: '200',
      latest_height: '1234567',
      block1_status: '-',
      latency_ms: 52,
      chain: 'celestia'
    },
    {
      type: 'grpc',
      endpoint: 'celestia-grpc.publicnode.com:443',
      reachable: true,
      timeout: false,
      error: '',
      http_status: '-',
      latest_height: '-',
      block1_status: 'Has block 1',
      latency_ms: 87,
      chain: 'celestia'
    },
    {
      type: 'rpc',
      endpoint: 'celestia-rpc-offline.example.com',
      reachable: false,
      timeout: true,
      error: 'Connection timeout',
      http_status: '-',
      latest_height: '-',
      block1_status: '-',
      latency_ms: -1,
      chain: 'celestia'
    }
  ]
};

async function runTests() {
  console.log('🧪 Starting backend tests...\n');

  try {
    // Test 1: Health check
    console.log('Test 1: Health Check');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', health.data);
    console.log('');

    // Test 2: Upload latency data
    console.log('Test 2: Upload Latency Data');
    const upload = await axios.post(
      `${BASE_URL}/api/upload-latency`,
      sampleData,
      {
        headers: {
          'X-API-KEY': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Upload successful:', upload.data);
    console.log('');

    // Wait a bit for data to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 3: Get summary
    console.log('Test 3: Get Summary');
    const summary = await axios.get(`${BASE_URL}/api/latency/summary`);
    console.log('✅ Summary retrieved:');
    console.log(JSON.stringify(summary.data, null, 2));
    console.log('');

    // Test 4: Get endpoint details
    console.log('Test 4: Get Endpoint Details');
    const details = await axios.get(
      `${BASE_URL}/api/latency/endpoint/${encodeURIComponent('celestia-rpc.publicnode.com')}`
    );
    console.log('✅ Endpoint details retrieved:');
    console.log(JSON.stringify(details.data, null, 2));
    console.log('');

    // Test 5: Test auth failure
    console.log('Test 5: Test Auth Failure');
    try {
      await axios.post(
        `${BASE_URL}/api/upload-latency`,
        sampleData,
        {
          headers: {
            'X-API-KEY': 'wrong-key',
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('❌ Should have failed with 403');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log('✅ Auth validation working correctly');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests();
}

module.exports = runTests;
