//src/commands/audio/song.ts
import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  GuildMember,
  VoiceChannel,
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { Command, TextCommand, CommandContext } from '@/types/Command';
import { LavalinkUtils } from '@/utils/lavalinkUtils';
import type { SearchResult } from 'lavalink-client';

// TypeScript interfaces for Spotify API responses
interface SpotifyArtist {
  name: string;
  id: string;
}

interface SpotifyAlbum {
  name: string;
  id: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
}

interface SpotifyTrack {
  name: string;
  id: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Simplified metadata interface
interface TrackMetadata {
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
  image?: string;
}

export const songCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('song')
    .setDescription('Search and play music using Spotify metadata + YouTube streaming')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name, artist, or Spotify link')
        .setRequired(true)
        .setAutocomplete(false)
    )
    .addBooleanOption(option =>
      option.setName('search')
        .setDescription('Show multiple results to choose from')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const query = interaction.options.getString('query', true);
    const showSearch = interaction.options.getBoolean('search') || false;
    
    await interaction.deferReply();
    
    if (showSearch) {
      await handleSongSearch(interaction, query, context);
    } else {
      await handleDirectPlay(interaction, query, context);
    }
  }
};

export const songTextCommand: TextCommand = {
  name: 'song',
  
  async execute(message: Message, args: string[], context: CommandContext) {
    const query = args.join(' ').trim();
    if (!query) {
      await message.reply('❌ Please specify a song name! Example: `!song never gonna give you up`');
      return;
    }
    
    // For text commands, always do direct play
    await handleDirectPlay(message, query, context);
  }
};

// Handle direct play (first result)
async function handleDirectPlay(
  source: ChatInputCommandInteraction | Message, 
  query: string, 
  context: CommandContext
): Promise<void> {
  const { lavalinkManager, guildId } = context;
  
  // Get the user's voice channel
  let member: GuildMember;
  let user: any;
  
  if (source instanceof ChatInputCommandInteraction) {
    member = source.member as GuildMember;
    user = source.user;
  } else {
    member = source.member as GuildMember;
    user = source.author;
  }

  const voiceChannel = member.voice.channel as VoiceChannel;
  
  if (!voiceChannel) {
    const errorMsg = '❌ You need to be in a voice channel to play music!';
    if (source instanceof ChatInputCommandInteraction) {
      await source.editReply(errorMsg);
    } else {
      await source.reply(errorMsg);
    }
    return;
  }

  try {
    // Step 1: Search Spotify for metadata
    const spotifyResult = await searchSpotify(query);
    
    if (!spotifyResult) {
      const errorMsg = '❌ No songs found on Spotify for your query.';
      if (source instanceof ChatInputCommandInteraction) {
        await source.editReply(errorMsg);
      } else {
        await source.reply(errorMsg);
      }
      return;
    }

    // Step 2: Search YouTube using Spotify metadata
    const youtubeQuery = `${spotifyResult.artist} ${spotifyResult.name}`;
    const ytSearchResult = await searchYouTube(youtubeQuery, lavalinkManager, user);
    
    if (!ytSearchResult) {
      const errorMsg = '❌ Could not find this song on YouTube.';
      if (source instanceof ChatInputCommandInteraction) {
        await source.editReply(errorMsg);
      } else {
        await source.reply(errorMsg);
      }
      return;
    }

    // Step 3: Play the track
    await playTrack(source, ytSearchResult, spotifyResult, voiceChannel, context);
    
  } catch (error) {
    console.error(`❌ [SONG] Error playing song in server ${guildId}:`, error);
    
    const errorMsg = '❌ Failed to play song. Please try again.';
    if (source instanceof ChatInputCommandInteraction) {
      await source.editReply(errorMsg);
    } else {
      await source.reply(errorMsg);
    }
  }
}

