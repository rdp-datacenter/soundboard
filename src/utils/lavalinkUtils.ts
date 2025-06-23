// src/utils/lavalinkUtils.ts
import { LavalinkManager, Player } from 'lavalink-client';
import { VoiceChannel, GuildMember } from 'discord.js';
import { Requester, HybridTrackMetadata, BotError, ErrorType } from '@/types/Command';

/**
 * Utility class for Lavalink operations
 */
export class LavalinkUtils {
  /**
   * Creates or gets an existing player for a guild
   */
  static async getOrCreatePlayer(
    manager: LavalinkManager,
    guildId: string,
    voiceChannelId: string,
    textChannelId: string
  ): Promise<Player> {
    let player = manager.getPlayer(guildId);
    
    if (!player) {
      player = manager.createPlayer({
        guildId,
        voiceChannelId,
        textChannelId,
        selfDeaf: true,
        selfMute: false
      });
    }
    
    if (!player.connected) {
      await player.connect();
    }
    
    return player;
  }

  /**
   * Validates if a user can use music commands
   */
  static validateMusicCommand(member: GuildMember, voiceChannel?: VoiceChannel): void {
    if (!member.voice.channel) {
      throw new BotError(
        'You need to be in a voice channel to use music commands!',
        ErrorType.VALIDATION_ERROR
      );
    }

    if (voiceChannel && member.voice.channelId !== voiceChannel.id) {
      throw new BotError(
        `You need to be in the same voice channel as the bot! Join <#${voiceChannel.id}>`,
        ErrorType.VALIDATION_ERROR
      );
    }
  }

