// src/index.ts
import 'dotenv/config';
import { DatabaseService } from '@/utils/db';
import { S3Service } from '@/utils/s3';
import {
  Client,
  GatewayIntentBits,
  ActivityType,
  Interaction,
  MessageFlags,
  Collection
} from 'discord.js';
import { LavalinkManager, type LavalinkNodeOptions } from 'lavalink-client';
import fs from 'fs';
import { CommandHandler } from '@/handlers/commandHandler';
import { BotContext, CommandContext } from '@/types/Command';
import { handleMention, isBotMention } from '@/utils/handleMention';

// Import the Player type to use proper typing
import type { Player } from 'lavalink-client';

// Spotify API response type
interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

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
  const requiredSpotifyVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'];
  const requiredLavalinkVars = ['LAVALINK_URL', 'LAVALINK_AUTH'];
  
  const missingDiscord = requiredDiscordVars.filter(key => !process.env[key]);
  const missingS3 = requiredS3Vars.filter(key => !process.env[key]);
  const missingDb = requiredDbVars.filter(key => !process.env[key]);
  const missingSpotify = requiredSpotifyVars.filter(key => !process.env[key]);
  const missingLavalink = requiredLavalinkVars.filter(key => !process.env[key]);
  
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

  if (missingSpotify.length > 0) {
    console.error(`❌ Missing required Spotify environment variables: ${missingSpotify.join(', ')}`);
    console.error('💡 Get Spotify credentials from: https://developer.spotify.com/dashboard/applications');
    process.exit(1);
  }

  if (missingLavalink.length > 0) {
    console.error(`❌ Missing required Lavalink environment variables: ${missingLavalink.join(', ')}`);
    console.error('💡 Ensure Lavalink server is configured and LAVALINK_URL/LAVALINK_AUTH are set');
    process.exit(1);
  }

  // Validate and normalize configurations
  const s3Folder = process.env.S3_FOLDER || 'audio';
  console.log(`📁 Audio folder configuration: ${s3Folder}/`);
  console.log(`📁 Server folder pattern: ${s3Folder}/{server_id}/`);
  
  // Log configuration (without sensitive details)
  const dbUrl = process.env.NEON_DB_URL || '';
  const sanitizedDbUrl = dbUrl.replace(/\/\/.*@/, '//***:***@');
  console.log(`🗄️ Database connection: ${sanitizedDbUrl}`);
  
  const lavalinkUrl = process.env.LAVALINK_URL || '';
  const lavalinkAuth = process.env.LAVALINK_AUTH || '';
  console.log(`🎼 Lavalink connection: ${lavalinkUrl} (auth: ${lavalinkAuth.substring(0, 8)}...)`);
  
  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID || '';
  console.log(`🎵 Spotify integration: ${spotifyClientId.substring(0, 8)}...`);
}

// Ensure local audio folder exists (for backward compatibility)
if (!fs.existsSync(AUDIO_FOLDER)) {
  fs.mkdirSync(AUDIO_FOLDER, { recursive: true });
  console.log('📁 Created local audio folder:', AUDIO_FOLDER);
}

class SoundboardBot {
  private client: Client;
  private currentVolume: number = 0.5; // Default 50% volume
  private commandHandler: CommandHandler;
  private s3Service: S3Service;
  private dbService: DatabaseService;
  private lavalinkManager!: LavalinkManager;
  private cooldowns: Collection<string, Collection<string, number>> = new Collection();

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
      
      this.initializeLavalink();
      console.log('🎼 Lavalink Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      process.exit(1);
    }

