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
    
    // Get bucket statistics
    console.log('\n3️⃣ Getting Bucket Statistics...');
    const stats = await s3Service.getBucketStats();
    console.log(`   📊 Files: ${stats.fileCount}`);
    console.log(`   💾 Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // List files
    console.log('\n4️⃣ Listing Files...');
    const files = await s3Service.listFiles();
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
      console.log('   📁 No files found in bucket');
    }
    
    // Environment info
    console.log('\n📋 Configuration:');
    console.log(`   🪣 Bucket: ${process.env.S3_BUCKET_NAME}`);
    console.log(`   🌍 Region: ${process.env.AWS_REGION}`);
    console.log(`   🔗 Base URL: ${process.env.S3_BASE_URL}`);
    
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
  
  return true;
}

// Run the test
async function main() {
  console.log('🚀 RDP Soundboard S3 Integration Test\n');
  
  if (!validateEnvironment()) {
    process.exit(1);
  }
  
  const success = await testS3Connection();
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});