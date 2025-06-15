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
import fs from 'fs';
import path from 'path';

export const cleanupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('Clean up empty or corrupted files (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { audioFolder } = context;
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
      const files = fs.readdirSync(audioFolder);
      const cleaned = [];
      
      for (const file of files) {
        const filePath = path.join(audioFolder, file);
        const stats = fs.statSync(filePath);
        
        // Remove files smaller than 1KB (likely corrupted)
        if (stats.size < 1024) {
          fs.unlinkSync(filePath);
          cleaned.push(file);
        }
      }
      
      // Log the cleanup
      console.log(`🧹 [CLEANUP] ${member.displayName} cleaned ${cleaned.length} files`);
      
      const embed = new EmbedBuilder()
        .setTitle('🧹 Cleanup Complete')
        .setDescription(`Removed **${cleaned.length}** corrupted or empty files.`)
        .addFields(
          cleaned.length > 0 ? 
            { name: '🗑️ Deleted Files', value: cleaned.join('\n') || 'None', inline: false } :
            { name: '✅ Result', value: 'No cleanup needed - all files are healthy!', inline: false }
        )
        .setColor(cleaned.length > 0 ? 0xff8800 : 0x00ff00)
        .setTimestamp()
        .setFooter({ text: 'RDP Datacenter • Owner Action' });

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('❌ [ERROR] Cleanup failed:', error);
      await interaction.editReply({
        content: '❌ Failed to perform cleanup.'
      });
    }
  }
};