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
  import { DatabaseService } from '@/utils/db';
  
  export const prefixCommand: Command = {
    data: new SlashCommandBuilder()
      .setName('prefix')
      .setDescription('View or set the command prefix for this server')
      .addStringOption(option =>
        option.setName('new_prefix')
          .setDescription('New prefix to use for this server (Admin only)')
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
    async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
      const { guildId, dbService } = context;
      const member = interaction.member as GuildMember;
      const newPrefix = interaction.options.getString('new_prefix');
      
      // If this is not in a guild, we can't manage server settings
      if (guildId === 'global') {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
  
      // If no prefix is provided, just show the current prefix
      if (!newPrefix) {
        const settings = await dbService.getServerSettings(guildId);
        
        const embed = new EmbedBuilder()
          .setTitle('📋 Server Prefix')
          .setDescription(`The current command prefix for this server is: **${settings.prefix}**`)
          .addFields(
            { name: '📝 Usage', value: `Use \`${settings.prefix}play filename.mp3\` to play sounds`, inline: false },
            { name: '🔄 Change Prefix', value: `Administrators can change the prefix with \`/prefix new_prefix:?\``, inline: false }
          )
          .setColor(0x00AE86)
          .setTimestamp()
          .setFooter({ text: `${interaction.guild?.name || 'Server'} • Settings` });
  
        await interaction.reply({ embeds: [embed] });
        return;
      }
  
      // Setting a new prefix requires admin permissions
      if (!PermissionChecker.isAdmin(member)) {
        await PermissionChecker.sendPermissionDenied(interaction);
        return;
      }
  
      // Validate the prefix
      if (newPrefix.length > 5) {
        await interaction.reply({
          content: '❌ Prefix must be 5 characters or less.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
  
      // Update the prefix in the database
      try {
        const oldSettings = await dbService.getServerSettings(guildId);
        const updatedSettings = await dbService.updateServerPrefix(guildId, newPrefix);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Prefix Updated')
          .setDescription(`Server command prefix has been updated.`)
          .addFields(
            { name: '📝 Old Prefix', value: oldSettings.prefix, inline: true },
            { name: '📝 New Prefix', value: updatedSettings.prefix, inline: true },
            { name: '👤 Changed by', value: member.displayName, inline: true },
            { name: '📋 Example', value: `Use \`${updatedSettings.prefix}play filename.mp3\` to play sounds`, inline: false }
          )
          .setColor(0x00AE86)
          .setTimestamp()
          .setFooter({ text: `${interaction.guild?.name || 'Server'} • Settings Updated` });
  
        await interaction.reply({ embeds: [embed] });
        
        // Log the prefix change
        console.log(`🔄 [PREFIX] ${member.displayName} (${member.id}) changed prefix for server ${guildId}: ${oldSettings.prefix} → ${updatedSettings.prefix}`);
      } catch (error) {
        console.error(`❌ [ERROR] Failed to update prefix for server ${guildId}:`, error);
        
        await interaction.reply({
          content: '❌ Failed to update server prefix. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  };