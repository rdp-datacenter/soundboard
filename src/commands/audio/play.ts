import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMember,
  VoiceChannel,
  Message
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioResource,
  VoiceConnectionStatus,
  entersState
} from '@discordjs/voice';
import { Command, TextCommand, CommandContext } from '@/types/Command';
import { S3Service } from '@/utils/s3';

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play an MP3 file in voice channel')
    .addStringOption(option =>
      option.setName('filename')
        .setDescription('Name of the MP3 file to play')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const fileName = interaction.options.getString('filename', true);
    await interaction.deferReply();
    
    const result = await playAudio(interaction, fileName, context);
    if (typeof result === 'string') {
      await interaction.editReply(result);
    }
  }
};

export const playTextCommand: TextCommand = {
  name: 'play',
  
  async execute(message: Message, args: string[], context: CommandContext) {
    const fileName = args.join(' ').trim();
    if (!fileName) {
      await message.reply('❌ Please specify an MP3 file name! Example: `!play filename.mp3`');
      return;
    }
    
    await playAudio(message, fileName, context);
  }
};

export async function handleMention(message: Message, fileName: string, context: CommandContext) {
  if (fileName) {
    await playAudio(message, fileName, context);
  } else {
    await message.reply('Please specify an MP3 file name! Example: `@RDP Soundboard filename.mp3`');
  }
}

async function playAudio(
  source: ChatInputCommandInteraction | Message, 
  fileName: string, 
  context: CommandContext
): Promise<string | void> {
  const { client, audioPlayer, s3Service, currentVolume, setConnection, guildId, dbService } = context;
  
  // Get the user's voice channel
  let member: GuildMember;
  
  if (source instanceof ChatInputCommandInteraction) {
    member = source.member as GuildMember;
  } else {
    member = source.member as GuildMember;
  }

  const voiceChannel = member.voice.channel as VoiceChannel;
  
  if (!voiceChannel) {
    const errorMsg = '❌ You need to be in a voice channel to play music!';
    if (source instanceof ChatInputCommandInteraction) {
      return errorMsg;
    } else {
      await source.reply(errorMsg);
      return;
    }
  }

  // Check if file exists in S3 for this server
  try {
    const fileExists = await s3Service.fileExists(fileName, guildId);
    if (!fileExists) {
      const errorMsg = `❌ File "${fileName}" not found in this server's sound collection! Use \`/list\` to see available files.`;
      if (source instanceof ChatInputCommandInteraction) {
        return errorMsg;
      } else {
        await source.reply(errorMsg);
        return;
      }
    }
  } catch (error) {
    console.error(`❌ [S3] Error checking file existence for server ${guildId}:`, error);
    const errorMsg = '❌ Unable to access cloud storage. Please try again.';
    if (source instanceof ChatInputCommandInteraction) {
      return errorMsg;
    } else {
      await source.reply(errorMsg);
      return;
    }
  }

  try {
    // Join voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    // Update connection in bot context
    setConnection(connection);

    // Wait for connection to be ready
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    // Get server's default volume if available
    let playbackVolume = currentVolume; // Default to current volume
    
    // If in a guild, try to get the server's default volume
    if (guildId !== 'global') {
      try {
        const settings = await dbService.getServerSettings(guildId);
        // Only use default volume if this is a new playback (currentVolume is still at default)
        // This way we don't override manual volume adjustments during a session
        if (currentVolume === 0.5) { // 0.5 is the bot's startup default
          playbackVolume = settings.defaultVolume;
          // Also update the context's currentVolume for future playback
          context.setVolume(settings.defaultVolume);
          console.log(`🔊 [VOLUME] Using server ${guildId} default volume: ${Math.round(settings.defaultVolume * 100)}%`);
        }
      } catch (error) {
        console.warn(`⚠️ [DB] Could not get default volume for server ${guildId}:`, error);
        // Continue with the current volume if there's an error
      }
    }

    // Get file stream from S3
    let audioResource;
    try {
      // Option 1: Stream directly from S3 (recommended for better performance)
      const fileStream = await s3Service.getFileStream(fileName, guildId);
      
      audioResource = createAudioResource(fileStream, {
        inlineVolume: true // Enable volume control
      });
      
      console.log(`🎵 [PLAY] Server ${guildId} streaming: ${fileName}`);
    } catch (streamError) {
      console.error(`❌ [S3] Stream error for server ${guildId}, falling back to URL:`, streamError);
      
      // Option 2: Fallback to public URL streaming
      const fileUrl = s3Service.getServerFileUrl(fileName, guildId);
      
      audioResource = createAudioResource(fileUrl, {
        inlineVolume: true
      });
      
      console.log(`🎵 [PLAY] Server ${guildId} streaming from URL: ${fileUrl}`);
    }
    
    // Set the volume (server default or current volume)
    if (audioResource.volume) {
      audioResource.volume.setVolume(playbackVolume);
    }

    audioPlayer.play(audioResource);
    connection.subscribe(audioPlayer);

    // Get volume emoji based on current volume
    const volumePercent = Math.round(playbackVolume * 100);
    let volumeEmoji = '🔇';
    if (volumePercent > 66) volumeEmoji = '🔊';
    else if (volumePercent > 33) volumeEmoji = '🔉';
    else if (volumePercent > 0) volumeEmoji = '🔈';

    // Get file info for display
    let fileSize = 'Unknown';
    try {
      const fileInfo = await s3Service.getFileInfo(fileName, guildId);
      if (fileInfo) {
        fileSize = `${(fileInfo.size / 1024 / 1024).toFixed(2)} MB`;
      }
    } catch (error) {
      // Don't fail if we can't get file info
      console.warn(`⚠️ [S3] Could not get file info for server ${guildId}:`, error);
    }

    // Get the folder name for display
    const folderName = process.env.S3_FOLDER || 'audio';

    const embed = new EmbedBuilder()
      .setTitle('🎵 Now Playing from Cloud')
      .setDescription(`**${fileName}**`)
      .addFields(
        { name: '🏠 Voice Channel', value: voiceChannel.name, inline: true },
        { name: '👤 Requested by', value: member.displayName, inline: true },
        { name: `${volumeEmoji} Volume`, value: `${volumePercent}%`, inline: true },
        { name: '☁️ Source', value: `AWS S3 (${folderName}/${guildId}/)`, inline: true },
        { name: '📏 File Size', value: fileSize, inline: true },
        { name: '🌐 Streaming', value: 'Global CDN', inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp()
      .setFooter({ text: 'Use /volume to adjust playback volume • Cloud-powered audio' });

    if (source instanceof ChatInputCommandInteraction) {
      await source.editReply({ embeds: [embed] });
    } else {
      await source.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error(`❌ [ERROR] Audio playback failed for server ${guildId}:`, error);
    
    let errorMsg = '❌ Failed to play audio.';
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('stream')) {
        errorMsg += ' (Streaming issue)';
      } else if (error.message.includes('connection')) {
        errorMsg += ' (Voice connection issue)';
      } else if (error.message.includes('timeout')) {
        errorMsg += ' (Connection timeout)';
      }
    }
    
    errorMsg += ' Please try again.';
    
    if (source instanceof ChatInputCommandInteraction) {
      return errorMsg;
    } else {
      await source.reply(errorMsg);
    }
  }
}

// Updated to work with server-specific S3 folders
export async function getAvailableFiles(s3Service: S3Service, guildId: string): Promise<string[]> {
  try {
    const files = await s3Service.listFiles(guildId);
    return files.map(file => file.name).sort();
  } catch (error) {
    console.error(`❌ [S3] Error getting available files for server ${guildId}:`, error);
    return [];
  }
}
