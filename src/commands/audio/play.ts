// src/commands/music/play.ts
import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  GuildMember,
  VoiceChannel,
  Message,
  AutocompleteInteraction
} from 'discord.js';
import { Command, TextCommand, CommandContext } from '@/types/Command';
import { LavalinkUtils, SpotifyUtils } from '@/utils/lavalinkUtils';
import { BotError, ErrorType } from '@/types/Command';

// Type definitions for Spotify API response
interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  external_urls: {
    spotify: string;
  };
}

// Type definition for Lavalink node
interface LavalinkNode {
  connected: boolean;
  search: (params: {
    query: string;
    source: string;
  }, requester: any) => Promise<{
    tracks: any[];
    loadType: string;
  }>;
}

// Type definition for extended client with lavalinkManager
interface ExtendedClient {
  lavalinkManager: {
    nodeManager: {
      nodes: Map<string, LavalinkNode>;
    };
  };
}

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play music from various sources (YouTube, Spotify, SoundCloud, etc.)')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name, artist, URL, or search term')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('source')
        .setDescription('Source to search from')
        .setRequired(false)
        .addChoices(
          { name: 'YouTube', value: 'youtube' },
          { name: 'YouTube Music', value: 'youtubemusic' },
          { name: 'Spotify', value: 'spotify' },
          { name: 'SoundCloud', value: 'soundcloud' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const query = interaction.options.getString('query', true);
    const source = interaction.options.getString('source') || 'youtube';
    
    await interaction.deferReply();
    
    try {
      await handlePlayCommand(interaction, query, source, context);
    } catch (error) {
      if (error instanceof BotError) {
        await interaction.editReply(`❌ ${error.message}`);
      } else {
        console.error('❌ [PLAY] Unexpected error:', error);
        await interaction.editReply('❌ An unexpected error occurred while playing the track.');
      }
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const query = interaction.options.getFocused();
    
    if (!query || query.length < 2) {
      return interaction.respond([]);
    }

    try {
      const extendedClient = interaction.client as any as ExtendedClient;
      const { lavalinkManager } = extendedClient;
      
      // Get an available node for searching
      const nodes = Array.from(lavalinkManager.nodeManager.nodes.values());
      const availableNode = nodes.find((node: LavalinkNode) => node.connected);
      
      if (!availableNode) {
        return interaction.respond([]);
      }

      const searchResult = await availableNode.search({
        query: `ytsearch:${query}`,
        source: 'youtube'
      }, LavalinkUtils.createRequester(interaction.user));

      const choices = searchResult.tracks?.slice(0, 10).map((track: any) => ({
        name: `${track.info.title} - ${track.info.author}`.slice(0, 100),
        value: track.info.uri
      })) || [];

      await interaction.respond(choices);
    } catch (error) {
      console.error('❌ [AUTOCOMPLETE] Error:', error);
      await interaction.respond([]);
    }
  }
};

export const playTextCommand: TextCommand = {
  name: 'play',
  aliases: ['p'],
  
  async execute(message: Message, args: string[], context: CommandContext) {
    const query = args.join(' ').trim();
    if (!query) {
      await message.reply('❌ Please provide a song name, URL, or search term!');
      return;
    }
    
    try {
      await handlePlayCommand(message, query, 'youtube', context);
    } catch (error) {
      if (error instanceof BotError) {
        await message.reply(`❌ ${error.message}`);
      } else {
        console.error('❌ [PLAY] Unexpected error:', error);
        await message.reply('❌ An unexpected error occurred while playing the track.');
      }
    }
  }
};

async function handlePlayCommand(
  source: ChatInputCommandInteraction | Message,
  query: string,
  searchSource: string,
  context: CommandContext
): Promise<void> {
  const { lavalinkManager, guildId, dbService } = context;
  
  // Validate Lavalink manager
  LavalinkUtils.validateManager(lavalinkManager);
  
  // Get member and validate voice channel
  const member = source.member as GuildMember;
  LavalinkUtils.validateMusicCommand(member);
  
  const voiceChannel = member.voice.channel as VoiceChannel;
  const requester = LavalinkUtils.createRequester(source instanceof Message ? source.author : source.user);
  
  // Handle Spotify URLs specially
  if (SpotifyUtils.isSpotifyUrl(query)) {
    await handleSpotifyUrl(source, query, voiceChannel, context, requester);
    return;
  }
  
  // Handle direct URLs
  if (LavalinkUtils.isValidAudioUrl(query)) {
    searchSource = LavalinkUtils.extractPlatform(query);
  }
  
  // Search for tracks
  const searchQuery = LavalinkUtils.isValidAudioUrl(query) ? query : `${LavalinkUtils.getSearchSource(searchSource)}:${query}`;
  const tracks = await LavalinkUtils.searchTracks(lavalinkManager, searchQuery, requester);
  
  if (tracks.length === 0) {
    throw new BotError('No tracks found for your search query.', ErrorType.VALIDATION_ERROR);
  }
  
  // Get or create player
  const player = await LavalinkUtils.getOrCreatePlayer(
    lavalinkManager,
    guildId,
    voiceChannel.id,
    source.channelId
  );
  
  // Add track(s) to queue
  const track = tracks[0];
  await LavalinkUtils.addTrackToQueue(player, track, requester);
  
  // Set volume based on server settings
  try {
    if (guildId !== 'global') {
      const settings = await dbService.getServerSettings(guildId);
      await LavalinkUtils.setPlayerVolume(player, Math.round(settings.defaultVolume * 100));
    }
  } catch (error) {
    console.warn(`⚠️ [DB] Could not get server settings for ${guildId}:`, error);
  }
  
  // Create response embed
  const embed = new EmbedBuilder()
    .setTitle('🎵 Track Added to Queue')
    .setDescription(`**[${track.info.title}](${track.info.uri})**\nby ${track.info.author}`)
    .addFields(
      { name: '⏱️ Duration', value: LavalinkUtils.formatDuration(track.info.duration), inline: true },
      { name: '🎵 Source', value: track.info.sourceName, inline: true },
      { name: '👤 Requested by', value: requester.username, inline: true }
    )
    .setColor(0x00FF00)
    .setTimestamp();
  
  if (track.info.artworkUrl) {
    embed.setThumbnail(track.info.artworkUrl);
  }
  
  // Add queue position if not the next track
  if (player.queue.tracks.length > 1) {
    embed.addFields({
      name: '📋 Queue Position',
      value: `${player.queue.tracks.length}`,
      inline: true
    });
  }
  
  if (source instanceof ChatInputCommandInteraction) {
    await source.editReply({ embeds: [embed] });
  } else {
    await source.reply({ embeds: [embed] });
  }
  
  // Log play for analytics
  try {
    await dbService.logAudioPlay(guildId, track.info.title, requester.id);
  } catch (error) {
    console.warn(`⚠️ [DB] Could not log audio play:`, error);
  }
  
  console.log(`🎵 [PLAY] Added track in ${guildId}: ${track.info.title}`);
}

async function handleSpotifyUrl(
  source: ChatInputCommandInteraction | Message,
  url: string,
  voiceChannel: VoiceChannel,
  context: CommandContext,
  requester: any
): Promise<void> {
  const { lavalinkManager, guildId } = context;
  
  const trackId = SpotifyUtils.extractTrackId(url);
  if (!trackId) {
    throw new BotError('Invalid Spotify URL.', ErrorType.VALIDATION_ERROR);
  }
  
  try {
    // Get Spotify track metadata
    const token = await SpotifyUtils.getAccessToken();
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }
    
    // Properly type the Spotify response
    const spotifyTrack = await response.json() as SpotifyTrack;
    
    // Search for the track on YouTube
    const searchQuery = `${spotifyTrack.artists[0].name} ${spotifyTrack.name}`;
    const tracks = await LavalinkUtils.searchTracks(lavalinkManager, searchQuery, requester, 'ytsearch');
    
    if (tracks.length === 0) {
      throw new BotError('Could not find this Spotify track on YouTube.', ErrorType.VALIDATION_ERROR);
    }
    
    // Get or create player and add track
    const player = await LavalinkUtils.getOrCreatePlayer(
      lavalinkManager,
      guildId,
      voiceChannel.id,
      source.channelId
    );
    
    await LavalinkUtils.addTrackToQueue(player, tracks[0], requester);
    
    // Create enhanced embed with Spotify info
    const embed = new EmbedBuilder()
      .setTitle('🎵 Spotify Track Added')
      .setDescription(`**[${spotifyTrack.name}](${url})**\nby ${spotifyTrack.artists[0].name}`)
      .addFields(
        { name: '💿 Album', value: spotifyTrack.album.name, inline: true },
        { name: '⏱️ Duration', value: LavalinkUtils.formatDuration(spotifyTrack.duration_ms), inline: true },
        { name: '👤 Requested by', value: requester.username, inline: true }
      )
      .setColor(0x1DB954) // Spotify green
      .setTimestamp()
      .setFooter({ text: 'Played via YouTube • Metadata from Spotify' });
    
    if (spotifyTrack.album.images[0]) {
      embed.setThumbnail(spotifyTrack.album.images[0].url);
    }
    
    if (source instanceof ChatInputCommandInteraction) {
      await source.editReply({ embeds: [embed] });
    } else {
      await source.reply({ embeds: [embed] });
    }
    
  } catch (error) {
    console.error('❌ [SPOTIFY] Error processing Spotify URL:', error);
    throw new BotError('Failed to process Spotify URL.', ErrorType.SPOTIFY_ERROR);
  }
}

