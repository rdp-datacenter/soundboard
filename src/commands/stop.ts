import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    GuildMember,
    Message 
  } from 'discord.js';
  import { Command, TextCommand, CommandContext } from '@/types/Command';
  import { AudioPlayerStatus } from '@discordjs/voice';
  
  export const stopCommand: Command = {
    data: new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Stop playing audio and leave voice channel'),
  
    async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
      const member = interaction.member as GuildMember;
      await handleStopCommand(interaction, member, context);
    }
  };
  
  export const stopTextCommand: TextCommand = {
    name: 'stop',
    
    async execute(message: Message, args: string[], context: CommandContext) {
      const member = message.member as GuildMember;
      await handleStopCommand(message, member, context);
    }
  };
  
  // Shared logic for both slash and text commands
  async function handleStopCommand(
    source: ChatInputCommandInteraction | Message,
    member: GuildMember,
    context: CommandContext
  ) {
    const { audioPlayer, currentConnection, setConnection } = context;
    
    // Check if bot is currently playing or connected
    const isPlaying = audioPlayer.state.status === AudioPlayerStatus.Playing;
    const isConnected = currentConnection !== null;
    
    if (!isConnected && !isPlaying) {
      const errorMsg = '❌ I\'m not currently playing anything or connected to a voice channel!';
      
      if (source instanceof ChatInputCommandInteraction) {
        await source.reply({ content: errorMsg, ephemeral: true });
      } else {
        await source.reply(errorMsg);
      }
      return;
    }
    
    try {
      // Stop the audio player
      if (isPlaying) {
        audioPlayer.stop();
        console.log('🛑 [STOP] Audio player stopped');
      }
      
      // Destroy the connection
      if (currentConnection) {
        currentConnection.destroy();
        setConnection(null); // Clear the connection in bot context
        console.log('🛑 [STOP] Voice connection destroyed');
      }
      
      const embed = new EmbedBuilder()
        .setTitle('⏹️ Playback Stopped')
        .setDescription('Successfully stopped playing and left the voice channel.')
        .addFields(
          { name: '👤 Stopped by', value: member.displayName, inline: true },
          { name: '🎵 Status', value: 'Disconnected', inline: true }
        )
        .setColor(0xff4444)
        .setTimestamp()
        .setFooter({ text: 'Use /play to start playing again' });
  
      if (source instanceof ChatInputCommandInteraction) {
        await source.reply({ embeds: [embed] });
      } else {
        await source.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('❌ [ERROR] Stop command failed:', error);
      const errorMsg = '❌ Failed to stop playback. The connection may have already been terminated.';
      
      if (source instanceof ChatInputCommandInteraction) {
        await source.reply({ content: errorMsg, ephemeral: true });
      } else {
        await source.reply(errorMsg);
      }
    }
  }