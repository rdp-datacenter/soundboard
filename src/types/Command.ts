import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  SlashCommandOptionsOnlyBuilder,
  Client, 
  Message 
} from 'discord.js';
import { AudioPlayer } from '@discordjs/voice';

export interface CommandContext {
  client: Client;
  audioPlayer: AudioPlayer;
  currentConnection: any;
  audioFolder: string;
  currentVolume: number;
  setVolume: (volume: number) => void;
  setConnection: (connection: any) => void;
}

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, context: CommandContext) => Promise<void>;
}

export interface TextCommand {
  name: string;
  execute: (message: Message, args: string[], context: CommandContext) => Promise<void>;
}

export interface BotContext extends CommandContext {
}