import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits,
  GuildMember,
  MessageFlags
} from 'discord.js';
import { getVoiceConnections } from '@discordjs/voice';
import { Command, CommandContext } from '@/types/Command';
import { PermissionChecker } from '@/utils/permissions';

export const statsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show bot statistics including cloud storage (Admin only)')
    .addBooleanOption(option =>
      option.setName('global')
        .setDescription('Show global stats across all servers (default: this server only)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { s3Service, client, currentConnection, guildId } = context;
    const member = interaction.member as GuildMember;
    const showGlobal = interaction.options.getBoolean('global') || false;
    
    // Check admin permissions
    if (!PermissionChecker.isElevated(member)) {
      await PermissionChecker.sendPermissionDenied(interaction, 'Administrator or Manager');
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Test S3 connection
      const s3Connected = await s3Service.testConnection();
      if (!s3Connected) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Cloud Storage Unavailable')
          .setDescription('Unable to connect to cloud storage. Please check AWS configuration.')
          .setColor(0xff0000)
          .setTimestamp()
          .setFooter({ text: 'RDP Datacenter • Cloud Storage Error' });
          
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Get storage statistics (server-specific or global)
      let statsEmbed;
      
      if (showGlobal) {
        // Global stats across all servers
        const totalStats = await s3Service.getTotalStats();
        const totalSizeMB = ((totalStats.totalSize || 0) / 1024 / 1024).toFixed(2);
        
        // Get all servers and create a list
        const servers = await s3Service.listServers();
        
        statsEmbed = new EmbedBuilder()
          .setTitle('📊 RDP Soundboard Global Statistics')
          .setDescription('Statistics across all servers using this bot')
          .addFields(
            // Global Audio Statistics
            { name: '🏠 Total Servers', value: totalStats.serverCount.toString(), inline: true },
            { name: '🎵 Total Audio Files', value: totalStats.fileCount.toString(), inline: true },
            { name: '☁️ Total Cloud Storage', value: `${totalSizeMB} MB`, inline: true },
            
            // Server list (limit to 10 to avoid overflow)
            { name: '🏠 Servers with Sound Collections', value: servers.length > 0 ? 
              servers.slice(0, 10).map(id => {
                const guild = client.guilds.cache.get(id);
                return guild ? `• ${guild.name}` : `• Server ID: ${id}`;
              }).join('\n') + (servers.length > 10 ? `\n• ...and ${servers.length - 10} more` : '')
              : 'No servers found', inline: false }
          )
          .setColor(0x0099ff)
          .setTimestamp()
          .setFooter({ text: 'RDP Datacenter • Global Statistics • Cloud-powered' });
          
      } else {
        // Server-specific stats
        const bucketStats = await s3Service.getBucketStats(guildId);
        const totalSizeMB = ((bucketStats.totalSize || 0) / 1024 / 1024).toFixed(2);
        
        // Get bot uptime
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        // Get voice connections count
        const voiceConnections = getVoiceConnections();
        const connectionCount = voiceConnections.size;
        
        // Check if bot is currently in a voice channel
        const isConnected = currentConnection !== null;

        // Memory usage
        const memoryUsage = process.memoryUsage();
        const memoryUsedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const memoryTotalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        
        // Get the folder name for display
        const folderName = process.env.S3_FOLDER || 'audio';

        statsEmbed = new EmbedBuilder()
          .setTitle(`📊 ${interaction.guild?.name || 'Server'}'s Sound Statistics`)
          .setDescription('Server-specific bot and cloud storage statistics')
          .addFields(
            // Audio Statistics
            { name: '🎵 Audio Files', value: bucketStats.fileCount.toString(), inline: true },
            { name: '☁️ Cloud Storage', value: `${totalSizeMB} MB`, inline: true },
            { name: '🔗 S3 Connection', value: s3Connected ? '✅ Connected' : '❌ Disconnected', inline: true },
            
            // Bot Statistics
            { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
            { name: '🔗 Voice Connection', value: isConnected ? '✅ Connected' : '❌ Disconnected', inline: true },
            { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
            
            // System Statistics
            { name: '💾 Memory Usage', value: `${memoryUsedMB}/${memoryTotalMB} MB`, inline: true },
            { name: '🖥️ Node.js Version', value: process.version, inline: true },
            { name: '🌐 Platform', value: process.platform, inline: true }
          )
          .setColor(0x0099ff)
          .setTimestamp()
          .setFooter({ text: `RDP Datacenter • ${interaction.guild?.name || 'Server'} Statistics` });

        // Add additional cloud storage information
        statsEmbed.addFields(
          { name: '🪣 S3 Bucket', value: process.env.S3_BUCKET_NAME || 'Unknown', inline: true },
          { name: '🌍 AWS Region', value: process.env.AWS_REGION || 'Unknown', inline: true },
          { name: '📁 Sound Folder', value: `${folderName}/${guildId}/`, inline: true }
        );

        // Estimate monthly cost (rough calculation)
        const estimatedMonthlyCost = calculateS3Cost(bucketStats.totalSize, bucketStats.fileCount);
        if (estimatedMonthlyCost > 0) {
          statsEmbed.addFields(
            { name: '💰 Est. Monthly Cost', value: `$${estimatedMonthlyCost.toFixed(3)}`, inline: true }
          );
        }
      }

      await interaction.editReply({ embeds: [statsEmbed] });
      
    } catch (error) {
      console.error(`❌ [ERROR] Stats failed for server ${guildId}:`, error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Statistics Error')
        .setDescription('Unable to retrieve complete statistics.')
        .addFields(
          { name: '🔍 Error Details', value: 'Failed to access cloud storage statistics', inline: false },
          { name: '🛠️ Troubleshooting', value: 'Check AWS credentials and S3 bucket access', inline: false }
        )
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: 'RDP Datacenter • Statistics Error' });
        
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

// Helper function to estimate S3 costs
function calculateS3Cost(totalBytes: number, fileCount: number): number {
  if (totalBytes === 0) return 0;
  
  // AWS S3 Standard pricing (approximate, as of 2024)
  const storageGBMonth = 0.023; // $0.023 per GB per month
  const requestsPer1000PUT = 0.0005; // $0.0005 per 1,000 PUT requests
  const requestsPer1000GET = 0.0004; // $0.0004 per 10,000 GET requests (but this is per 10k)
  
  const totalGB = totalBytes / (1024 * 1024 * 1024);
  
  // Estimate monthly storage cost
  const storageCost = totalGB * storageGBMonth;
  
  // Estimate request costs (assuming minimal usage)
  const putCost = (fileCount / 1000) * requestsPer1000PUT;
  const getCost = (fileCount * 10 / 10000) * 0.0004; // Assume 10 plays per file per month
  
  return storageCost + putCost + getCost;
}