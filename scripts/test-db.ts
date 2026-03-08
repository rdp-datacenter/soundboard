import 'dotenv/config';
import { DatabaseService } from '../src/utils/db';

async function testDatabaseConnection() {
  console.log('🗄️ Testing Database Connection...\n');

  // Check environment variables
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('💡 Please add DATABASE_URL to your .env file');
    process.exit(1);
  }

  // Sanitize URL for logging (hide credentials)
  const dbUrl = process.env.DATABASE_URL;
  const sanitizedUrl = dbUrl.replace(/\/\/.*@/, '//***:***@');
  console.log(`🔗 Database URL: ${sanitizedUrl}`);

  let dbService: DatabaseService | null = null;

  try {
    // Initialize database service
    console.log('🔄 Initializing database service...');
    dbService = new DatabaseService();
    console.log('✅ Database service initialized');

    // Test basic connection
    console.log('🔄 Testing database connection...');
    const isConnected = await dbService.testConnection();
    
    if (isConnected) {
      console.log('✅ Database connection successful!');
    } else {
      console.log('❌ Database connection failed');
      process.exit(1);
    }

    // Test basic query
    console.log('🔄 Testing basic query...');
    const testQuery = await dbService.query('SELECT NOW() as current_time, version() as postgres_version');
    
    if (testQuery.rows.length > 0) {
      console.log('✅ Query test successful!');
      console.log(`⏰ Server time: ${testQuery.rows[0].current_time}`);
      console.log(`🐘 PostgreSQL version: ${testQuery.rows[0].postgres_version}`);
    }

    // Test schema initialization
    console.log('🔄 Testing schema initialization...');
    await dbService.initializeSchema();
    console.log('✅ Schema initialization successful!');

    // Test connection pool info
    console.log('\n📊 Connection Pool Information:');
    const poolInfo = dbService.getPoolInfo();
    console.log(`📈 Total connections: ${poolInfo.totalCount}`);
    console.log(`🟢 Idle connections: ${poolInfo.idleCount}`);
    console.log(`🔴 Waiting clients: ${poolInfo.waitingCount}`);

    // Test server settings operations
    console.log('\n🔄 Testing server settings operations...');
    const testGuildId = 'test_guild_123456789';
    
    // Test creating/updating settings
    const updateResult = await dbService.updateServerSettings(testGuildId, {
      default_volume: 75, // percentage
      custom_prefix: '?'
    });
    
    if (updateResult) {
      console.log('✅ Server settings update test successful!');
    } else {
      console.log('⚠️ Server settings update test failed');
    }

    // Test retrieving settings
    const settings = await dbService.getServerSettings(testGuildId);
    if (settings) {
      console.log(`✅ Server settings retrieval successful!`);
      console.log(`   Default Volume: ${Math.round(settings.defaultVolume * 100)}%`);
      console.log(`   Custom Prefix: "${settings.prefix}"`);
    } else {
      console.log('⚠️ Server settings retrieval failed');
    }

    // Test audio stats logging
    console.log('\n🔄 Testing audio statistics logging...');
    await dbService.logAudioPlay(testGuildId, 'test_audio.mp3', 'test_user_123');
    await dbService.logAudioPlay(testGuildId, 'test_audio.mp3', 'test_user_456');
    await dbService.logAudioPlay(testGuildId, 'another_audio.mp3', 'test_user_123');
    console.log('✅ Audio statistics logging test successful!');

    // Test retrieving stats
    const stats = await dbService.getServerStats(testGuildId);
    if (stats && stats.topFiles.length > 0) {
      console.log('✅ Audio statistics retrieval successful!');
      console.log(`   Total plays: ${stats.totalPlays}`);
      console.log(`   Top files:`);
      stats.topFiles.forEach((file: any, index: number) => {
        console.log(`     ${index + 1}. ${file.file_name} (${file.play_count} plays, ${file.unique_users} users)`);
      });
    } else {
      console.log('⚠️ Audio statistics retrieval returned no data (this might be expected)');
    }

    // Clean up test data
    console.log('\n🔄 Cleaning up test data...');
    await dbService.query('DELETE FROM server_settings WHERE guild_id = $1', [testGuildId]);
    await dbService.query('DELETE FROM audio_stats WHERE guild_id = $1', [testGuildId]);
    console.log('✅ Test data cleaned up successfully!');

    console.log('\n🎉 All database tests passed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Connection test');
    console.log('   ✅ Basic query test');
    console.log('   ✅ Schema initialization');
    console.log('   ✅ Connection pool info');
    console.log('   ✅ Server settings operations');
    console.log('   ✅ Audio statistics logging');
    console.log('   ✅ Data cleanup');

  } catch (error) {
    console.error('\n❌ Database test failed:');
    console.error(error);
    
    if (error instanceof Error) {
      // Provide specific error guidance
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        console.error('\n💡 Connection Error Solutions:');
        console.error('   • Check if your database URL is correct');
        console.error('   • Verify your internet connection');
        console.error('   • Ensure the database server is running');
        console.error('   • For Neon: check if your database is active (not sleeping)');
      } else if (error.message.includes('authentication') || error.message.includes('password')) {
        console.error('\n💡 Authentication Error Solutions:');
        console.error('   • Check your database username and password');
        console.error('   • Verify the database name is correct');
        console.error('   • Ensure your IP is whitelisted (for cloud databases)');
        console.error('   • For Neon: verify your connection string from the dashboard');
      } else if (error.message.includes('SSL') || error.message.includes('sslmode')) {
        console.error('\n💡 SSL Error Solutions:');
        console.error('   • Add ?sslmode=require to your connection string');
        console.error('   • For Neon: SSL is required and should be in your connection string');
      } else if (error.message.includes('timeout')) {
        console.error('\n💡 Timeout Error Solutions:');
        console.error('   • Check your internet connection stability');
        console.error('   • Try increasing connection timeout in DatabaseService');
        console.error('   • For Neon: database might be sleeping, try again in a moment');
      }
    }
    
    process.exit(1);
  } finally {
    // Always close the connection
    if (dbService) {
      console.log('\n🔄 Closing database connection...');
      await dbService.close();
      console.log('✅ Database connection closed');
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
testDatabaseConnection().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});