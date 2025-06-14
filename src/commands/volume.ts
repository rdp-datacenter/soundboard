// src/commands/volume.ts
import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    GuildMember,
    Message 
  } from 'discord.js';
  import { Command, TextCommand, CommandContext } from '@/types/Command';
  
  export const volumeCommand: Command = {
    data: new SlashCommandBuilder()
      .setName('volume')
      .setDescription('Set or check the bot volume')
      .addIntegerOption(option =>
        option.setName('level')
          .setDescription('Volume level (0-100)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(100)
      ),
  
    async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
      const { currentConnection, currentVolume, setVolume } = context;
      const member = interaction.member as GuildMember;
      const volumeLevel = interaction.options.getInteger('level');
  
      await handleVolumeCommand(interaction, member, volumeLevel, currentConnection, currentVolume, setVolume);
    }
  };
  
  export const volumeTextCommand: TextCommand = {
    name: 'volume',
    
    async execute(message: Message, args: string[], context: CommandContext) {
      const { currentConnection, currentVolume, setVolume } = context;
      const member = message.member as GuildMember;
      const volumeLevel = args[0] ? parseInt(args[0]) : null;
  
      // Validate volume level for text command
      if (volumeLevel !== null && (isNaN(volumeLevel) || volumeLevel < 0 || volumeLevel > 100)) {
        await message.reply('❌ Please provide a valid volume level between 0 and 100. Example: `!volume 75`');
        return;
      }
  
      await handleVolumeCommand(message, member, volumeLevel, currentConnection, currentVolume, setVolume);
    }
  };
  
  // Shared logic for both slash and text commands
  async function handleVolumeCommand(
    source: ChatInputCommandInteraction | Message,
    member: GuildMember,
    volumeLevel: number | null,
    currentConnection: any,
    currentVolume: number,
    setVolume: (volume: number) => void
  ) {
    // If no volume level provided, show current volume
    if (volumeLevel === null) {
      const currentVolumePercent = Math.round(currentVolume * 100);
      
      const embed = new EmbedBuilder()
        .setTitle('🔊 Current Volume')
        .setDescription(`Volume is set to **${currentVolumePercent}%**`)
        .addFields(
          { name: '🎵 Status', value: currentConnection ? 'Connected' : 'Not playing', inline: true },
          { name: '👤 Requested by', value: member.displayName, inline: true },
          { name: '📝 Usage', value: 'Use `/volume 75` or `!volume 75` to change', inline: false }
        )
        .setColor(0x00AE86)
        .setTimestamp();
  
      if (source instanceof ChatInputCommandInteraction) {
        await source.reply({ embeds: [embed] });
      } else {
        await source.reply({ embeds: [embed] });
      }
      return;
    }
  
    // Set new volume
    const newVolume = volumeLevel / 100; // Convert percentage to decimal (0.0 - 1.0)
    setVolume(newVolume);
  
    // Get volume status emoji
    let volumeEmoji = '🔇';
    if (volumeLevel > 66) volumeEmoji = '🔊';
    else if (volumeLevel > 33) volumeEmoji = '🔉';
    else if (volumeLevel > 0) volumeEmoji = '🔈';
  
    const embed = new EmbedBuilder()
      .setTitle(`${volumeEmoji} Volume Updated`)
      .setDescription(`Volume set to **${volumeLevel}%**`)
      .addFields(
        { name: '🎵 Previous Volume', value: `${Math.round(currentVolume * 100)}%`, inline: true },
        { name: '🎵 New Volume', value: `${volumeLevel}%`, inline: true },
        { name: '👤 Changed by', value: member.displayName, inline: true }
      )
      .setColor(getVolumeColor(volumeLevel))
      .setTimestamp()
      .setFooter({ text: currentConnection ? 'Volume applied to current playback' : 'Volume will apply to next playback' });
  
    // Log volume change
    console.log(`🔊 [VOLUME] ${member.displayName} changed volume to ${volumeLevel}%`);
  
    if (source instanceof ChatInputCommandInteraction) {
      await source.reply({ embeds: [embed] });
    } else {
      await source.reply({ embeds: [embed] });
    }
  }
  
  // Helper function to get color based on volume level
  function getVolumeColor(volume: number): number {
    if (volume === 0) return 0x666666; // Gray for muted
    if (volume <= 25) return 0x00ff00; // Green for low
    if (volume <= 50) return 0xffff00; // Yellow for medium
    if (volume <= 75) return 0xff8800; // Orange for high
    return 0xff0000; // Red for very high
  }