// Handle search with multiple results
async function handleSongSearch(
  interaction: ChatInputCommandInteraction,
  query: string,
  context: CommandContext
): Promise<void> {
  const { lavalinkManager, guildId } = context;
  
  try {
    // Search Spotify for multiple results
    const spotifyResults = await searchSpotifyMultiple(query, 5);
    
    if (!spotifyResults || spotifyResults.length === 0) {
      await interaction.editReply('❌ No songs found on Spotify for your query.');
      return;
    }

    // Create selection embed
    const embed = new EmbedBuilder()
      .setTitle('🎵 Song Search Results')
      .setDescription('Choose a song to play:')
      .setColor(0x1DB954) // Spotify green
      .setTimestamp()
      .setFooter({ text: 'Results from Spotify • Powered by Lavalink' });

    // Add fields for each result
    spotifyResults.forEach((track, index) => {
      const duration = formatDuration(track.duration_ms);
      embed.addFields({
        name: `${index + 1}. ${track.name}`,
        value: `**Artist:** ${track.artists[0].name}\n**Album:** ${track.album.name}\n**Duration:** ${duration}`,
        inline: false
      });
    });

    // Create selection buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>();
    spotifyResults.forEach((_, index) => {
      if (index < 5) { // Max 5 buttons per row
        buttons.addComponents(
          new ButtonBuilder()
            .setCustomId(`song_select_${index}`)
            .setLabel(`${index + 1}`)
            .setStyle(ButtonStyle.Primary)
        );
      }
    });

    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId('song_cancel')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });

    // Handle button interactions
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 // 1 minute
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: 'You can only interact with your own search results!',
          ephemeral: true
        });
        return;
      }

      if (buttonInteraction.customId === 'song_cancel') {
        await buttonInteraction.update({
          content: '❌ Song search cancelled.',
          embeds: [],
          components: []
        });
        return;
      }

      // Extract selection index
      const selectedIndex = parseInt(buttonInteraction.customId.split('_')[2]);
      const selectedTrack = spotifyResults[selectedIndex];

      if (!selectedTrack) {
        await buttonInteraction.update({
          content: '❌ Invalid selection.',
          embeds: [],
          components: []
        });
        return;
      }

      await buttonInteraction.update({
        content: '🔍 Searching YouTube for the selected song...',
        embeds: [],
        components: []
      });

      // Search YouTube and play
      const youtubeQuery = `${selectedTrack.artists[0].name} ${selectedTrack.name}`;
      const ytSearchResult = await searchYouTube(youtubeQuery, lavalinkManager, buttonInteraction.user);
      
      if (!ytSearchResult) {
        await buttonInteraction.editReply('❌ Could not find this song on YouTube.');
        return;
      }

      const member = buttonInteraction.member as GuildMember;
      const voiceChannel = member.voice.channel as VoiceChannel;
      
      if (!voiceChannel) {
        await buttonInteraction.editReply('❌ You need to be in a voice channel to play music!');
        return;
      }

      // Convert Spotify track to our format
      const spotifyMetadata: TrackMetadata = {
        name: selectedTrack.name,
        artist: selectedTrack.artists[0].name,
        album: selectedTrack.album.name,
        duration_ms: selectedTrack.duration_ms,
        external_urls: selectedTrack.external_urls,
        image: selectedTrack.album.images[0]?.url
      };

      await playTrack(buttonInteraction, ytSearchResult, spotifyMetadata, voiceChannel, context);
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (error) {
        // Ignore errors when editing expired interactions
      }
    });

  } catch (error) {
    console.error(`❌ [SONG] Error in search for server ${guildId}:`, error);
    await interaction.editReply('❌ Failed to search for songs. Please try again.');
  }
}

