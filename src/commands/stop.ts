import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command, CommandContext } from '../types/Command';

export const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing audio and leave voice channel'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { audioPlayer, currentConnection } = context;
    
    if (currentConnection) {
      audioPlayer.stop();
      currentConnection.destroy();
      context.currentConnection = null;
      
      await interaction.reply('⏹️ Stopped playing and left voice channel!');
    } else {
      await interaction.reply('❌ I\'m not currently playing anything!');
    }
  }
};
