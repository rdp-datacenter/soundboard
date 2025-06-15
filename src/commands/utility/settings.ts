import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder,
    MessageFlags
  } from 'discord.js';
  import { Command, CommandContext } from '@/types/Command';
  
  export const settingsCommand: Command = {
    data: new SlashCommandBuilder()
      .setName('settings')
      .setDescription('View all settings for this server'),
  
    async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
      const { guildId, dbService, s3Service } = context;
      
      // If this is not in a guild, we can't show server settings
      if (guildId === 'global') {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
  
      await interaction.deferReply();
  
      try {
        // Get server settings from database
        const settings = await dbService.getServerSettings(guildId);
        
        // Get sound collection statistics
        const stats = await s3Service.getBucketStats(guildId);
        const totalSizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
        
        // Get volume emoji based on default volume
        const volumePercent = Math.round(settings.defaultVolume * 100);
        let volumeEmoji = '🔇';
        if (volumePercent > 66) volumeEmoji = '🔊';
        else if (volumePercent > 33) volumeEmoji = '🔉';
        else if (volumePercent > 0) volumeEmoji = '🔈';
        
        // Get the folder name for display
        const folderName = process.env.S3_FOLDER || 'audio';
        
        // Get server join date
        const serverCreatedDate = interaction.guild?.createdAt.toLocaleDateString() || 'Unknown';
        const settingsCreatedDate = settings.createdAt.toLocaleDateString();
        
        const embed = new EmbedBuilder()
          .setTitle(`⚙️ ${interaction.guild?.name || 'Server'} Settings`)
          .setDescription(`Settings and statistics for this server.`)
          .addFields(
            // Command Settings
            { name: '📝 Command Prefix', value: `\`${settings.prefix}\``, inline: true },
            { name: `${volumeEmoji} Default Volume`, value: `${volumePercent}%`, inline: true },
            { name: '📅 Settings Created', value: settingsCreatedDate, inline: true },
            
            // Sound Collection
            { name: '🎵 Sound Collection', value: `${stats.fileCount} files (${totalSizeMB} MB)`, inline: true },
            { name: '📁 Storage Path', value: `${folderName}/${guildId}/`, inline: true },
            { name: '📅 Server Created', value: serverCreatedDate, inline: true },
            
            // Management Commands
            { name: '⚙️ Management Commands', value: 
              `• \`/prefix\` - Change command prefix\n` +
              `• \`/defaultvolume\` - Set default volume\n` +
              `• \`/upload\` - Add sounds to collection\n` +
              `• \`/list\` - View available sounds\n` +
              `• \`/stats\` - View detailed statistics`
            }
          )
          .setColor(0x00AE86)
          .setTimestamp()
          .setFooter({ text: `Server ID: ${guildId} • RDP Soundboard` });
          
        // Add server icon if available
        if (interaction.guild?.iconURL()) {
          embed.setThumbnail(interaction.guild.iconURL());
        }
  
        await interaction.editReply({ embeds: [embed] });
        
      } catch (error) {
        console.error(`❌ [ERROR] Failed to get settings for server ${guildId}:`, error);
        
        await interaction.editReply({
          content: '❌ Failed to retrieve server settings. Please try again later.'
        });
      }
    }
  };