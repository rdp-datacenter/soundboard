import 'dotenv/config';
import https from 'https';

// TypeScript interfaces for Spotify API responses
interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

async function testSpotifyConnection() {
  console.log('🎵 Testing Spotify API Connection...\n');

  // Check environment variables
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing Spotify credentials in environment variables');
    console.error('💡 Please add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your .env file');
    console.error('📋 Get credentials from: https://developer.spotify.com/dashboard/applications');
    process.exit(1);
  }

  console.log(`🔑 Client ID: ${clientId.substring(0, 8)}...`);
  console.log(`🔑 Client Secret: ${clientSecret.substring(0, 8)}...\n`);

  try {
    // Test 1: Get access token
    console.log('🔄 Testing Spotify authentication...');
    const accessToken = await getSpotifyAccessToken(clientId, clientSecret);
    console.log('✅ Successfully obtained access token');
    console.log(`🎫 Token: ${accessToken.substring(0, 20)}...\n`);

    // Test 2: Search for a popular song
    console.log('🔄 Testing Spotify search API...');
    const searchQuery = 'never gonna give you up rick astley';
    const searchResult = await searchSpotify(searchQuery, accessToken);
    
    if (searchResult && searchResult.tracks.items.length > 0) {
      console.log('✅ Spotify search successful!');
      const track = searchResult.tracks.items[0];
      console.log(`🎵 Found: "${track.name}" by ${track.artists[0].name}`);
      console.log(`💿 Album: ${track.album.name}`);
      console.log(`⏱️ Duration: ${formatDuration(track.duration_ms)}`);
      console.log(`🔗 Spotify URL: ${track.external_urls.spotify}\n`);
    } else {
      console.log('⚠️ No search results found');
    }

    // Test 3: Test track by ID
    console.log('🔄 Testing Spotify track fetch by ID...');
    const trackId = '4cOdK2wGLETKBW3PvgPWqT'; // Never Gonna Give You Up
    const trackResult = await getSpotifyTrack(trackId, accessToken);
    
    if (trackResult) {
      console.log('✅ Successfully fetched track by ID');
      console.log(`🎵 Track: "${trackResult.name}" by ${trackResult.artists[0].name}\n`);
    } else {
      console.log('⚠️ Could not fetch track by ID');
    }

    // Test 4: Test multiple search results
    console.log('🔄 Testing multiple search results...');
    const multipleResults = await searchSpotifyMultiple('despacito', 5, accessToken);
    
    if (multipleResults && multipleResults.length > 0) {
      console.log(`✅ Found ${multipleResults.length} results for "despacito"`);
      multipleResults.forEach((track, index) => {
        console.log(`   ${index + 1}. "${track.name}" by ${track.artists[0].name}`);
      });
      console.log();
    }

    // Test 5: Test Spotify URL parsing
    console.log('🔄 Testing Spotify URL parsing...');
    const spotifyUrl = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT';
    const urlTrackId = extractSpotifyTrackId(spotifyUrl);
    console.log(`✅ Extracted track ID from URL: ${urlTrackId}\n`);

    console.log('🎉 All Spotify API tests passed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Authentication');
    console.log('   ✅ Search functionality');
    console.log('   ✅ Track fetch by ID');
    console.log('   ✅ Multiple search results');
    console.log('   ✅ URL parsing');

  } catch (error) {
    console.error('\n❌ Spotify API test failed:');
    console.error(error);
    
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        console.error('\n💡 Authentication Error Solutions:');
        console.error('   • Check your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET');
        console.error('   • Verify credentials are correct in Spotify Dashboard');
        console.error('   • Make sure your app is not in development mode restrictions');
      } else if (error.message.includes('403')) {
        console.error('\n💡 Permission Error Solutions:');
        console.error('   • Your Spotify app may need additional permissions');
        console.error('   • Check if your app is approved for Web API usage');
      } else if (error.message.includes('429')) {
        console.error('\n💡 Rate Limit Error Solutions:');
        console.error('   • You are making too many requests');
        console.error('   • Wait a moment and try again');
        console.error('   • Consider implementing rate limiting in your bot');
      }
    }
    
    process.exit(1);
  }
}

// TypeScript interfaces for Spotify API responses
interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

// Get Spotify access token
async function getSpotifyAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const postData = 'grant_type=client_credentials';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'accounts.spotify.com',
      path: '/api/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Spotify auth error: ${res.statusCode} ${res.statusMessage}`));
          return;
        }
        try {
          const response = JSON.parse(data) as SpotifyTokenResponse;
          resolve(response.access_token);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// Search Spotify for tracks
async function searchSpotify(query: string, accessToken: string): Promise<SpotifySearchResponse> {
  const encodedQuery = encodeURIComponent(query);
  const path = `/v1/search?q=${encodedQuery}&type=track&limit=1`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.spotify.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Spotify search error: ${res.statusCode} ${res.statusMessage}`));
          return;
        }
        try {
          const response = JSON.parse(data) as SpotifySearchResponse;
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

// Search Spotify for multiple tracks
async function searchSpotifyMultiple(query: string, limit: number, accessToken: string): Promise<SpotifyTrack[]> {
  const encodedQuery = encodeURIComponent(query);
  const path = `/v1/search?q=${encodedQuery}&type=track&limit=${limit}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.spotify.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Spotify multiple search error: ${res.statusCode} ${res.statusMessage}`));
          return;
        }
        try {
          const response = JSON.parse(data) as SpotifySearchResponse;
          resolve(response.tracks.items);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

// Get specific Spotify track by ID
async function getSpotifyTrack(trackId: string, accessToken: string): Promise<SpotifyTrack> {
  const path = `/v1/tracks/${trackId}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.spotify.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Spotify track fetch error: ${res.statusCode} ${res.statusMessage}`));
          return;
        }
        try {
          const response = JSON.parse(data) as SpotifyTrack;
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

// Extract track ID from Spotify URL
function extractSpotifyTrackId(url: string): string | null {
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Format duration from milliseconds to MM:SS
function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
testSpotifyConnection().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});