// Additional music commands

export const skipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    await interaction.deferReply();
    
    try {
      const { lavalinkManager, guildId } = context;
      const member = interaction.member as GuildMember;
      
      LavalinkUtils.validateManager(lavalinkManager);
      LavalinkUtils.validateMusicCommand(member);
      
      const player = lavalinkManager.getPlayer(guildId);
      if (!player) {
        throw new BotError('No music player found.', ErrorType.VALIDATION_ERROR);
      }
      
      const skippedTrack = await LavalinkUtils.skipTrack(player);
      
      const embed = new EmbedBuilder()
        .setTitle('⏭️ Track Skipped')
        .setDescription(`Skipped: **${skippedTrack.info.title}**`)
        .setColor(0xFFFF00)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      if (error instanceof BotError) {
        await interaction.editReply(`❌ ${error.message}`);
      } else {
        console.error('❌ [SKIP] Error:', error);
        await interaction.editReply('❌ Failed to skip track.');
      }
    }
  }
};

export const pauseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause or resume the current track'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    await interaction.deferReply();
    
    try {
      const { lavalinkManager, guildId } = context;
      const member = interaction.member as GuildMember;
      
      LavalinkUtils.validateManager(lavalinkManager);
      LavalinkUtils.validateMusicCommand(member);
      
      const player = lavalinkManager.getPlayer(guildId);
      if (!player) {
        throw new BotError('No music player found.', ErrorType.VALIDATION_ERROR);
      }
      
      const isPaused = await LavalinkUtils.togglePlayback(player);
      
      const embed = new EmbedBuilder()
        .setTitle(isPaused ? '⏸️ Playback Paused' : '▶️ Playback Resumed')
        .setDescription(isPaused ? 'Music has been paused.' : 'Music has been resumed.')
        .setColor(isPaused ? 0xFF8C00 : 0x00FF00)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      if (error instanceof BotError) {
        await interaction.editReply(`❌ ${error.message}`);
      } else {
        console.error('❌ [PAUSE] Error:', error);
        await interaction.editReply('❌ Failed to toggle playback.');
      }
    }
  }
};

