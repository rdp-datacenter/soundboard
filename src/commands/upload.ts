import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    GuildMember 
  } from 'discord.js';
  import { Command, CommandContext } from '@/types/Command';
  import fs from 'fs';
  import path from 'path';
  
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
      const { audioFolder } = context;
      
      // Double-check admin permissions (extra security)
      const member = interaction.member as GuildMember;
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ **Access Denied!** Only administrators can upload meme files.',
          ephemeral: true
        });
        return;
      }
  
      const attachment = interaction.options.getAttachment('file', true);
      
      // Validate file type
      if (!attachment.name?.endsWith('.mp3')) {
        await interaction.reply({
          content: '❌ Please upload an MP3 file only!',
          ephemeral: true
        });
        return;
      }
  
      // Validate file size (25MB Discord limit)
      const maxSize = 25 * 1024 * 1024; // 25MB in bytes
      if (attachment.size > maxSize) {
        await interaction.reply({
          content: `❌ File too large! Maximum size is 25MB. Your file: ${(attachment.size / 1024 / 1024).toFixed(2)}MB`,
          ephemeral: true
        });
        return;
      }
  
      // Check for existing file
      const filePath = path.join(audioFolder, attachment.name);
      if (fs.existsSync(filePath)) {
        await interaction.reply({
          content: `❌ File **${attachment.name}** already exists! Please rename or delete the existing file first.`,
          ephemeral: true
        });
        return;
      }
  
      await interaction.deferReply();
  
      try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        
        // Log the upload for audit purposes
        console.log(`📁 [UPLOAD] ${member.displayName} (${member.id}) uploaded: ${attachment.name}`);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Meme File Uploaded Successfully!')
          .setDescription(`**${attachment.name}** has been added to the RDP-MemeBox library.`)
          .addFields(
            { name: '📁 File Name', value: attachment.name, inline: true },
            { name: '📏 File Size', value: `${(attachment.size / 1024 / 1024).toFixed(2)} MB`, inline: true },
            { name: '👤 Uploaded by', value: member.displayName, inline: true },
            { name: '🎵 How to Play', value: `Use \`/play ${attachment.name}\` or \`@RDP-MemeBox ${attachment.name}\``, inline: false }
          )
          .setColor(0x00AE86)
          .setTimestamp()
          .setFooter({ text: `RDP Datacenter • Admin Upload` });
  
        await interaction.editReply({ embeds: [embed] });
  
        // Optional: Send notification to a log channel
        // You can add this if you want upload notifications in a specific channel
        
      } catch (error) {
        console.error('❌ [ERROR] Upload failed:', error);
        await interaction.editReply({
          content: '❌ Failed to upload file. Please try again or contact the system administrator.'
        });
      }
    }
  };