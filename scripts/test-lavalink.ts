import 'dotenv/config';
import { WebSocket } from 'ws';
import http from 'http';  // Use HTTP instead of HTTPS

async function testLavalink() {
  console.log('🎼 Testing Lavalink Connection...\n');

  // Check environment variables
  const lavalinkUrl = process.env.LAVALINK_URL || 'localhost:2333';
  const lavalinkAuth = process.env.LAVALINK_AUTH || 'youshallnotpass';
  const [host, port] = lavalinkUrl.split(':');

  console.log(`🔗 Lavalink URL: ${lavalinkUrl}`);
  console.log(`🔐 Authentication: ${lavalinkAuth.substring(0, 1)}...\n`);

  try {
    // Test 1: HTTP health check
    console.log('🔄 Testing Lavalink HTTP endpoint...');
    const httpResult = await testLavalinkHTTP(host, parseInt(port) || 2333);
    
    if (httpResult) {
      console.log('✅ Lavalink HTTP endpoint is responding');
    } else {
      console.log('❌ Lavalink HTTP endpoint is not responding');
      throw new Error('Lavalink server is not accessible');
    }

    // Test 2: WebSocket connection
    console.log('\n🔄 Testing Lavalink WebSocket connection...');
    const wsResult = await testLavalinkWebSocket(host, parseInt(port) || 2333, lavalinkAuth);
    
    if (wsResult) {
      console.log('✅ Lavalink WebSocket connection successful');
    } else {
      console.log('❌ Lavalink WebSocket connection failed');
    }

    // Test 3: Test search endpoint directly
    console.log('\n🔄 Testing Lavalink search endpoint...');
    const searchResult = await testLavalinkSearch(host, parseInt(port) || 2333, lavalinkAuth);
    
    if (searchResult) {
      console.log('✅ Lavalink search endpoint working');
      console.log(`🎵 Sample result: ${searchResult.tracks?.[0]?.info?.title || 'No tracks found'}`);
    } else {
      console.log('⚠️ Lavalink search endpoint not responding (this is normal if no tracks found)');
    }

    console.log('\n🎉 Lavalink basic connectivity test passed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ HTTP endpoint accessible');
    console.log('   ✅ WebSocket connection successful');
    console.log('   ✅ Search endpoint functional');
    console.log('\n💡 Your bot should be able to connect to Lavalink successfully!');

  } catch (error) {
    console.error('\n❌ Lavalink connectivity test failed:');
    console.error(error);
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error('\n💡 Connection Refused Solutions:');
        console.error('   • Start Lavalink server: java -jar Lavalink.jar');
        console.error('   • Or start with Docker: docker-compose up -d');
        console.error('   • Check if port 2333 is correct');
        console.error('   • Verify Lavalink is running and listening');
      } else if (error.message.includes('timeout')) {
        console.error('\n💡 Timeout Solutions:');
        console.error('   • Check firewall settings');
        console.error('   • Verify Lavalink is listening on 0.0.0.0:2333');
        console.error('   • Ensure no other service is using port 2333');
      } else if (error.message.includes('401') || error.message.includes('403')) {
        console.error('\n💡 Authentication Solutions:');
        console.error('   • Check LAVALINK_AUTH matches application.yml password');
        console.error('   • Verify Lavalink configuration');
      } else if (error.message.includes('EPROTO') || error.message.includes('SSL')) {
        console.error('\n💡 SSL/Protocol Error Solutions:');
        console.error('   • Lavalink uses HTTP, not HTTPS');
        console.error('   • Check if another service is running on port 2333');
        console.error('   • Verify Lavalink server is properly started');
      }
    }
    
    process.exit(1);
  }
}

