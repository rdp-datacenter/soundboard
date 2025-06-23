// src/types/Command.ts
import { 
  Client, 
  SlashCommandBuilder, 
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction, 
  Message,
  AutocompleteInteraction
} from 'discord.js';
import { LavalinkManager } from 'lavalink-client';
import { S3Service } from '@/utils/s3';
import { DatabaseService } from '@/utils/db';

// Interfaces and Types (compile-time only)
export interface BotContext {
  client: Client;
  audioFolder: string;
  currentVolume: number;
  s3Service: S3Service;
  dbService: DatabaseService;
  lavalinkManager: LavalinkManager;
  guildId: string;
  setVolume: (volume: number) => void;
}

export interface CommandContext extends BotContext {
  currentConnection?: any; // For legacy compatibility
  setConnection?: (connection: any) => void; // For legacy compatibility
}

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, context?: CommandContext): Promise<void>;
}

export interface TextCommand {
  name: string;
  aliases?: string[];
  description?: string;
  execute(message: Message, args: string[], context: CommandContext): Promise<void>;
}

// Requester interface for track metadata
export interface Requester {
  id: string;
  username: string;
  discriminator?: string;
  avatarURL?: string;
}

// Server settings interface
export interface ServerSettings {
  guildId: string;
  defaultVolume: number;
  prefix?: string;
  djRole?: string;
  musicChannel?: string;
  announceNowPlaying: boolean;
  autoDisconnect: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Audio play log interface
export interface AudioPlayLog {
  id: string;
  guildId: string;
  trackName: string;
  userId: string;
  source: 'spotify' | 'youtube' | 's3' | 'other';
  playedAt: Date;
}

// S3 statistics interface
export interface S3Stats {
  serverCount: number;
  fileCount: number;
  totalSize: number;
}

// Enhanced track metadata for hybrid system
export interface HybridTrackMetadata {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  artworkUrl?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  s3Url?: string;
  source: 'spotify' | 'youtube' | 's3' | 'hybrid';
  requester: Requester;
}

// Player state interface
export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  position: number;
  queue: HybridTrackMetadata[];
  currentTrack?: HybridTrackMetadata;
  repeatMode: 'off' | 'track' | 'queue';
  shuffle: boolean;
}

// Command permissions
export interface CommandPermissions {
  userPermissions?: string[];
  botPermissions?: string[];
  ownerOnly?: boolean;
  guildOnly?: boolean;
  cooldown?: number;
}

// Database query result interfaces
export interface DatabaseQueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// S3 upload result
export interface S3UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  size?: number;
  error?: string;
}

// Lavalink search result wrapper
export interface LavalinkSearchResult {
  tracks: any[];
  loadType: 'track' | 'playlist' | 'search' | 'empty' | 'error';
  playlistInfo?: {
    name: string;
    selectedTrack: number;
  };
  exception?: {
    message: string;
    severity: string;
  };
}

// Event handler interface
export interface EventHandler {
  name: string;
  once?: boolean;
  execute(...args: any[]): Promise<void>;
}

// Bot configuration interface
export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  prefix: string;
  ownerId: string[];
  spotify: {
    clientId: string;
    clientSecret: string;
  };
  lavalink: {
    host: string;
    port: number;
    password: string;
    secure: boolean;
  };
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
    baseUrl: string;
  };
  database: {
    url: string;
  };
}

// Guild configuration interface
export interface GuildConfig {
  guildId: string;
  prefix: string;
  djRole?: string;
  musicChannel?: string;
  volume: number;
  autoDisconnect: boolean;
  announceNowPlaying: boolean;
  allowedChannels: string[];
  bannedUsers: string[];
  maxQueueSize: number;
  maxTrackDuration: number;
}

// Queue item interface for better queue management
export interface QueueItem {
  track: HybridTrackMetadata;
  requester: Requester;
  addedAt: Date;
  priority?: number;
}

// Search options interface
export interface SearchOptions {
  query: string;
  source?: AudioSource;
  limit?: number;
  requester: Requester;
  guildId: string;
}

// Play options interface
export interface PlayOptions {
  track: HybridTrackMetadata | string;
  voiceChannelId: string;
  textChannelId: string;
  requester: Requester;
  volume?: number;
  position?: number;
  noReplace?: boolean;
}

// Utility type for async function results
export type AsyncResult<T> = Promise<{
  success: boolean;
  data?: T;
  error?: string;
}>;

// Enums (runtime values)
export enum CommandCategory {
  AUDIO = 'audio',
  MUSIC = 'music',
  UTILITY = 'utility',
  FUN = 'fun',
  MODERATION = 'moderation',
  CONFIGURATION = 'configuration'
}

export enum AudioSource {
  SPOTIFY = 'spotify',
  YOUTUBE = 'youtube',
  S3 = 's3',
  HYBRID = 'hybrid',
  LOCAL = 'local'
}

export enum PlayerEventType {
  TRACK_START = 'trackStart',
  TRACK_END = 'trackEnd',
  TRACK_STUCK = 'trackStuck',
  TRACK_EXCEPTION = 'trackException',
  QUEUE_END = 'queueEnd',
  PLAYER_CREATE = 'playerCreate',
  PLAYER_DESTROY = 'playerDestroy',
  PLAYER_UPDATE = 'playerUpdate'
}

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  API_ERROR = 'API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  LAVALINK_ERROR = 'LAVALINK_ERROR',
  S3_ERROR = 'S3_ERROR',
  SPOTIFY_ERROR = 'SPOTIFY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Classes (runtime values)
export class BotError extends Error {
  public type: ErrorType;
  public code?: string;
  public statusCode?: number;

  constructor(message: string, type: ErrorType = ErrorType.UNKNOWN_ERROR, code?: string, statusCode?: number) {
    super(message);
    this.name = 'BotError';
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
  }
}