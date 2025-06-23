import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  GuildMember,
  Message,
  MessageFlags
} from 'discord.js';
import { Command, TextCommand, CommandContext } from '@/types/Command';

export const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing audio and leave voice channel'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const member = interaction.member as GuildMember;
    await handleStopCommand(interaction, member, context);
  }
};

export const stopTextCommand: TextCommand = {
  name: 'stop',
  aliases: ['disconnect', 'dc'],
  description: 'Stop playing audio and leave voice channel',
  
  async execute(message: Message, args: string[], context: CommandContext) {
    const member = message.member as GuildMember;
    await handleStopCommand(message, member, context);
  }
};

// Shared logic for both slash and text commands
async function handleStopCommand(
  source: ChatInputCommandInteraction | Message,
  member: GuildMember,
  context: CommandContext
) {
  const { lavalinkManager, guildId } = context;
  
  try {
    // Get the player for this guild
    const player = lavalinkManager.getPlayer(guildId);
    
    if (!player || !player.connected) {
      const errorMsg = '❌ I\'m not currently playing anything or connected to a voice channel!';
      
      if (source instanceof ChatInputCommandInteraction) {
        await source.reply({ 
          content: errorMsg, 
          flags: MessageFlags.Ephemeral 
        });
      } else {
        await source.reply(errorMsg);
      }
      return;
    }
    
    // Stop the player and disconnect
    await player.destroy();
    console.log(`🛑 [STOP] Player destroyed and disconnected from guild ${guildId}`);
    
    const embed = new EmbedBuilder()
      .setTitle('⏹️ Playback Stopped')
      .setDescription('Successfully stopped playing and left the voice channel.')
      .addFields(
        { name: '👤 Stopped by', value: member.displayName, inline: true },
        { name: '🎵 Status', value: 'Disconnected', inline: true }
      )
      .setColor(0xff4444)
      .setTimestamp()
      .setFooter({ text: 'Use /play to start playing again' });

    if (source instanceof ChatInputCommandInteraction) {
      await source.reply({ embeds: [embed] });
    } else {
      await source.reply({ embeds: [embed] });
    }
    
  } catch (error) {
    console.error(`❌ [ERROR] Stop command failed for guild ${guildId}:`, error);
    const errorMsg = '❌ Failed to stop playback. The connection may have already been terminated.';
    
    if (source instanceof ChatInputCommandInteraction) {
      await source.reply({ 
        content: errorMsg, 
        flags: MessageFlags.Ephemeral 
      });
    } else {
      await source.reply(errorMsg);
    }
  }
}