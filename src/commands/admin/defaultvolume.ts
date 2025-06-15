import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    GuildMember,
    MessageFlags
  } from 'discord.js';
  import { Command, CommandContext } from '@/types/Command';
  import { PermissionChecker } from '@/utils/permissions';
  
  export const defaultVolumeCommand: Command = {
    data: new SlashCommandBuilder()
      .setName('defaultvolume')
      .setDescription('View or set the default volume for this server')
      .addIntegerOption(option =>
        option.setName('level')
          .setDescription('Default volume level (0-100)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(100)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
    async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
      const { guildId, dbService } = context;
      const member = interaction.member as GuildMember;
      const volumeLevel = interaction.options.getInteger('level');
      
      // If this is not in a guild, we can't manage server settings
      if (guildId === 'global') {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
  
      // If no volume level is provided, just show the current default volume
      if (volumeLevel === null) {
        const settings = await dbService.getServerSettings(guildId);
        const volumePercent = Math.round(settings.defaultVolume * 100);
        
        // Get volume emoji based on current volume
        let volumeEmoji = '🔇';
        if (volumePercent > 66) volumeEmoji = '🔊';
        else if (volumePercent > 33) volumeEmoji = '🔉';
        else if (volumePercent > 0) volumeEmoji = '🔈';
        
        const embed = new EmbedBuilder()
          .setTitle(`${volumeEmoji} Server Default Volume`)
          .setDescription(`The default volume for this server is: **${volumePercent}%**`)
          .addFields(
            { name: '📝 Usage', value: `New sounds will start playing at ${volumePercent}% volume by default`, inline: false },
            { name: '🔄 Change Default', value: `Administrators can change the default with \`/defaultvolume level:75\``, inline: false },
            { name: '📝 Note', value: `Individual sessions can still adjust volume with \`/volume\` or \`${settings.prefix}volume\``, inline: false }
          )
          .setColor(0x00AE86)
          .setTimestamp()
          .setFooter({ text: `${interaction.guild?.name || 'Server'} • Settings` });
  
        await interaction.reply({ embeds: [embed] });
        return;
      }
  
      // Setting a new default volume requires admin permissions
      if (!PermissionChecker.isAdmin(member)) {
        await PermissionChecker.sendPermissionDenied(interaction);
        return;
      }
  
      // Convert percentage to decimal (0.0 - 1.0)
      const newVolume = volumeLevel / 100;
  
      // Update the default volume in the database
      try {
        const oldSettings = await dbService.getServerSettings(guildId);
        const oldVolumePercent = Math.round(oldSettings.defaultVolume * 100);
        
        const updatedSettings = await dbService.updateServerVolume(guildId, newVolume);
        const newVolumePercent = Math.round(updatedSettings.defaultVolume * 100);
        
        // Get volume emoji based on new volume
        let volumeEmoji = '🔇';
        if (newVolumePercent > 66) volumeEmoji = '🔊';
        else if (newVolumePercent > 33) volumeEmoji = '🔉';
        else if (newVolumePercent > 0) volumeEmoji = '🔈';
        
        const embed = new EmbedBuilder()
          .setTitle(`${volumeEmoji} Default Volume Updated`)
          .setDescription(`Server default volume has been updated.`)
          .addFields(
            { name: '🔈 Old Default', value: `${oldVolumePercent}%`, inline: true },
            { name: '🔊 New Default', value: `${newVolumePercent}%`, inline: true },
            { name: '👤 Changed by', value: member.displayName, inline: true },
            { name: '📋 Note', value: `New sound playback will start at ${newVolumePercent}% volume by default`, inline: false }
          )
          .setColor(0x00AE86)
          .setTimestamp()
          .setFooter({ text: `${interaction.guild?.name || 'Server'} • Settings Updated` });
  
        await interaction.reply({ embeds: [embed] });
        
        // Log the volume change
        console.log(`🔄 [DEFAULT_VOLUME] ${member.displayName} (${member.id}) changed default volume for server ${guildId}: ${oldVolumePercent}% → ${newVolumePercent}%`);
      } catch (error) {
        console.error(`❌ [ERROR] Failed to update default volume for server ${guildId}:`, error);
        
        await interaction.reply({
          content: '❌ Failed to update server default volume. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  };