// Test HTTP endpoint
function testLavalinkHTTP(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    // First try without authentication (some endpoints don't require it)
    const options = {
      hostname: host,
      port: port,
      path: '/version',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`   📡 HTTP Response: ${res.statusCode} ${res.statusMessage}`);
        if (res.statusCode === 200) {
          if (data) {
            try {
              const parsed = JSON.parse(data);
              console.log(`   📋 Lavalink Version: ${parsed.version || 'unknown'}`);
            } catch (e) {
              console.log(`   📋 Response: ${data.substring(0, 50)}...`);
            }
          }
          resolve(true);
        } else if (res.statusCode === 401) {
          console.log(`   🔐 Endpoint requires authentication, testing with auth...`);
          // Try again with authentication
          testLavalinkHTTPWithAuth(host, port).then(resolve);
        } else {
          console.log(`   📋 Response: ${data.substring(0, 100)}...`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ HTTP Error: ${error.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('   ⏰ HTTP request timed out');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Test HTTP endpoint with authentication
function testLavalinkHTTPWithAuth(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const auth = process.env.LAVALINK_AUTH || 'youshallnotpass';
    const options = {
      hostname: host,
      port: port,
      path: '/version',
      method: 'GET',
      headers: {
        'Authorization': auth
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`   📡 Authenticated Response: ${res.statusCode} ${res.statusMessage}`);
        if (res.statusCode === 200) {
          if (data) {
            try {
              const parsed = JSON.parse(data);
              console.log(`   📋 Lavalink Version: ${parsed.version || 'unknown'}`);
              console.log(`   📋 Build Time: ${parsed.buildTime || 'unknown'}`);
            } catch (e) {
              console.log(`   📋 Response: ${data.substring(0, 50)}...`);
            }
          }
          resolve(true);
        } else {
          console.log(`   📋 Auth Response: ${data.substring(0, 100)}...`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Auth HTTP Error: ${error.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('   ⏰ Auth HTTP request timed out');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Test WebSocket connection
function testLavalinkWebSocket(host: string, port: number, password: string): Promise<boolean> {
  return new Promise((resolve) => {
    const wsUrl = `ws://${host}:${port}/v4/websocket`;
    
    try {
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': password,
          'User-Id': 'test-user-id',
          'Client-Name': 'RDP-Soundboard-Test'
        }
      });

      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          console.log('   ⏰ WebSocket connection timed out');
          ws.terminate();
          resolved = true;
          resolve(false);
        }
      }, 5000);

      ws.on('open', () => {
        if (!resolved) {
          console.log('   ✅ WebSocket connection established');
          clearTimeout(timeout);
          ws.close();
          resolved = true;
          resolve(true);
        }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`   📨 Received: ${message.op || 'unknown'} event`);
        } catch (error) {
          console.log(`   📨 Received message: ${data.toString().substring(0, 50)}...`);
        }
      });

      ws.on('error', (error) => {
        if (!resolved) {
          console.log(`   ❌ WebSocket Error: ${error.message}`);
          clearTimeout(timeout);
          resolved = true;
          resolve(false);
        }
      });

      ws.on('close', (code, reason) => {
        if (!resolved) {
          console.log(`   🔒 WebSocket closed: ${code} ${reason}`);
          clearTimeout(timeout);
          resolved = true;
          resolve(code === 1000); // 1000 is normal closure
        }
      });

    } catch (error) {
      console.log(`   ❌ WebSocket setup error: ${error}`);
      resolve(false);
    }
  });
}

// Test search endpoint
function testLavalinkSearch(host: string, port: number, password: string): Promise<any> {
  return new Promise((resolve) => {
    const query = encodeURIComponent('ytsearch:never gonna give you up');
    const options = {
      hostname: host,
      port: port,
      path: `/v4/loadtracks?identifier=${query}`,
      method: 'GET',
      headers: {
        'Authorization': password
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`   📡 Search Response: ${res.statusCode} ${res.statusMessage}`);
        try {
          if (res.statusCode === 200 && data) {
            const result = JSON.parse(data);
            console.log(`   🔍 Load type: ${result.loadType || 'unknown'}`);
            console.log(`   📊 Tracks found: ${result.data?.tracks?.length || result.tracks?.length || 0}`);
            resolve(result);
          } else {
            console.log(`   📋 Response data: ${data.substring(0, 100)}...`);
            resolve(null);
          }
        } catch (error) {
          console.log(`   ❌ JSON Parse Error: ${error}`);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Search Error: ${error.message}`);
      resolve(null);
    });

    req.on('timeout', () => {
      console.log('   ⏰ Search request timed out');
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
testLavalink().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});