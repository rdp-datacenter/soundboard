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

export const cleanupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('Clean up empty or corrupted files from cloud storage (Owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { s3Service } = context;
    const member = interaction.member as GuildMember;
    
    // Check admin permissions (Owner only for destructive actions)
    if (!PermissionChecker.isOwner(member)) {
      await interaction.reply({
        content: '❌ **Access Denied!** This command requires **Server Owner** permissions.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Test S3 connection first
      const s3Connected = await s3Service.testConnection();
      if (!s3Connected) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Cloud Storage Unavailable')
          .setDescription('Unable to connect to cloud storage. Please check AWS configuration.')
          .addFields(
            { name: '🔍 Troubleshooting', value: 'Verify AWS credentials and S3 bucket access', inline: false },
            { name: '⚙️ Configuration', value: 'Check environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME', inline: false }
          )
          .setColor(0xff0000)
          .setTimestamp()
          .setFooter({ text: 'RDP Datacenter • Cloud Storage Error' });
          
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Get initial bucket statistics
      const initialStats = await s3Service.getBucketStats();
      const initialSizeMB = (initialStats.totalSize / 1024 / 1024).toFixed(2);
      
      // Perform cleanup
      const cleanedFiles = await s3Service.cleanupFiles();
      
      // Get updated statistics
      const finalStats = await s3Service.getBucketStats();
      const finalSizeMB = (finalStats.totalSize / 1024 / 1024).toFixed(2);
      const spaceSavedMB = ((initialStats.totalSize - finalStats.totalSize) / 1024 / 1024).toFixed(2);
      
      // Log the cleanup
      console.log(`🧹 [CLEANUP] ${member.displayName} cleaned ${cleanedFiles.length} files from S3, saved ${spaceSavedMB}MB`);
      
      const embed = new EmbedBuilder()
        .setTitle('🧹 Cloud Storage Cleanup Complete')
        .setDescription(`Removed **${cleanedFiles.length}** corrupted or empty files from cloud storage.`)
        .addFields(
          // Cleanup Results
          cleanedFiles.length > 0 ? 
            { name: '🗑️ Deleted Files', value: cleanedFiles.slice(0, 10).join('\n') + (cleanedFiles.length > 10 ? `\n... and ${cleanedFiles.length - 10} more` : '') || 'None', inline: false } :
            { name: '✅ Result', value: 'No cleanup needed - all files are healthy!', inline: false },
          
          // Statistics
          { name: '📊 Before Cleanup', value: `${initialStats.fileCount} files\n${initialSizeMB} MB`, inline: true },
          { name: '📊 After Cleanup', value: `${finalStats.fileCount} files\n${finalSizeMB} MB`, inline: true },
          { name: '💾 Space Saved', value: `${spaceSavedMB} MB`, inline: true },
          
          // Cloud Information
          { name: '☁️ Storage Location', value: 'AWS S3 Cloud Storage', inline: true },
          { name: '🌍 Region', value: process.env.AWS_REGION || 'Unknown', inline: true },
          { name: '👤 Performed by', value: member.displayName, inline: true }
        )
        .setColor(cleanedFiles.length > 0 ? 0xff8800 : 0x00ff00)
        .setTimestamp()
        .setFooter({ text: 'RDP Datacenter • Cloud Cleanup Complete' });

      // Add cost savings estimate if space was saved
      if (parseFloat(spaceSavedMB) > 0) {
        const monthlySavings = calculateMonthlySavings(parseFloat(spaceSavedMB));
        if (monthlySavings > 0.001) {
          embed.addFields(
            { name: '💰 Est. Monthly Savings', value: `$${monthlySavings.toFixed(3)}`, inline: true }
          );
        }
      }

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('❌ [ERROR] S3 Cleanup failed:', error);
      
      let errorMessage = '❌ Failed to perform cloud storage cleanup.';
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('credentials')) {
          errorMessage += '\n🔑 **Issue:** AWS credentials problem';
        } else if (error.message.includes('bucket')) {
          errorMessage += '\n🪣 **Issue:** S3 bucket access problem';
        } else if (error.message.includes('permissions')) {
          errorMessage += '\n🛡️ **Issue:** Insufficient S3 permissions';
        } else if (error.message.includes('network')) {
          errorMessage += '\n🌐 **Issue:** Network connectivity problem';
        }
        errorMessage += '\n\n**Contact your system administrator for assistance.**';
      }
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Cleanup Failed')
        .setDescription(errorMessage)
        .addFields(
          { name: '🔍 Troubleshooting', value: 'Check AWS credentials, S3 permissions, and network connectivity', inline: false },
          { name: '📋 Required Permissions', value: 's3:ListBucket, s3:GetObject, s3:DeleteObject', inline: false }
        )
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: 'RDP Datacenter • Cleanup Error' });
        
      await interaction.editReply({ embeds: [embed] });
    }
  }
};

// Helper function to calculate monthly cost savings
function calculateMonthlySavings(spaceSavedMB: number): number {
  if (spaceSavedMB <= 0) return 0;
  
  // AWS S3 Standard pricing: ~$0.023 per GB per month
  const pricePerGBMonth = 0.023;
  const spaceSavedGB = spaceSavedMB / 1024;
  
  return spaceSavedGB * pricePerGBMonth;
}