    this.commandHandler = new CommandHandler();
    this.setupEventHandlers();
  }

  private initializeLavalink(): void {
    // Parse Lavalink configuration
    const lavalinkUrl = process.env.LAVALINK_URL || 'localhost:2333';
    const [host, port] = lavalinkUrl.split(':');
    const lavalinkAuth = process.env.LAVALINK_AUTH || 'youshallnotpass';
    const lavalinkName = process.env.LAVALINK_NAME || 'RDP-Soundboard';
    const lavalinkSecure = process.env.LAVALINK_SECURE === 'true';

    // Initialize Lavalink Manager with proper configuration
    this.lavalinkManager = new LavalinkManager({
      nodes: [{
        host: host,
        port: parseInt(port) || 2333,
        authorization: lavalinkAuth,
        secure: lavalinkSecure,
        id: lavalinkName,
        retryAmount: 5,
        retryDelay: 60000
      } as LavalinkNodeOptions],
      sendToShard: (guildId: string, payload: any) => {
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
          guild.shard.send(payload);
        }
      },
      autoSkip: true,
      queueOptions: {
        maxPreviousTracks: 10
      },
      playerOptions: {
        clientBasedPositionUpdateInterval: 100,
        defaultSearchPlatform: 'ytsearch',
        volumeDecrementer: 0.75,
        requesterTransformer: (requester: any) => {
          if (typeof requester === 'object' && requester.displayAvatarURL) {
            return {
              id: requester.id,
              username: requester.username || requester.displayName,
              avatarURL: requester.displayAvatarURL({ extension: 'png' }),
              discriminator: requester.discriminator
            };
          }
          return {
            id: requester?.toString() || 'unknown',
            username: 'Unknown User'
          };
        }
      }
    });

    // Set up Lavalink event listeners
    // Node events go through the nodeManager
    this.lavalinkManager.nodeManager.on('connect', (node: any) => {
      console.log(`✅ [LAVALINK] Node connected: ${node.id}`);
    });

    this.lavalinkManager.nodeManager.on('disconnect', (node: any, reason: { code?: number; reason?: string }) => {
      console.log(`❌ [LAVALINK] Node disconnected: ${node.id} (${reason.reason || reason.code || 'Unknown'})`);
    });

    this.lavalinkManager.nodeManager.on('error', (node: any, error: any) => {
      console.error(`❌ [LAVALINK] Node error: ${node.id}`, error);
    });

    // Player events go through the lavalinkManager

    this.lavalinkManager.on('playerCreate', (player: Player) => {
      console.log(`🎵 [LAVALINK] Player created for guild: ${player.guildId}`);
    });

    this.lavalinkManager.on('playerDestroy', (player: Player) => {
      console.log(`🛑 [LAVALINK] Player destroyed for guild: ${player.guildId}`);
    });

    this.lavalinkManager.on('trackStart', (player: Player, track: any) => {
      if (track && track.info) {
        console.log(`🎵 [LAVALINK] Track started in guild ${player.guildId}: ${track.info.title}`);
      }
    });

    this.lavalinkManager.on('trackEnd', (player: Player, track: any) => {
      if (track && track.info) {
        console.log(`⏹️ [LAVALINK] Track ended in guild ${player.guildId}: ${track.info.title}`);
      }
    });

    this.lavalinkManager.on('trackError', (player: Player, track: any, payload: any) => {
      console.error(`❌ [LAVALINK] Track error in guild ${player.guildId}:`, payload);
    });

    this.lavalinkManager.on('queueEnd', (player: Player) => {
      console.log(`📭 [LAVALINK] Queue ended in guild ${player.guildId}`);
    });
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(`🎵 ${this.client.user?.tag} is online!`);
      console.log(`🔊 Default volume set to ${Math.round(this.currentVolume * 100)}%`);
      
      // Initialize Lavalink
      try {
        await this.lavalinkManager.init({
          id: this.client.user!.id,
          username: this.client.user!.username
        });
        console.log('🎼 Lavalink initialized and connected');
      } catch (error) {
        console.error('❌ Lavalink initialization failed:', error);
        console.warn('⚠️ Bot will continue with S3 playback only');
      }
      
      // Test S3 connection
      try {
        const s3Connected = await this.s3Service.testConnection();
        if (s3Connected) {
          console.log('☁️ S3 connection successful');
          
          // Get global statistics across all servers
          const totalStats = await this.s3Service.getTotalStats();
          
          console.log(`📊 S3 Stats: ${totalStats.serverCount} servers, ${totalStats.fileCount} total files, ${(totalStats.totalSize / 1024 / 1024).toFixed(2)}MB`);
          
          // Update activity to show capabilities
          this.client.user?.setActivity(`🎵 S3 + Spotify + YouTube | ${totalStats.fileCount} sounds`, { type: ActivityType.Listening });
        } else {
          console.warn('⚠️ S3 connection failed - S3 features disabled');
          this.client.user?.setActivity('🎵 Spotify + YouTube streaming', { type: ActivityType.Listening });
        }
      } catch (error) {
        console.error('❌ S3 connection test failed:', error);
        this.client.user?.setActivity('🎵 Music streaming (S3 offline)', { type: ActivityType.Listening });
      }
      
      // Test Spotify connection
      try {
        const spotifyTest = await this.testSpotifyConnection();
        if (spotifyTest) {
          console.log('🎵 Spotify API connection successful');
        } else {
          console.warn('⚠️ Spotify API connection failed - metadata features limited');
        }
      } catch (error) {
        console.error('❌ Spotify API test failed:', error);
      }
      
      // Register commands
      await this.commandHandler.registerCommands(TOKEN, CLIENT_ID);
      
      // Log loaded commands
      const commands = this.commandHandler.getCommandsList();
      console.log(`📋 Available commands:`, commands);
      
      console.log(`🚀 RDP Soundboard v3.0 is ready with Hybrid Architecture!`);
    });

    // Handle raw Discord events for Lavalink
    this.client.on('raw', (data: any) => {
      this.lavalinkManager.sendRawData(data);
    });

    // Handle all interactions
    this.client.on('interactionCreate', async (interaction: Interaction) => {
      // Extract guild ID or use 'global' if not in a guild
      const guildId = interaction.guildId || 'global';
      const context = this.getContext(guildId);
      
      try {
        if (interaction.isChatInputCommand()) {
          // Check cooldowns
          if (await this.checkCooldown(interaction)) {
            return;
          }
          
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
        
        // Check if the message is just a bot mention
        if (isBotMention(message, this.client.user?.id || '')) {
          await handleMention(message, context);
          return;
        }
        
        // Handle regular text commands
        await this.commandHandler.handleTextCommand(message, context);
      } catch (error) {
        console.error(`❌ Error handling message in server ${guildId}:`, error);
      }
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

  // Check and handle cooldowns
  private async checkCooldown(interaction: any): Promise<boolean> {
    const commandName = interaction.commandName;
    const userId = interaction.user.id;
    const cooldownTime = 3000; // 3 seconds default cooldown

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName)!;
    
    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId)! + cooldownTime;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        await interaction.reply({
          content: `⏰ Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`,
          flags: MessageFlags.Ephemeral
        });
        return true;
      }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownTime);
    return false;
  }

  // Test Spotify API connection
  private async testSpotifyConnection(): Promise<boolean> {
    try {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return false;
      }

      // Get access token
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as SpotifyTokenResponse;
      return !!data.access_token;
      
    } catch (error) {
      console.error('❌ Spotify connection test failed:', error);
      return false;
    }
  }

  // Get context for commands
  private getContext(guildId?: string): CommandContext {
    const contextGuildId = guildId || 'global';
    
    return {
      client: this.client,
      audioFolder: AUDIO_FOLDER,
      currentVolume: this.currentVolume,
      s3Service: this.s3Service,
      dbService: this.dbService,
      lavalinkManager: this.lavalinkManager,
      guildId: contextGuildId,
      currentConnection: null, // Legacy compatibility - not used with Lavalink
      setConnection: (connection: any) => {
        // Legacy compatibility - not used with Lavalink
        console.warn('setConnection is deprecated when using Lavalink');
      },
      setVolume: (volume: number) => {
        this.currentVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        console.log(`🔊 [VOLUME] Volume changed to ${Math.round(this.currentVolume * 100)}%`);
        
        // For Lavalink players, volume is handled per-player
        if (contextGuildId && contextGuildId !== 'global') {
          const player = this.lavalinkManager.getPlayer(contextGuildId);
          if (player) {
            player.setVolume(Math.round(this.currentVolume * 100));
          }
        }
      }
    };
  }

  // Cleanup resources
  private cleanup(): void {
    try {      
      // Cleanup Lavalink
      if (this.lavalinkManager) {
        // Destroy individual players for each guild
        try {
          const guilds = this.client.guilds.cache.keys();
          for (const guildId of guilds) {
            const player = this.lavalinkManager.getPlayer(guildId);
            if (player) {
              this.lavalinkManager.destroyPlayer(guildId);
            }
          }
        } catch (err: any) {
          console.error('❌ Error destroying Lavalink players:', err);
        }
      }
      
      // Close database connection
      this.dbService.close().catch((err: any) => {
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

  // Start the bot
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
console.log(`🚀 Starting RDP Soundboard v3.0 with Hybrid Architecture:`);
console.log(`   📁 S3 Storage: ${folderName}/{server_id}/`);
console.log(`   🎵 Spotify Metadata Search`);
console.log(`   🎼 Lavalink YouTube Streaming`);
console.log(`   🗄️ PostgreSQL Database`);

const bot = new SoundboardBot();

// Handle async start
bot.start().catch(error => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});

export default SoundboardBot;