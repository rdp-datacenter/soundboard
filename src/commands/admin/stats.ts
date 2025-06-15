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
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { s3Service, client, currentConnection } = context;
    const member = interaction.member as GuildMember;
    
    // Check admin permissions
    if (!PermissionChecker.isElevated(member)) {
      await PermissionChecker.sendPermissionDenied(interaction, 'Administrator or Manager');
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Get S3 storage statistics
      const bucketStats = await s3Service.getBucketStats();
      const totalSizeMB = (bucketStats.totalSize / 1024 / 1024).toFixed(2);
      
      // Test S3 connection
      const s3Connected = await s3Service.testConnection();

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

      const embed = new EmbedBuilder()
        .setTitle('📊 RDP Soundboard Statistics')
        .setDescription('Comprehensive bot and cloud storage statistics')
        .addFields(
          // Audio Statistics
          { name: '🎵 Audio Files', value: bucketStats.fileCount.toString(), inline: true },
          { name: '☁️ Cloud Storage', value: `${totalSizeMB} MB`, inline: true },
          { name: '🔗 S3 Connection', value: s3Connected ? '✅ Connected' : '❌ Disconnected', inline: true },
          
          // Bot Statistics
          { name: '🏠 Servers', value: client.guilds.cache.size.toString(), inline: true },
          { name: '👥 Users', value: client.users.cache.size.toString(), inline: true },
          { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
          
          // Voice Statistics
          { name: '🔗 Voice Connections', value: connectionCount.toString(), inline: true },
          { name: '🎤 Currently Playing', value: isConnected ? '✅ Yes' : '❌ No', inline: true },
          { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
          
          // System Statistics
          { name: '💾 Memory Usage', value: `${memoryUsedMB}/${memoryTotalMB} MB`, inline: true },
          { name: '🖥️ Node.js Version', value: process.version, inline: true },
          { name: '🌐 Platform', value: process.platform, inline: true }
        )
        .setColor(s3Connected ? 0x0099ff : 0xff8800)
        .setTimestamp()
        .setFooter({ text: 'RDP Datacenter • Admin Statistics • Cloud-powered' });

      // Add additional cloud storage information
      if (s3Connected) {
        const bucketName = process.env.S3_BUCKET_NAME || 'Unknown';
        const region = process.env.AWS_REGION || 'Unknown';
        
        embed.addFields(
          { name: '🪣 S3 Bucket', value: bucketName, inline: true },
          { name: '🌍 AWS Region', value: region, inline: true },
          { name: '🔄 Storage Type', value: 'Standard (S3)', inline: true }
        );

        // Estimate monthly cost (rough calculation)
        const estimatedMonthlyCost = calculateS3Cost(bucketStats.totalSize, bucketStats.fileCount);
        if (estimatedMonthlyCost > 0) {
          embed.addFields(
            { name: '💰 Est. Monthly Cost', value: `$${estimatedMonthlyCost.toFixed(3)}`, inline: true }
          );
        }
      } else {
        embed.addFields(
          { name: '⚠️ Cloud Status', value: 'S3 connection issues detected', inline: false }
        );
      }

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('❌ [ERROR] Stats failed:', error);
      
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