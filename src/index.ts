import 'dotenv/config';
import { DatabaseService } from '@/utils/db';
import { S3Service } from '@/utils/s3';
import {
  Client,
  GatewayIntentBits,
  ActivityType,
  Interaction,
  MessageFlags
} from 'discord.js';
import {
  createAudioPlayer,
  AudioPlayerStatus
} from '@discordjs/voice';
import fs from 'fs';
import { CommandHandler } from '@/handlers/commandHandler';
import { BotContext } from '@/types/Command';

// Bot configuration
const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const AUDIO_FOLDER = './audio'; // Keep for backward compatibility/local fallback

// Validate required environment variables
function validateEnvironment(): void {
  const requiredDiscordVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
  const requiredS3Vars = [
    'AWS_ACCESS_KEY_ID', 
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_REGION', 
    'S3_BUCKET_NAME', 
    'S3_BASE_URL'
  ];
  const requiredDbVars = ['NEON_DB_URL'];
  
  const missingDiscord = requiredDiscordVars.filter(key => !process.env[key]);
  const missingS3 = requiredS3Vars.filter(key => !process.env[key]);
  const missingDb = requiredDbVars.filter(key => !process.env[key]);
  
  if (missingDiscord.length > 0) {
    console.error(`❌ Missing required Discord environment variables: ${missingDiscord.join(', ')}`);
    process.exit(1);
  }
  
  if (missingS3.length > 0) {
    console.error(`❌ Missing required AWS S3 environment variables: ${missingS3.join(', ')}`);
    console.error('💡 For S3 integration, ensure all AWS variables are set in your .env file');
    process.exit(1);
  }

  if (missingDb.length > 0) {
    console.error(`❌ Missing required Database environment variables: ${missingDb.join(', ')}`);
    console.error('💡 For database integration, ensure NEON_DB_URL is set in your .env file');
    process.exit(1);
  }

  // Validate and normalize audio folder configuration
  const s3Folder = process.env.S3_FOLDER || 'audio';
  console.log(`📁 Audio folder configuration: ${s3Folder}/`);
  console.log(`📁 Server folder pattern: ${s3Folder}/{server_id}/`);
  
  // Ensure S3_FOLDER ends with '/' in environment for consistency
  if (process.env.S3_FOLDER && !process.env.S3_FOLDER.endsWith('/')) {
    process.env.S3_FOLDER = `${process.env.S3_FOLDER}/`;
    console.log(`📁 Normalized S3_FOLDER to: ${process.env.S3_FOLDER}`);
  }

  // Log database connection (without sensitive details)
  const dbUrl = process.env.NEON_DB_URL || '';
  const sanitizedDbUrl = dbUrl.replace(/\/\/.*@/, '//***:***@');
  console.log(`🗄️ Database connection: ${sanitizedDbUrl}`);
}


// Ensure local audio folder exists (for backward compatibility)
if (!fs.existsSync(AUDIO_FOLDER)) {
  fs.mkdirSync(AUDIO_FOLDER, { recursive: true });
  console.log('📁 Created local audio folder:', AUDIO_FOLDER);
}

class CloudSoundboardBot {
  private client: Client;
  private audioPlayer = createAudioPlayer();
  private currentConnection: any = null;
  private currentVolume: number = 0.5; // Default 50% volume
  private commandHandler: CommandHandler;
  private s3Service: S3Service;
  private dbService: DatabaseService; // Add database service

