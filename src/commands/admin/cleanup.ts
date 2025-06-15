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
    .addBooleanOption(option =>
      option.setName('global')
        .setDescription('Clean up files across all servers (default: this server only)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { s3Service, guildId } = context;
    const member = interaction.member as GuildMember;
    const cleanGlobal = interaction.options.getBoolean('global') || false;
    
    // Check admin permissions (Owner only for destructive actions)
    if (cleanGlobal && !PermissionChecker.isOwner(member)) {
      await interaction.reply({
        content: '❌ **Access Denied!** Global cleanup requires **Bot Owner** permissions.',
        flags: MessageFlags.Ephemeral
      });
      return;
    } else if (!cleanGlobal && !PermissionChecker.isAdmin(member)) {
      await interaction.reply({
        content: '❌ **Access Denied!** Server cleanup requires **Administrator** permissions.',
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

      // Get the folder name for display
      const folderName = process.env.S3_FOLDER || 'audio';

      let totalCleanedFiles = 0;
      let totalSpaceSaved = 0;
      let cleanedFilesList: string[] = [];

      if (cleanGlobal) {
        // Global cleanup across all servers
        const servers = await s3Service.listServers();
        
        // Get initial stats for comparison
        let initialTotalStats = await s3Service.getTotalStats();
        let initialTotalSize = initialTotalStats.totalSize;
        
        // Perform cleanup on each server
        for (const serverId of servers) {
          // Get guild name if available
          const guild = interaction.client.guilds.cache.get(serverId);
          const serverName = guild ? guild.name : serverId;
          
          // Cleanup this server
          const serverCleanedFiles = await s3Service.cleanupFiles(serverId);
          if (serverCleanedFiles.length > 0) {
            totalCleanedFiles += serverCleanedFiles.length;
            cleanedFilesList.push(`**${serverName}**: ${serverCleanedFiles.length} files`);
            
            // Log server-specific cleanup
            console.log(`🧹 [CLEANUP] ${member.displayName} cleaned ${serverCleanedFiles.length} files from server ${serverId}`);
          }
        }
        
        // Calculate space saved
        const finalTotalStats = await s3Service.getTotalStats();
        totalSpaceSaved = initialTotalSize - finalTotalStats.totalSize;
        
        // Log the global cleanup
        console.log(`🧹 [GLOBAL CLEANUP] ${member.displayName} cleaned ${totalCleanedFiles} files across ${servers.length} servers, saved ${(totalSpaceSaved / 1024 / 1024).toFixed(2)}MB`);
        
        const embed = new EmbedBuilder()
          .setTitle('🧹 Global Cloud Storage Cleanup Complete')
          .setDescription(`Removed **${totalCleanedFiles}** corrupted or empty files across **${servers.length}** servers.`)
          .addFields(
            // Cleanup Results
            totalCleanedFiles > 0 ? 
              { name: '🗑️ Cleaned Servers', value: cleanedFilesList.join('\n') || 'None', inline: false } :
              { name: '✅ Result', value: 'No cleanup needed - all files are healthy!', inline: false },
            
            // Statistics
            { name: '📊 Servers Scanned', value: servers.length.toString(), inline: true },
            { name: '📊 Files Cleaned', value: totalCleanedFiles.toString(), inline: true },
            { name: '💾 Space Saved', value: `${(totalSpaceSaved / 1024 / 1024).toFixed(2)} MB`, inline: true },
            
            // Cloud Information
            { name: '☁️ Storage Location', value: 'AWS S3 Cloud Storage', inline: true },
            { name: '🌍 Region', value: process.env.AWS_REGION || 'Unknown', inline: true },
            { name: '👤 Performed by', value: member.displayName, inline: true }
          )
          .setColor(totalCleanedFiles > 0 ? 0xff8800 : 0x00ff00)
          .setTimestamp()
          .setFooter({ text: 'RDP Datacenter • Global Cloud Cleanup Complete' });
  
        // Add cost savings estimate if space was saved
        if (totalSpaceSaved > 0) {
          const monthlySavings = calculateMonthlySavings(totalSpaceSaved / 1024 / 1024);
          if (monthlySavings > 0.001) {
            embed.addFields(
              { name: '💰 Est. Monthly Savings', value: `${monthlySavings.toFixed(3)}`, inline: true }
            );
          }
        }
  
        await interaction.editReply({ embeds: [embed] });
        
      } else {
        // Server-specific cleanup
        // Get initial bucket statistics
        const initialStats = await s3Service.getBucketStats(guildId);
        const initialSizeMB = (initialStats.totalSize / 1024 / 1024).toFixed(2);
        
        // Perform cleanup
        const cleanedFiles = await s3Service.cleanupFiles(guildId);
        
        // Get updated statistics
        const finalStats = await s3Service.getBucketStats(guildId);
        const finalSizeMB = (finalStats.totalSize / 1024 / 1024).toFixed(2);
        const spaceSavedMB = ((initialStats.totalSize - finalStats.totalSize) / 1024 / 1024).toFixed(2);
        
        // Log the cleanup
        console.log(`🧹 [CLEANUP] ${member.displayName} cleaned ${cleanedFiles.length} files from server ${guildId}, saved ${spaceSavedMB}MB`);
        
        const embed = new EmbedBuilder()
          .setTitle(`🧹 ${interaction.guild?.name || 'Server'}'s Sound Collection Cleanup`)
          .setDescription(`Removed **${cleanedFiles.length}** corrupted or empty files from this server's sound collection.`)
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
            { name: '☁️ Storage Location', value: `AWS S3 (${folderName}/${guildId}/)`, inline: true },
            { name: '🌍 Region', value: process.env.AWS_REGION || 'Unknown', inline: true },
            { name: '👤 Performed by', value: member.displayName, inline: true }
          )
          .setColor(cleanedFiles.length > 0 ? 0xff8800 : 0x00ff00)
          .setTimestamp()
          .setFooter({ text: `RDP Datacenter • ${interaction.guild?.name || 'Server'} Cleanup Complete` });
  
        // Add cost savings estimate if space was saved
        if (parseFloat(spaceSavedMB) > 0) {
          const monthlySavings = calculateMonthlySavings(parseFloat(spaceSavedMB));
          if (monthlySavings > 0.001) {
            embed.addFields(
              { name: '💰 Est. Monthly Savings', value: `${monthlySavings.toFixed(3)}`, inline: true }
            );
          }
        }
  
        await interaction.editReply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error(`❌ [ERROR] S3 Cleanup failed for server ${guildId}:`, error);
      
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