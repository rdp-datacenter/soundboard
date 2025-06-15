import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command, CommandContext } from '@/types/Command';
import { getAvailableFiles } from './play';

export const listCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all available MP3 files'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { audioFolder } = context;
    const files = getAvailableFiles(audioFolder);
    
    if (files.length === 0) {
      await interaction.reply('📁 No MP3 files available. Upload some using `/upload`!');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎵 Available MP3 Files')
      .setDescription(files.map(file => `• ${file}`).join('\n'))
      .setColor(0x00AE86)
      .setFooter({ text: `Total: ${files.length} files` });

    await interaction.reply({ embeds: [embed] });
  }
};