  /**
   * Searches for tracks using multiple sources
   */
  static async searchTracks(
    manager: LavalinkManager,
    query: string,
    requester: any,
    source: string = 'ytsearch'
  ): Promise<any[]> {
    try {
      // Use the node's search method instead of manager's
      const nodes = Array.from(manager.nodeManager.nodes.values());
      const availableNode = nodes.find(node => node.connected);
      
      if (!availableNode) {
        throw new Error('No available Lavalink nodes');
      }

      const searchResult = await availableNode.search({
        query: `${source}:${query}`,
        source: source.replace('search', '') as any
      }, requester);

      if (!searchResult.tracks || searchResult.tracks.length === 0) {
        return [];
      }

      return searchResult.tracks;
    } catch (error) {
      console.error(`❌ [LAVALINK] Search error for query "${query}":`, error);
      throw new BotError(
        'Failed to search for tracks. Please try again.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Adds a track to the player queue
   */
  static async addTrackToQueue(
    player: Player,
    track: any,
    requester: Requester
  ): Promise<void> {
    try {
      // Transform the requester data for Lavalink
      const transformedTrack = {
        ...track,
        requester: {
          id: requester.id,
          username: requester.username,
          avatarURL: requester.avatarURL
        }
      };

      await player.queue.add(transformedTrack);
      
      // Start playing if not already playing
      if (!player.playing && !player.paused) {
        await player.play();
      }
    } catch (error) {
      console.error('❌ [LAVALINK] Error adding track to queue:', error);
      throw new BotError(
        'Failed to add track to queue.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Sets player volume safely
   */
  static async setPlayerVolume(player: Player, volume: number): Promise<void> {
    try {
      const safeVolume = Math.max(0, Math.min(100, volume));
      await player.setVolume(safeVolume);
    } catch (error) {
      console.error('❌ [LAVALINK] Error setting volume:', error);
      throw new BotError(
        'Failed to set volume.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Safely destroys a player
   */
  static async destroyPlayer(manager: LavalinkManager, guildId: string): Promise<void> {
    try {
      const player = manager.getPlayer(guildId);
      if (player) {
        await manager.destroyPlayer(guildId);
      }
    } catch (error) {
      console.error(`❌ [LAVALINK] Error destroying player for guild ${guildId}:`, error);
    }
  }

  /**
   * Formats track duration from milliseconds
   */
  static formatDuration(ms: number | undefined): string {
    if (!ms || ms === 0) return '0:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Creates a progress bar for track position
   */
  static createProgressBar(current: number, total: number, length: number = 20): string {
    if (total === 0) return '▱'.repeat(length);
    
    const progress = Math.round((current / total) * length);
    const filled = '▰'.repeat(Math.max(0, progress));
    const empty = '▱'.repeat(Math.max(0, length - progress));
    
    return filled + empty;
  }

  /**
   * Validates Lavalink manager availability
   */
  static validateManager(manager: LavalinkManager): void {
    if (!manager) {
      throw new BotError(
        'Lavalink manager is not available.',
        ErrorType.LAVALINK_ERROR
      );
    }

    if (!manager.useable) {
      throw new BotError(
        'Lavalink is not connected. Please try again later.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Gets queue information as a formatted string
   */
  static formatQueue(player: Player, page: number = 1, pageSize: number = 10): {
    content: string;
    totalPages: number;
    currentPage: number;
  } {
    const queue = player.queue.tracks;
    const totalPages = Math.ceil(queue.length / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    
    if (queue.length === 0) {
      return {
        content: 'The queue is empty.',
        totalPages: 0,
        currentPage: 0
      };
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, queue.length);
    
    let content = `**Queue (${queue.length} tracks)**\n\n`;
    
    if (player.queue.current) {
      const current = player.queue.current;
      content += `**Now Playing:**\n🎵 [${current.info.title}](${current.info.uri}) - ${this.formatDuration(current.info.duration)}\n\n`;
    }
    
    content += `**Up Next:**\n`;
    
    for (let i = startIndex; i < endIndex; i++) {
      const track = queue[i];
      const position = i + 1;
      content += `${position}. [${track.info.title}](${track.info.uri}) - ${this.formatDuration(track.info.duration)}\n`;
    }
    
    if (totalPages > 1) {
      content += `\nPage ${currentPage}/${totalPages}`;
    }

    return {
      content,
      totalPages,
      currentPage
    };
  }

  /**
   * Shuffles the player queue
   */
  static async shuffleQueue(player: Player): Promise<void> {
    try {
      await player.queue.shuffle();
    } catch (error) {
      console.error('❌ [LAVALINK] Error shuffling queue:', error);
      throw new BotError(
        'Failed to shuffle queue.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Clears the player queue
   */
  static async clearQueue(player: Player): Promise<void> {
    try {
      await player.queue.splice(0, player.queue.tracks.length);
    } catch (error) {
      console.error('❌ [LAVALINK] Error clearing queue:', error);
      throw new BotError(
        'Failed to clear queue.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Removes a track from the queue by index
   */
  static async removeTrackFromQueue(player: Player, index: number): Promise<any> {
    try {
      const queue = player.queue.tracks;
      
      if (index < 0 || index >= queue.length) {
        throw new BotError(
          `Invalid track index. Please provide a number between 1 and ${queue.length}.`,
          ErrorType.VALIDATION_ERROR
        );
      }

      const removedTrack = await player.queue.splice(index, 1);
      return removedTrack[0];
    } catch (error) {
      if (error instanceof BotError) {
        throw error;
      }
      
      console.error('❌ [LAVALINK] Error removing track from queue:', error);
      throw new BotError(
        'Failed to remove track from queue.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Seeks to a specific position in the current track
   */
  static async seekTrack(player: Player, position: number): Promise<void> {
    try {
      if (!player.queue.current) {
        throw new BotError(
          'No track is currently playing.',
          ErrorType.VALIDATION_ERROR
        );
      }

      const track = player.queue.current;
      if (!track.info.isSeekable) {
        throw new BotError(
          'This track is not seekable.',
          ErrorType.VALIDATION_ERROR
        );
      }

      if (position < 0 || position > track.info.duration) {
        throw new BotError(
          'Invalid seek position.',
          ErrorType.VALIDATION_ERROR
        );
      }

      await player.seek(position);
    } catch (error) {
      if (error instanceof BotError) {
        throw error;
      }
      
      console.error('❌ [LAVALINK] Error seeking track:', error);
      throw new BotError(
        'Failed to seek track.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Sets the repeat mode for the player
   */
  static async setRepeatMode(player: Player, mode: 'off' | 'track' | 'queue'): Promise<void> {
    try {
      await player.setRepeatMode(mode);
    } catch (error) {
      console.error('❌ [LAVALINK] Error setting repeat mode:', error);
      throw new BotError(
        'Failed to set repeat mode.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Pauses or resumes the player
   */
  static async togglePlayback(player: Player): Promise<boolean> {
    try {
      if (player.paused) {
        await player.resume();
        return false; // Not paused anymore
      } else {
        await player.pause();
        return true; // Now paused
      }
    } catch (error) {
      console.error('❌ [LAVALINK] Error toggling playback:', error);
      throw new BotError(
        'Failed to toggle playback.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Skips the current track
   */
  static async skipTrack(player: Player): Promise<any> {
    try {
      if (!player.queue.current) {
        throw new BotError(
          'No track is currently playing.',
          ErrorType.VALIDATION_ERROR
        );
      }

      const currentTrack = player.queue.current;
      await player.skip();
      return currentTrack;
    } catch (error) {
      if (error instanceof BotError) {
        throw error;
      }
      
      console.error('❌ [LAVALINK] Error skipping track:', error);
      throw new BotError(
        'Failed to skip track.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Stops the player and clears the queue
   */
  static async stopPlayer(player: Player): Promise<void> {
    try {
      await player.stopPlaying(true, true);
    } catch (error) {
      console.error('❌ [LAVALINK] Error stopping player:', error);
      throw new BotError(
        'Failed to stop player.',
        ErrorType.LAVALINK_ERROR
      );
    }
  }

  /**
   * Gets detailed player information
   */
  static getPlayerInfo(player: Player): {
    isPlaying: boolean;
    isPaused: boolean;
    volume: number;
    position: number;
    queueLength: number;
    repeatMode: string;
    currentTrack?: any;
  } {
    return {
      isPlaying: player.playing,
      isPaused: player.paused,
      volume: player.volume,
      position: player.position,
      queueLength: player.queue.tracks.length,
      repeatMode: player.repeatMode,
      currentTrack: player.queue.current
    };
  }

  /**
   * Validates if a URL is a valid audio source
   */
  static isValidAudioUrl(url: string): boolean {
    const audioUrlRegex = /^https?:\/\/.+\.(mp3|wav|ogg|flac|aac|m4a|opus|weba)(\?.*)?$/i;
    const streamingRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|spotify\.com|soundcloud\.com)/i;
    
    return audioUrlRegex.test(url) || streamingRegex.test(url);
  }

  /**
   * Extracts platform from URL
   */
  static extractPlatform(url: string): string {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    } else if (url.includes('spotify.com')) {
      return 'spotify';
    } else if (url.includes('soundcloud.com')) {
      return 'soundcloud';
    } else if (url.includes('twitch.tv')) {
      return 'twitch';
    }
    return 'unknown';
  }

  /**
   * Converts search platform to Lavalink source
   */
  static getSearchSource(platform: string): string {
    const sources: Record<string, string> = {
      'youtube': 'ytsearch',
      'youtubemusic': 'ytmsearch',
      'spotify': 'spsearch',
      'soundcloud': 'scsearch',
      'deezer': 'dzsearch',
      'apple': 'amsearch'
    };
    
    return sources[platform.toLowerCase()] || 'ytsearch';
  }

  /**
   * Creates a safe requester object from Discord user/member
   */
  static createRequester(user: any): Requester {
    return {
      id: user.id,
      username: user.username || user.displayName || 'Unknown User',
      discriminator: user.discriminator,
      avatarURL: user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png' }) : undefined
    };
  }

  /**
   * Parses time string to milliseconds (e.g., "1:30", "2m30s")
   */
  static parseTimeToMs(timeStr: string): number {
    // Handle formats like "1:30", "1:30:45"
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':').map(Number);
      if (parts.length === 2) {
        return (parts[0] * 60 + parts[1]) * 1000;
      } else if (parts.length === 3) {
        return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
      }
    }
    
    // Handle formats like "2m30s", "90s", "1h30m"
    const regex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
    const match = timeStr.match(regex);
    
    if (match) {
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      const seconds = parseInt(match[3] || '0');
      
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
    
    // If just a number, assume seconds
    const num = parseInt(timeStr);
    return isNaN(num) ? 0 : num * 1000;
  }

  /**
   * Validates track duration limits
   */
  static validateTrackDuration(durationMs: number, maxDurationMs: number = 3600000): boolean {
    return durationMs > 0 && durationMs <= maxDurationMs;
  }

  /**
   * Gets connection latency to Lavalink node
   */
  static getNodeLatency(manager: LavalinkManager): number {
    try {
      const nodes = Array.from(manager.nodeManager.nodes.values());
      if (nodes.length === 0) return -1;
      
      // Return the latency of the first available node
      const node = nodes.find(n => n.connected);
      if (!node) return -1;
      
      // Check if the node has a ping method or property
      if (typeof (node as any).ping === 'number') {
        return (node as any).ping;
      }
      
      // Fallback: calculate ping from ws if available
      if ((node as any).ws && (node as any).ws.ping) {
        return (node as any).ws.ping;
      }
      
      // Last resort: return -1 if no ping information available
      return -1;
    } catch (error) {
      return -1;
    }
  }

  /**
   * Measures ping to a specific node
   */
  static async measureNodePing(node: any): Promise<number> {
    try {
      const start = Date.now();
      
      // Try to ping the node using a simple stats request
      if (node.rest && typeof node.rest.get === 'function') {
        await node.rest.get('/v4/stats');
        return Date.now() - start;
      }
      
      return -1;
    } catch (error) {
      return -1;
    }
  }

  /**
   * Gets node statistics
   */
  static getNodeStats(manager: LavalinkManager): any[] {
    try {
      const nodes = Array.from(manager.nodeManager.nodes.values());
      return nodes.map(node => {
        let ping = -1;
        
        // Try to get ping from various sources
        if (typeof (node as any).ping === 'number') {
          ping = (node as any).ping;
        } else if ((node as any).ws && (node as any).ws.ping) {
          ping = (node as any).ws.ping;
        }
        
        return {
          id: node.id,
          connected: node.connected,
          ping: ping,
          stats: node.stats || null,
          // Include additional useful stats if available
          players: node.stats?.players || 0,
          playingPlayers: node.stats?.playingPlayers || 0,
          uptime: node.stats?.uptime || 0,
          memory: node.stats?.memory || null,
          cpu: node.stats?.cpu || null
        };
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Auto-reconnects disconnected players after node reconnection
   */
  static async reconnectPlayers(manager: LavalinkManager, guildIds: string[]): Promise<void> {
    for (const guildId of guildIds) {
      try {
        const player = manager.getPlayer(guildId);
        if (player && !player.connected) {
          await player.connect();
          console.log(`🔄 [LAVALINK] Reconnected player for guild: ${guildId}`);
        }
      } catch (error) {
        console.error(`❌ [LAVALINK] Failed to reconnect player for guild ${guildId}:`, error);
      }
    }
  }
}

/**
 * Spotify utility functions
 */
export class SpotifyUtils {
  private static accessToken: string | null = null;
  private static tokenExpiry: number = 0;

  /**
   * Gets or refreshes Spotify access token
   */
  static async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new BotError('Spotify credentials not configured', ErrorType.API_ERROR);
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as { 
        access_token: string; 
        expires_in: number; 
        token_type: string;
      };
      
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute early
      
      return this.accessToken;
    } catch (error) {
      console.error('❌ [SPOTIFY] Token refresh failed:', error);
      throw new BotError('Failed to authenticate with Spotify', ErrorType.SPOTIFY_ERROR);
    }
  }

  /**
   * Extracts track ID from Spotify URL
   */
  static extractTrackId(url: string): string | null {
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * Extracts playlist ID from Spotify URL
   */
  static extractPlaylistId(url: string): string | null {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * Checks if URL is a Spotify URL
   */
  static isSpotifyUrl(url: string): boolean {
    return url.includes('spotify.com/') && (url.includes('/track/') || url.includes('/playlist/') || url.includes('/album/'));
  }
}

export default {
  LavalinkUtils,
  SpotifyUtils
};