// Play the selected track using Lavalink
async function playTrack(
  source: any,
  youtubeTrack: any,
  spotifyMetadata: TrackMetadata,
  voiceChannel: VoiceChannel,
  context: CommandContext
): Promise<void> {
  const { lavalinkManager, guildId, dbService } = context;

  try {
    // Get or create Lavalink player
    const player = lavalinkManager.getPlayer(guildId) || lavalinkManager.createPlayer({
      guildId: guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId: source.channelId,
      selfDeaf: true,
      selfMute: false
    });

    // Connect to voice channel
    await player.connect();

    // Add track to queue and play
    await player.queue.add(youtubeTrack);
    
    if (!player.playing) {
      await player.play();
    }

    // Get server's default volume
    let playbackVolume = 50; // Default 50%
    try {
      if (guildId !== 'global') {
        const settings = await dbService.getServerSettings(guildId);
        playbackVolume = Math.round(settings.defaultVolume * 100);
        await player.setVolume(playbackVolume);
      }
    } catch (error) {
      console.warn(`⚠️ [DB] Could not get default volume for server ${guildId}:`, error);
    }

    // Create rich embed with both Spotify and YouTube info
    const embed = new EmbedBuilder()
      .setTitle('🎵 Now Playing')
      .setDescription(`**${spotifyMetadata.name}**\nby ${spotifyMetadata.artist}`)
      .addFields(
        { name: '🎤 Artist', value: spotifyMetadata.artist, inline: true },
        { name: '💿 Album', value: spotifyMetadata.album, inline: true },
        { name: '⏱️ Duration', value: formatDuration(spotifyMetadata.duration_ms), inline: true },
        { name: '🔊 Volume', value: `${playbackVolume}%`, inline: true },
        { name: '🎵 Voice Channel', value: voiceChannel.name, inline: true },
        { name: '👤 Requested by', value: source instanceof ChatInputCommandInteraction ? source.user.displayName || source.user.username : source.author.displayName || source.author.username, inline: true },
        { name: '🔗 Source', value: `[Spotify](${spotifyMetadata.external_urls.spotify}) • [YouTube](${youtubeTrack.info?.uri || 'N/A'})`, inline: false }
      )
      .setColor(0x1DB954) // Spotify green
      .setTimestamp()
      .setFooter({ text: 'Spotify metadata • YouTube audio • Lavalink powered' });

    // Add thumbnail if available
    if (spotifyMetadata.image) {
      embed.setThumbnail(spotifyMetadata.image);
    }

    if (source instanceof ChatInputCommandInteraction) {
      await source.editReply({ embeds: [embed] });
    } else {
      await source.editReply({ embeds: [embed] });
    }

    // Log the play for analytics
    try {
      await dbService.logAudioPlay(guildId, spotifyMetadata.name, source.user?.id || source.member?.id);
    } catch (error) {
      console.warn(`⚠️ [DB] Could not log audio play for server ${guildId}:`, error);
    }

    console.log(`🎵 [SONG] Playing in server ${guildId}: ${spotifyMetadata.artist} - ${spotifyMetadata.name}`);

  } catch (error) {
    console.error(`❌ [LAVALINK] Failed to play track in server ${guildId}:`, error);
    
    const errorMsg = '❌ Failed to play the track. Please try again.';
    if (source instanceof ChatInputCommandInteraction) {
      await source.editReply(errorMsg);
    } else {
      await source.reply(errorMsg);
    }
  }
}

// Search Spotify for a single track
async function searchSpotify(query: string): Promise<TrackMetadata | null> {
  try {
    // Check if it's a Spotify URL
    if (query.includes('spotify.com/track/')) {
      // Extract track ID and get track details
      const trackId = query.split('/track/')[1].split('?')[0];
      return await getSpotifyTrack(trackId);
    }

    // Search Spotify
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: {
        'Authorization': `Bearer ${await getSpotifyAccessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json() as SpotifySearchResponse;
    
    if (data.tracks.items.length === 0) {
      return null;
    }

    const track = data.tracks.items[0];
    return {
      name: track.name,
      artist: track.artists[0].name,
      album: track.album.name,
      duration_ms: track.duration_ms,
      external_urls: track.external_urls,
      image: track.album.images[0]?.url
    };

  } catch (error) {
    console.error('❌ [SPOTIFY] Search error:', error);
    return null;
  }
}

// Search Spotify for multiple tracks
async function searchSpotifyMultiple(query: string, limit: number = 5): Promise<SpotifyTrack[] | null> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${await getSpotifyAccessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json() as SpotifySearchResponse;
    return data.tracks.items;

  } catch (error) {
    console.error('❌ [SPOTIFY] Multiple search error:', error);
    return null;
  }
}

// Get specific Spotify track by ID
async function getSpotifyTrack(trackId: string): Promise<TrackMetadata | null> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${await getSpotifyAccessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const track = await response.json() as SpotifyTrack;
    
    return {
      name: track.name,
      artist: track.artists[0].name,
      album: track.album.name,
      duration_ms: track.duration_ms,
      external_urls: track.external_urls,
      image: track.album.images[0]?.url
    };

  } catch (error) {
    console.error('❌ [SPOTIFY] Track fetch error:', error);
    return null;
  }
}

// Get Spotify access token
async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Spotify auth error: ${response.status}`);
  }

  const data = await response.json() as SpotifyTokenResponse;
  return data.access_token;
}

// Search YouTube using Lavalink
async function searchYouTube(query: string, lavalinkManager: any, requester: any): Promise<any | null> {
  try {
    // Use the LavalinkUtils search function for better type safety
    const tracks = await LavalinkUtils.searchTracks(lavalinkManager, query, requester, 'ytsearch');
    
    if (tracks.length === 0) {
      console.log(`🔍 [LAVALINK] No YouTube results found for: ${query}`);
      return null;
    }

    console.log(`✅ [LAVALINK] Found ${tracks.length} YouTube results for: ${query}`);
    return tracks[0]; // Return first result

  } catch (error) {
    console.error('❌ [LAVALINK] YouTube search error:', error);
    return null;
  }
}

// Format duration from milliseconds to MM:SS
function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}