import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command, CommandContext } from '../types/Command';
import fs from 'fs';
import path from 'path';

export const uploadCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('upload')
    .setDescription('Upload an MP3 file to the bot')
    .addAttachmentOption(option =>
      option.setName('file')
        .setDescription('MP3 file to upload')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { audioFolder } = context;
    const attachment = interaction.options.getAttachment('file', true);
    
    if (!attachment.name?.endsWith('.mp3')) {
      await interaction.reply('❌ Please upload an MP3 file only!');
      return;
    }

    await interaction.deferReply();

    try {
      const response = await fetch(attachment.url);
      const buffer = await response.arrayBuffer();
      const filePath = path.join(audioFolder, attachment.name);
      
      fs.writeFileSync(filePath, Buffer.from(buffer));
      
      const embed = new EmbedBuilder()
        .setTitle('✅ File Uploaded Successfully!')
        .setDescription(`**${attachment.name}** has been added to the music library.`)
        .addFields(
          { name: 'File Size', value: `${(attachment.size / 1024 / 1024).toFixed(2)} MB`, inline: true },
          { name: 'How to Play', value: `Use \`/play ${attachment.name}\` or \`@bot ${attachment.name}\``, inline: false }
        )
        .setColor(0x00AE86);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error uploading file:', error);
      await interaction.editReply('❌ Failed to upload file. Please try again.');
    }
  }
};
