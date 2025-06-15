import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  SlashCommandOptionsOnlyBuilder,
  Client, 
  Message,
  AutocompleteInteraction
} from 'discord.js';
import { AudioPlayer } from '@discordjs/voice';
import { S3Service } from '@/utils/s3';

export interface CommandContext {
  client: Client;
  audioPlayer: AudioPlayer;
  currentConnection: any;
  audioFolder: string; // Keep for backward compatibility/local fallback
  currentVolume: number;
  setVolume: (volume: number) => void;
  setConnection: (connection: any) => void;
  s3Service: S3Service;
}

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, context: CommandContext) => Promise<void>;
  // Optional autocomplete handler for commands that support it
  autocomplete?: (interaction: AutocompleteInteraction, context: CommandContext) => Promise<void>;
}

export interface TextCommand {
  name: string;
  execute: (message: Message, args: string[], context: CommandContext) => Promise<void>;
}

export interface BotContext extends CommandContext {
}