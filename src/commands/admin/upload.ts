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

export const uploadCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('upload')
    .setDescription('Upload an MP3 file to the bot (Admin only)')
    .addAttachmentOption(option =>
      option.setName('file')
        .setDescription('MP3 file to upload')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { s3Service } = context;
    
    // Double-check admin permissions (extra security)
    const member = interaction.member as GuildMember;
    if (!PermissionChecker.isAdmin(member)) {
      await PermissionChecker.sendPermissionDenied(interaction);
      return;
    }

    const attachment = interaction.options.getAttachment('file', true);
    
    // Validate file type
    if (!attachment.name?.endsWith('.mp3')) {
      await interaction.reply({
        content: '❌ Please upload an MP3 file only!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Validate file size (25MB Discord limit)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (attachment.size > maxSize) {
      await interaction.reply({
        content: `❌ File too large! Maximum size is 25MB. Your file: ${(attachment.size / 1024 / 1024).toFixed(2)}MB`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Check for existing file in S3
    try {
      const fileExists = await s3Service.fileExists(attachment.name);
      if (fileExists) {
        await interaction.reply({
          content: `❌ File **${attachment.name}** already exists in cloud storage! Please rename or delete the existing file first.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    } catch (error) {
      console.error('❌ [S3] Error checking file existence:', error);
      await interaction.reply({
        content: '❌ Unable to check file existence. Please try again.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Download file from Discord
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Upload to S3
      const fileUrl = await s3Service.uploadFile(
        attachment.name, 
        buffer, 
        'audio/mpeg'
      );
      
      // Get the folder name for display
      const folderName = process.env.S3_FOLDER || 'audio';
      
      // Log the upload for audit purposes
      console.log(`📁 [UPLOAD] ${member.displayName} (${member.id}) uploaded to S3 ${folderName}/ folder: ${attachment.name}`);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Audio File Uploaded Successfully!')
        .setDescription(`**${attachment.name}** has been uploaded to RDP Soundboard cloud storage.`)
        .addFields(
          { name: '📁 File Name', value: attachment.name, inline: true },
          { name: '📏 File Size', value: `${(attachment.size / 1024 / 1024).toFixed(2)} MB`, inline: true },
          { name: '👤 Uploaded by', value: member.displayName, inline: true },
          { name: '☁️ Storage', value: `AWS S3 (${folderName}/ folder)`, inline: true },
          { name: '🌐 Access', value: 'Available globally', inline: true },
          { name: '🎵 How to Play', value: `Use \`/play ${attachment.name}\` or \`@RDP Soundboard ${attachment.name}\``, inline: false }
        )
        .setColor(0x00AE86)
        .setTimestamp()
        .setFooter({ text: 'RDP Datacenter • Cloud Upload' });

      await interaction.editReply({ embeds: [embed] });

      // Optional: Get updated file count for logging
      try {
        const stats = await s3Service.getBucketStats();
        console.log(`📊 [S3] Total files: ${stats.fileCount}, Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
      } catch (error) {
        // Don't fail the command if stats fail
        console.error('⚠️ [S3] Failed to get bucket stats:', error);
      }
      
    } catch (error) {
      console.error('❌ [ERROR] S3 Upload failed:', error);
      
      let errorMessage = '❌ Failed to upload file to cloud storage.';
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('credentials')) {
          errorMessage += ' (AWS credentials issue)';
        } else if (error.message.includes('bucket')) {
          errorMessage += ' (S3 bucket access issue)';
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