export const queueCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View the current music queue')
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number to view')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    await interaction.deferReply();
    
    try {
      const { lavalinkManager, guildId } = context;
      const page = interaction.options.getInteger('page') || 1;
      
      LavalinkUtils.validateManager(lavalinkManager);
      
      const player = lavalinkManager.getPlayer(guildId);
      if (!player) {
        throw new BotError('No music player found.', ErrorType.VALIDATION_ERROR);
      }
      
      const queueInfo = LavalinkUtils.formatQueue(player, page, 10);
      const playerInfo = LavalinkUtils.getPlayerInfo(player);
      
      const embed = new EmbedBuilder()
        .setTitle('🎵 Music Queue')
        .setDescription(queueInfo.content)
        .addFields(
          { name: '🔊 Volume', value: `${playerInfo.volume}%`, inline: true },
          { name: '🔁 Repeat', value: playerInfo.repeatMode, inline: true },
          { name: '📊 Status', value: playerInfo.isPlaying ? 'Playing' : playerInfo.isPaused ? 'Paused' : 'Stopped', inline: true }
        )
        .setColor(0x9370DB)
        .setTimestamp();
      
      if (queueInfo.totalPages > 1) {
        embed.setFooter({ text: `Page ${queueInfo.currentPage}/${queueInfo.totalPages}` });
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      if (error instanceof BotError) {
        await interaction.editReply(`❌ ${error.message}`);
      } else {
        console.error('❌ [QUEUE] Error:', error);
        await interaction.editReply('❌ Failed to get queue information.');
      }
    }
  }
};

export default {
  playCommand,
  playTextCommand,
  skipCommand,
  pauseCommand,
  queueCommand
};