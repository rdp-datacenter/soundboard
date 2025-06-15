import 'dotenv/config';
import { S3Service } from '../src/utils/s3';

async function testS3Connection() {
  console.log('🧪 Testing S3 Connection...\n');
  
  try {
    // Initialize S3 service
    console.log('1️⃣ Initializing S3 Service...');
    const s3Service = new S3Service();
    console.log('   ✅ S3 Service initialized');
    
    // Test connection
    console.log('\n2️⃣ Testing S3 Connection...');
    const connected = await s3Service.testConnection();
    if (connected) {
      console.log('   ✅ S3 connection successful');
    } else {
      console.log('   ❌ S3 connection failed');
      return false;
    }

    // Get total statistics across all servers
    console.log('\n3️⃣ Getting Global Bucket Statistics...');
    const totalStats = await s3Service.getTotalStats();
    console.log(`   🏠 Total Servers: ${totalStats.serverCount}`);
    console.log(`   📊 Total Files: ${totalStats.fileCount}`);
    console.log(`   💾 Total Size: ${(totalStats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // List all servers with files
    console.log('\n4️⃣ Listing Servers with Sound Collections...');
    const servers = await s3Service.listServers();
    if (servers.length > 0) {
      console.log(`   🏠 Found ${servers.length} servers:`);
      for (const server of servers.slice(0, 5)) {
        const serverStats = await s3Service.getBucketStats(server);
        console.log(`      • Server ${server}: ${serverStats.fileCount} files (${(serverStats.totalSize / 1024 / 1024).toFixed(2)} MB)`);
      }
      if (servers.length > 5) {
        console.log(`      ... and ${servers.length - 5} more servers`);
      }

      // Display details for first server
      if (servers.length > 0) {
        const firstServer = servers[0];
        console.log(`\n5️⃣ Detailed Files for Server ${firstServer}:`);
        const files = await s3Service.listFiles(firstServer);
        if (files.length > 0) {
          console.log(`   📁 Found ${files.length} files:`);
          files.slice(0, 5).forEach(file => {
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            console.log(`      • ${file.name} (${sizeMB} MB)`);
          });
          if (files.length > 5) {
            console.log(`      ... and ${files.length - 5} more files`);
          }
        } else {
          console.log('   📁 No files found for this server');
        }
      }
    } else {
      console.log('   📁 No servers with sound collections found');
      
      // Test with a sample server ID
      const sampleServerID = '123456789012345678';
      console.log(`\n5️⃣ Testing with Sample Server ID: ${sampleServerID}`);
      const folderPrefix = process.env.S3_FOLDER || 'audio';
      console.log(`   📁 Sample Path: ${folderPrefix}/${sampleServerID}/`);
      console.log(`   🔗 Sample URL: ${process.env.S3_BASE_URL}/${folderPrefix}/${sampleServerID}/example.mp3`);
    }
    
    // Environment info
    console.log('\n📋 Configuration:');
    console.log(`   🪣 Bucket: ${process.env.S3_BUCKET_NAME}`);
    console.log(`   🌍 Region: ${process.env.AWS_REGION}`);
    console.log(`   🔗 Base URL: ${process.env.S3_BASE_URL}`);
    
    const folderName = process.env.S3_FOLDER || 'audio';
    console.log(`   📁 Base Folder: ${folderName}/`);
    console.log(`   🏠 Server Folder Pattern: ${folderName}/{server_id}/`);
    console.log(`   🔗 Sample File URL Pattern: ${process.env.S3_BASE_URL}/${folderName}/{server_id}/filename.mp3`);
    
    console.log('\n🎉 S3 integration test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ S3 Test Failed:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔍 Troubleshooting Tips:');
    
    if (error instanceof Error) {
      if (error.message.includes('credentials')) {
        console.log('   • Check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
        console.log('   • Ensure the IAM user has S3 permissions');
      } else if (error.message.includes('bucket')) {
        console.log('   • Verify the S3_BUCKET_NAME exists and is accessible');
        console.log('   • Check bucket permissions and policies');
      } else if (error.message.includes('region')) {
        console.log('   • Verify the AWS_REGION is correct');
        console.log('   • Ensure the bucket is in the specified region');
      }
    }
    
    console.log('   • Double-check all environment variables in .env file');
    console.log('   • Verify AWS credentials have proper S3 permissions');
    console.log('   • Check network connectivity to AWS');
    
    return false;
  }
}

// Environment validation
function validateEnvironment(): boolean {
  const required = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_REGION',
    'S3_BUCKET_NAME',
    'S3_BASE_URL'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   • ${key}`));
    console.log('\n💡 Make sure your .env file contains all required AWS variables');
    return false;
  }

  // Optional variables
  const folder = process.env.S3_FOLDER || 'audio';
  console.log(`✅ Audio folder configuration: ${folder}/`);
  console.log(`✅ Server folder pattern: ${folder}/{server_id}/`);
  
  return true;
}

// Create a test file for a specific server
async function createTestFile(s3Service: S3Service, serverId: string) {
  console.log(`\n6️⃣ Creating test file for server ${serverId}...`);
  
  try {
    // Create a simple test file
    const testContent = Buffer.from('This is a test file created by the test script');
    const testFileName = `test-${Date.now()}.mp3`;
    
    // Upload the test file
    await s3Service.uploadFile(testFileName, testContent, 'audio/mpeg', serverId);
    console.log(`   ✅ Test file '${testFileName}' created for server ${serverId}`);
    
    // List files to verify
    const files = await s3Service.listFiles(serverId);
    console.log(`   📊 Server now has ${files.length} files`);
    
    // Return the filename so it can be cleaned up if needed
    return testFileName;
  } catch (error) {
    console.error(`   ❌ Failed to create test file: ${error}`);
    return null;
  }
}

// Run the test
async function main() {
  console.log('🚀 RDP Soundboard Multi-Tenant S3 Integration Test\n');
  
  if (!validateEnvironment()) {
    process.exit(1);
  }
  
  const s3Service = new S3Service();
  const success = await testS3Connection();
  
  // Optional: Create a test file for a specific server if requested
  const testServer = process.argv[2];
  if (testServer && success) {
    console.log(`\nCreating test file for server ID: ${testServer}`);
    const testFile = await createTestFile(s3Service, testServer);
    
    if (testFile) {
      console.log(`\n✅ Test file created successfully: ${testFile}`);
      console.log(`👉 To clean up this test file, run: /delete ${testFile} in Discord server ${testServer}`);
    }
  }
  
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});