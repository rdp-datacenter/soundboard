// src/utils/handleMention.ts
import { Message, EmbedBuilder } from 'discord.js';
import { CommandContext } from '@/types/Command';

/**
 * Handles when the bot is mentioned in a message
 */
export async function handleMention(message: Message, context: CommandContext): Promise<void> {
  try {
    const { client, lavalinkManager } = context;
    
    // Get server prefix (you might need to implement this based on your database structure)
    let prefix = '!'; // Default prefix
    try {
      if (context.dbService && message.guildId) {
        const settings = await context.dbService.getServerSettings(message.guildId);
        prefix = settings.prefix || '!';
      }
    } catch (error) {
      console.warn('Could not get server prefix, using default');
    }

    // Create help embed
    const embed = new EmbedBuilder()
      .setTitle('🎵 RDP Soundboard')
      .setDescription(`Hello! I'm your music bot. Here's how to use me:`)
      .addFields(
        {
          name: '🎶 Music Commands',
          value: [
            `\`${prefix}play <song>\` - Play a song from YouTube/Spotify`,
            `\`${prefix}song <query>\` - Search and play with Spotify metadata`,
            `\`${prefix}skip\` - Skip the current track`,
            `\`${prefix}pause\` - Pause/resume playback`,
            `\`${prefix}queue\` - View the music queue`,
            `\`${prefix}volume <1-100>\` - Set playback volume`
          ].join('\n'),
          inline: false
        },
        {
          name: '🎛️ Control Commands',
          value: [
            `\`${prefix}join\` - Join your voice channel`,
            `\`${prefix}leave\` - Leave the voice channel`,
            `\`${prefix}stop\` - Stop music and clear queue`
          ].join('\n'),
          inline: false
        },
        {
          name: '📁 Audio Files',
          value: [
            `\`${prefix}upload\` - Upload audio files to server`,
            `\`${prefix}sounds\` - List available sounds`,
            `\`${prefix}play <sound_name>\` - Play uploaded sound`
          ].join('\n'),
          inline: false
        }
      )
      .setColor(0x00FF00)
      .setTimestamp()
      .setFooter({ 
        text: `Prefix: ${prefix} | Use slash commands (/) for modern interface`,
        iconURL: client.user?.displayAvatarURL()
      });

    // Add current status if music is playing
    if (message.guildId) {
      const player = lavalinkManager.getPlayer(message.guildId);
      if (player && player.queue.current) {
        embed.addFields({
          name: '🎵 Currently Playing',
          value: `[${player.queue.current.info.title}](${player.queue.current.info.uri})`,
          inline: false
        });
      }
    }

    // Add thumbnail
    if (client.user?.displayAvatarURL()) {
      embed.setThumbnail(client.user.displayAvatarURL());
    }

    await message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('❌ [MENTION] Error handling mention:', error);
    
    // Fallback simple response
    try {
      await message.reply('👋 Hello! Use `!help` for commands or `/play` to start playing music!');
    } catch (replyError) {
      console.error('❌ [MENTION] Failed to send fallback reply:', replyError);
    }
  }
}

/**
 * Checks if a message is a bot mention
 */
export function isBotMention(message: Message, clientId: string): boolean {
  if (message.author.bot) return false;
  
  // Check if message mentions the bot
  const mentionRegex = new RegExp(`^<@!?${clientId}>$`);
  return mentionRegex.test(message.content.trim());
}

/**
 * Handles bot mention with additional context about current status
 */
export async function handleDetailedMention(message: Message, context: CommandContext): Promise<void> {
  try {
    const { client, lavalinkManager, s3Service } = context;
    
    // Get server stats
    let serverStats = {
      sounds: 0,
      totalSize: '0 MB'
    };
    
    try {
      if (message.guildId) {
        // Use existing method or provide fallback
        if (typeof s3Service.getTotalStats === 'function') {
          const stats = await s3Service.getTotalStats();
          serverStats = {
            sounds: stats.fileCount,
            totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`
          };
        } else {
          // Fallback: indicate S3 stats unavailable
          serverStats = {
            sounds: 0,
            totalSize: 'Unavailable'
          };
        }
      }
    } catch (error) {
      console.warn('Could not get server stats:', error);
    }

    // Get player status
    let playerStatus = '⏹️ Not playing';
    let queueInfo = '';
    
    if (message.guildId) {
      const player = lavalinkManager.getPlayer(message.guildId);
      if (player) {
        if (player.queue.current) {
          playerStatus = player.paused ? '⏸️ Paused' : '▶️ Playing';
          queueInfo = `\n**Queue:** ${player.queue.tracks.length} tracks`;
        }
      }
    }

    // Create detailed embed
    const embed = new EmbedBuilder()
      .setTitle('🎵 RDP Soundboard Status')
      .setDescription('Your hybrid music bot with S3 storage + streaming capabilities')
      .addFields(
        {
          name: '📊 Server Statistics',
          value: [
            `**Uploaded Sounds:** ${serverStats.sounds}`,
            `**Storage Used:** ${serverStats.totalSize}`,
            `**Player Status:** ${playerStatus}${queueInfo}`
          ].join('\n'),
          inline: true
        },
        {
          name: '🎯 Quick Start',
          value: [
            '`/play` - Play from YouTube/Spotify',
            '`/song` - Search with metadata',
            '`/upload` - Upload custom sounds',
            '`!help` - Full command list'
          ].join('\n'),
          inline: true
        },
        {
          name: '🌟 Features',
          value: [
            '✅ YouTube & Spotify streaming',
            '✅ Custom audio file uploads',
            '✅ High-quality playback',
            '✅ Queue management',
            '✅ Volume control'
          ].join('\n'),
          inline: false
        }
      )
      .setColor(0x1DB954) // Spotify green
      .setTimestamp()
      .setFooter({ 
        text: 'RDP Soundboard v3.0 - Hybrid Architecture',
        iconURL: client.user?.displayAvatarURL()
      });

    if (client.user?.displayAvatarURL()) {
      embed.setThumbnail(client.user.displayAvatarURL());
    }

    await message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('❌ [DETAILED_MENTION] Error:', error);
    // Fallback to simple mention handler
    await handleMention(message, context);
  }
}

export default {
  handleMention,
  isBotMention,
  handleDetailedMention
};