  constructor() {
    // Validate environment before initialization
    validateEnvironment();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ]
    });

    // Initialize services
    try {
      this.s3Service = new S3Service();
      console.log('☁️ S3 Service initialized successfully');
      
      this.dbService = new DatabaseService();
      console.log('🗄️ Database Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      process.exit(1);
    }

    this.commandHandler = new CommandHandler();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(`🎵 ${this.client.user?.tag} is online!`);
      console.log(`🔊 Default volume set to ${Math.round(this.currentVolume * 100)}%`);
      
      // Test S3 connection
      try {
        const s3Connected = await this.s3Service.testConnection();
        if (s3Connected) {
          console.log('☁️ S3 connection successful');
          
          // Get global statistics across all servers
          const totalStats = await this.s3Service.getTotalStats();
          const folderName = process.env.S3_FOLDER || 'audio';
          
          console.log(`📊 S3 Stats: ${totalStats.serverCount} servers, ${totalStats.fileCount} total files, ${(totalStats.totalSize / 1024 / 1024).toFixed(2)}MB`);
          
          // List all servers to display in the logs
          const servers = await this.s3Service.listServers();
          if (servers.length > 0) {
            console.log(`🏠 Servers with sound collections: ${servers.length}`);
            
            // Update activity to show total files across all servers
            this.client.user?.setActivity(`🎵 ${totalStats.fileCount} sounds across ${totalStats.serverCount} servers`, { type: ActivityType.Listening });
          } else {
            console.log('📂 No servers with sound collections found yet');
            this.client.user?.setActivity(`🎵 Ready for sounds`, { type: ActivityType.Listening });
          }
        } else {
          console.warn('⚠️ S3 connection failed - some features may not work');
          this.client.user?.setActivity('🎵 Cloud sounds (offline)', { type: ActivityType.Listening });
        }
      } catch (error) {
        console.error('❌ S3 connection test failed:', error);
        this.client.user?.setActivity('🎵 Sounds (S3 error)', { type: ActivityType.Listening });
      }
      
      // Register commands
      await this.commandHandler.registerCommands(TOKEN, CLIENT_ID);
      
      // Log loaded commands
      const commands = this.commandHandler.getCommandsList();
      console.log(`📋 Available commands:`, commands);
      
      // Get the folder name for display
      const folderName = process.env.S3_FOLDER || 'audio';
      console.log(`🚀 RDP Soundboard is ready with cloud storage in ${folderName}/{server_id}/ folders!`);
    });

    // Handle all interactions
    this.client.on('interactionCreate', async (interaction: Interaction) => {
      // Extract guild ID or use 'global' if not in a guild
      const guildId = interaction.guildId || 'global';
      const context = this.getContext(guildId);
      
      try {
        if (interaction.isChatInputCommand()) {
          await this.commandHandler.handleSlashCommand(interaction, context);
        } else if (interaction.isAutocomplete()) {
          await this.commandHandler.handleAutocomplete(interaction, context);
        }
      } catch (error) {
        console.error(`❌ Error handling interaction in server ${guildId}:`, error);
        
        // Try to respond with an error if the interaction hasn't been replied to
        if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({
              content: '❌ An error occurred while processing your command.',
              flags: MessageFlags.Ephemeral
            });
          } catch (replyError) {
            console.error('❌ Failed to send error response:', replyError);
          }
        }
      }
    });

    // Handle text commands and mentions
    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // Extract guild ID or use 'global' if not in a guild
      const guildId = message.guildId || 'global';
      
      try {
        const context = this.getContext(guildId);
        await this.commandHandler.handleTextCommand(message, context);
      } catch (error) {
        console.error(`❌ Error handling message in server ${guildId}:`, error);
      }
    });

    // Audio player event handlers
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      console.log('🎵 Audio playback finished');
    });

    this.audioPlayer.on('error', (error) => {
      console.error('❌ Audio player error:', error);
    });

    // Handle process termination gracefully
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down bot...');
      this.cleanup();
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down bot...');
      this.cleanup();
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      this.cleanup();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  // Update getContext to include the database service
  private getContext(guildId?: string): BotContext {
    return {
      client: this.client,
      audioPlayer: this.audioPlayer,
      currentConnection: this.currentConnection,
      audioFolder: AUDIO_FOLDER, // Keep for backward compatibility
      currentVolume: this.currentVolume,
      s3Service: this.s3Service,
      dbService: this.dbService, // Add database service to context
      guildId: guildId || 'global',
      setConnection: (connection: any) => {
        this.currentConnection = connection;
      },
      setVolume: (volume: number) => {
        this.currentVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        console.log(`🔊 [VOLUME] Volume changed to ${Math.round(this.currentVolume * 100)}%`);
        
        // If currently playing, update the volume immediately
        if (this.currentConnection && this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
          const resource = (this.audioPlayer.state as any).resource;
          if (resource && resource.volume) {
            resource.volume.setVolume(this.currentVolume);
          }
        }
      }
    };
  }

  // Update cleanup to close the database connection
  private cleanup(): void {
    try {
      // Stop audio playback
      if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
        this.audioPlayer.stop();
      }
      
      // Destroy voice connection
      if (this.currentConnection) {
        this.currentConnection.destroy();
      }
      
      // Close database connection
      this.dbService.close().catch(err => {
        console.error('❌ Error closing database connection:', err);
      });
      
      // Destroy Discord client
      this.client.destroy();
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    } finally {
      process.exit(0);
    }
  }

  // Add the missing start method
  public async start(): Promise<void> {
    try {
      console.log('🔐 Logging into Discord...');
      await this.client.login(TOKEN);
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }
}

// Start the bot
const folderName = process.env.S3_FOLDER || 'audio';
console.log(`🚀 Starting RDP Soundboard with Multi-Tenant Cloud Storage (${folderName}/{server_id}/)...`);
const bot = new CloudSoundboardBot();

// Handle async start
bot.start().catch(error => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});

export default CloudSoundboardBot;