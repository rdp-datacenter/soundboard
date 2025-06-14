import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  ActivityType
} from 'discord.js';
import {
  createAudioPlayer,
  AudioPlayerStatus
} from '@discordjs/voice';
import fs from 'fs';
import { CommandHandler } from './handlers/commandHandler';
import { BotContext } from './types/Command';

// Bot configuration
const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const AUDIO_FOLDER = './audio'; // Folder to store MP3 files

// Ensure audio folder exists
if (!fs.existsSync(AUDIO_FOLDER)) {
  fs.mkdirSync(AUDIO_FOLDER, { recursive: true });
}

class MusicBot {
  private client: Client;
  private audioPlayer = createAudioPlayer();
  private currentConnection: any = null;
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

  private setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`🎵 ${this.client.user?.tag} is online!`);
      this.client.user?.setActivity('🎵 MP3 memes', { type: ActivityType.Listening });
      
      // Register commands
      this.commandHandler.registerCommands(TOKEN, CLIENT_ID);
      
      // Log loaded commands
      const commands = this.commandHandler.getCommandsList();
      console.log(`📋 Available commands:`, commands);
    });

    // Handle slash commands
    this.client.on('interactionCreate', async (interaction) => {
      const context = this.getContext();
      
      if (interaction.isChatInputCommand()) {
        await this.commandHandler.handleSlashCommand(interaction, context);
      } else if (interaction.isAutocomplete()) {
        await this.commandHandler.handleAutocomplete(interaction, context);
      }
    });

    // Handle text commands and mentions
    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      const context = this.getContext();
      await this.commandHandler.handleTextCommand(message, context);
    });

    // Audio player event handlers
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      console.log('🎵 Audio playback finished');
    });

    this.audioPlayer.on('error', (error) => {
      console.error('❌ Audio player error:', error);
    });
  }

  private getContext(): BotContext {
    return {
      client: this.client,
      audioPlayer: this.audioPlayer,
      currentConnection: this.currentConnection,
      audioFolder: AUDIO_FOLDER,
      setConnection: (connection: any) => {
        this.currentConnection = connection;
      }
    };
  }

  public start() {
    this.client.login(TOKEN);
  }
}

// Start the bot
const bot = new MusicBot();
bot.start();

export default MusicBot;