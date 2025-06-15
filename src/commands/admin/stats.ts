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
import { getAvailableFiles } from '@/commands/audio/play';
import fs from 'fs';

export const statsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show bot statistics (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { audioFolder, client, currentConnection } = context;
    const member = interaction.member as GuildMember;
    
    // Check admin permissions
    if (!PermissionChecker.isElevated(member)) {
      await PermissionChecker.sendPermissionDenied(interaction, 'Administrator or Manager');
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const files = getAvailableFiles(audioFolder);
      
      // Calculate total file size
      let totalSize = 0;
      files.forEach(file => {
        const filePath = `${audioFolder}/${file}`;
        if (fs.existsSync(filePath)) {
          totalSize += fs.statSync(filePath).size;
        }
      });

      // Get bot uptime
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      // Get voice connections count (Discord.js v14 way)
      const voiceConnections = getVoiceConnections();
      const connectionCount = voiceConnections.size;
      
      // Check if bot is currently in a voice channel
      const isConnected = currentConnection !== null;

      const embed = new EmbedBuilder()
        .setTitle('📊 RDP-MemeBox Statistics')
        .addFields(
          { name: '🎵 Total Memes', value: files.length.toString(), inline: true },
          { name: '💾 Storage Used', value: `${(totalSize / 1024 / 1024).toFixed(2)} MB`, inline: true },
          { name: '🏠 Servers', value: client.guilds.cache.size.toString(), inline: true },
          { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
          { name: '🔗 Voice Connections', value: connectionCount.toString(), inline: true },
          { name: '🎤 Currently Playing', value: isConnected ? '✅ Yes' : '❌ No', inline: true },
          { name: '💾 Memory Usage', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
          { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
          { name: '👥 Users', value: client.users.cache.size.toString(), inline: true }
        )
        .setColor(0x0099ff)
        .setTimestamp()
        .setFooter({ text: 'RDP Datacenter • Admin Statistics' });

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('❌ [ERROR] Stats failed:', error);
      await interaction.editReply({
        content: '❌ Failed to retrieve statistics.'
      });
    }
  }
};