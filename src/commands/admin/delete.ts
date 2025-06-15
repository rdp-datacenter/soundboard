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

export const deleteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete an MP3 file from this server\'s sound collection (Admin only)')
    .addStringOption(option =>
      option.setName('filename')
        .setDescription('Name of the MP3 file to delete')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { s3Service, guildId } = context;
    const member = interaction.member as GuildMember;
    
    // Check admin permissions
    if (!PermissionChecker.isAdmin(member)) {
      await PermissionChecker.sendPermissionDenied(interaction);
      return;
    }

    const filename = interaction.options.getString('filename', true);

    // Check if file exists in S3 for this server
    try {
      const fileExists = await s3Service.fileExists(filename, guildId);
      if (!fileExists) {
        await interaction.reply({
          content: `❌ File **${filename}** not found in this server's sound collection!`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    } catch (error) {
      console.error(`❌ [S3] Error checking file existence for server ${guildId}:`, error);
      await interaction.reply({
        content: '❌ Unable to access cloud storage. Please try again.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Get file info before deletion for the confirmation embed
      let fileInfo = null;
      try {
        fileInfo = await s3Service.getFileInfo(filename, guildId);
      } catch (error) {
        // Continue with deletion even if we can't get file info
        console.warn(`⚠️ [S3] Could not get file info before deletion for server ${guildId}:`, error);
      }

      // Get the folder name for display
      const folderName = process.env.S3_FOLDER || 'audio';

      // Delete the file from S3 for this server
      await s3Service.deleteFile(filename, guildId);
      
      // Log the deletion
      console.log(`🗑️ [DELETE] ${member.displayName} (${member.id}) deleted from server ${guildId}: ${filename}`);
      
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Audio File Deleted')
        .setDescription(`**${filename}** has been removed from this server's sound collection.`)
        .addFields(
          { name: '👤 Deleted by', value: member.displayName, inline: true },
          { name: '📁 File', value: filename, inline: true },
          { name: '☁️ Storage', value: `AWS S3 (${folderName}/${guildId}/)`, inline: true },
          { name: '🏠 Server', value: interaction.guild?.name || guildId, inline: true }
        )
        .setColor(0xff4444)
        .setTimestamp()
        .setFooter({ text: `RDP Datacenter • ${interaction.guild?.name || 'Server'} Sound Collection` });

      // Add file size info if we got it
      if (fileInfo) {
        const fileSizeMB = (fileInfo.size / 1024 / 1024).toFixed(2);
        embed.addFields(
          { name: '📏 File Size', value: `${fileSizeMB} MB`, inline: true },
          { name: '📅 Last Modified', value: fileInfo.lastModified.toLocaleDateString(), inline: true }
        );
      }

      await interaction.editReply({ embeds: [embed] });

      // Update bucket stats for logging
      try {
        const stats = await s3Service.getBucketStats(guildId);
        console.log(`📊 [S3] After deletion - Server ${guildId} stats: ${stats.fileCount} files, ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
      } catch (error) {
        // Don't fail the command if stats fail
        console.error(`⚠️ [S3] Failed to get bucket stats after deletion for server ${guildId}:`, error);
      }
      
    } catch (error) {
      console.error(`❌ [ERROR] S3 Delete failed for server ${guildId}:`, error);
      
      let errorMessage = '❌ Failed to delete file from cloud storage.';
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('credentials')) {
          errorMessage += ' (AWS credentials issue)';
        } else if (error.message.includes('bucket')) {
          errorMessage += ' (S3 bucket access issue)';
        } else if (error.message.includes('permissions')) {
          errorMessage += ' (Insufficient permissions)';
        } else if (error.message.includes('network')) {
          errorMessage += ' (Network connectivity issue)';
        }
      }
      
      errorMessage += ' Please contact the system administrator.';
      
      await interaction.editReply({
        content: errorMessage
      });
    }
  }
};