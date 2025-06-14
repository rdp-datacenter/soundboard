import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    GuildMember 
  } from 'discord.js';
  import { Command, CommandContext } from '@/types/Command';
  import { PermissionChecker } from '@/utils/permissions';
  import fs from 'fs';
  import path from 'path';
  
  export const deleteCommand: Command = {
    data: new SlashCommandBuilder()
      .setName('delete')
      .setDescription('Delete an MP3 file from the library (Admin only)')
      .addStringOption(option =>
        option.setName('filename')
          .setDescription('Name of the MP3 file to delete')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
    async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
      const { audioFolder } = context;
      const member = interaction.member as GuildMember;
      
      // Check admin permissions
      if (!PermissionChecker.isAdmin(member)) {
        await PermissionChecker.sendPermissionDenied(interaction);
        return;
      }
  
      const filename = interaction.options.getString('filename', true);
      const filePath = path.join(audioFolder, filename);
  
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        await interaction.reply({
          content: `❌ File **${filename}** not found!`,
          ephemeral: true
        });
        return;
      }
  
      try {
        // Delete the file
        fs.unlinkSync(filePath);
        
        // Log the deletion
        console.log(`🗑️ [DELETE] ${member.displayName} (${member.id}) deleted: ${filename}`);
        
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Meme File Deleted')
          .setDescription(`**${filename}** has been removed from the RDP-MemeBox library.`)
          .addFields(
            { name: '👤 Deleted by', value: member.displayName, inline: true },
            { name: '📁 File', value: filename, inline: true }
          )
          .setColor(0xff4444)
          .setTimestamp()
          .setFooter({ text: 'RDP Datacenter • Admin Action' });
  
        await interaction.reply({ embeds: [embed] });
        
      } catch (error) {
        console.error('❌ [ERROR] Delete failed:', error);
        await interaction.reply({
          content: '❌ Failed to delete file. Please check file permissions.',
          ephemeral: true
        });
      }
    }
  };
  