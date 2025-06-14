import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Message } from 'discord.js';
import { Command, TextCommand, CommandContext } from '../types/Command';

export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency and response time'),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { client } = context;
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    
    const wsLatency = client.ws.ping;
    const apiLatency = sent.createdTimestamp - interaction.createdTimestamp;
    
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📡 WebSocket Latency', value: `${wsLatency}ms`, inline: true },
        { name: '🚀 API Latency', value: `${apiLatency}ms`, inline: true },
        { name: '📊 Status', value: getPingStatus(wsLatency), inline: true }
      )
      .setColor(getPingColor(wsLatency))
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  }
};

export const pingTextCommand: TextCommand = {
  name: 'ping',
  
  async execute(message: Message, args: string[], context: CommandContext) {
    const { client } = context;
    const sent = await message.reply('🏓 Pinging...');
    
    const wsLatency = client.ws.ping;
    const apiLatency = sent.createdTimestamp - message.createdTimestamp;
    
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📡 WebSocket Latency', value: `${wsLatency}ms`, inline: true },
        { name: '🚀 API Latency', value: `${apiLatency}ms`, inline: true },
        { name: '📊 Status', value: getPingStatus(wsLatency), inline: true }
      )
      .setColor(getPingColor(wsLatency))
      .setTimestamp();

    await sent.edit({ content: '', embeds: [embed] });
  }
};

function getPingStatus(ping: number): string {
  if (ping < 100) return '🟢 Excellent';
  if (ping < 200) return '🟡 Good';
  if (ping < 300) return '🟠 Fair';
  return '🔴 Poor';
}

function getPingColor(ping: number): number {
  if (ping < 100) return 0x00ff00; // Green
  if (ping < 200) return 0xffff00; // Yellow
  if (ping < 300) return 0xff8000; // Orange
  return 0xff0000; // Red
}
