import 'dotenv/config';
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
const AUDIO_FOLDER = './audio'; // Folder to store MP3 files

// Validate required environment variables
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN is required in .env file');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('❌ CLIENT_ID is required in .env file');
  process.exit(1);
}

// Ensure audio folder exists
if (!fs.existsSync(AUDIO_FOLDER)) {
  fs.mkdirSync(AUDIO_FOLDER, { recursive: true });
  console.log('📁 Created audio folder:', AUDIO_FOLDER);
}

class MusicBot {
  private client: Client;
  private audioPlayer = createAudioPlayer();
  private currentConnection: any = null;
  private currentVolume: number = 0.5; // Default 50% volume
  private commandHandler: CommandHandler;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ]
    });

    this.commandHandler = new CommandHandler();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', () => {
      console.log(`🎵 ${this.client.user?.tag} is online!`);
      console.log(`🔊 Default volume set to ${Math.round(this.currentVolume * 100)}%`);
      this.client.user?.setActivity('🎵 MP3 memes', { type: ActivityType.Listening });
      
      // Register commands
      this.commandHandler.registerCommands(TOKEN, CLIENT_ID);
      
      // Log loaded commands
      const commands = this.commandHandler.getCommandsList();
      console.log(`📋 Available commands:`, commands);
    });

    // Handle all interactions
    this.client.on('interactionCreate', async (interaction: Interaction) => {
      const context = this.getContext();
      
      try {
        if (interaction.isChatInputCommand()) {
          await this.commandHandler.handleSlashCommand(interaction, context);
        } else if (interaction.isAutocomplete()) {
          await this.commandHandler.handleAutocomplete(interaction, context);
        }
      } catch (error) {
        console.error('❌ Error handling interaction:', error);
        
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
      
      try {
        const context = this.getContext();
        await this.commandHandler.handleTextCommand(message, context);
      } catch (error) {
        console.error('❌ Error handling message:', error);
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
      this.client.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down bot...');
      this.client.destroy();
      process.exit(0);
    });
  }

  private getContext(): BotContext {
    return {
      client: this.client,
      audioPlayer: this.audioPlayer,
      currentConnection: this.currentConnection,
      audioFolder: AUDIO_FOLDER,
      currentVolume: this.currentVolume,
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

  public start(): void {
    this.client.login(TOKEN).catch(error => {
      console.error('❌ Failed to login:', error);
      process.exit(1);
    });
  }
}

// Start the bot
const bot = new MusicBot();
bot.start();

export default MusicBot;