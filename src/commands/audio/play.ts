import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMember,
  VoiceChannel,
  Message
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioResource,
  VoiceConnectionStatus,
  entersState
} from '@discordjs/voice';
import { Command, TextCommand, CommandContext } from '@/types/Command';
import fs from 'fs';
import path from 'path';

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play an MP3 file in voice channel')
    .addStringOption(option =>
      option.setName('filename')
        .setDescription('Name of the MP3 file to play')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const fileName = interaction.options.getString('filename', true);
    await interaction.deferReply();
    
    const result = await playAudio(interaction, fileName, context);
    if (typeof result === 'string') {
      await interaction.editReply(result);
    }
  }
};

export const playTextCommand: TextCommand = {
  name: 'play',
  
  async execute(message: Message, args: string[], context: CommandContext) {
    const fileName = args.join(' ').trim();
    if (!fileName) {
      await message.reply('❌ Please specify an MP3 file name! Example: `!play filename.mp3`');
      return;
    }
    
    await playAudio(message, fileName, context);
  }
};

export async function handleMention(message: Message, fileName: string, context: CommandContext) {
  if (fileName) {
    await playAudio(message, fileName, context);
  } else {
    await message.reply('Please specify an MP3 file name! Example: `@bot filename.mp3`');
  }
}

async function playAudio(
  source: ChatInputCommandInteraction | Message, 
  fileName: string, 
  context: CommandContext
): Promise<string | void> {
  const { client, audioPlayer, audioFolder, currentVolume, setConnection } = context;
  
  // Get the user's voice channel
  let member: GuildMember;
  
  if (source instanceof ChatInputCommandInteraction) {
    member = source.member as GuildMember;
  } else {
    member = source.member as GuildMember;
  }

  const voiceChannel = member.voice.channel as VoiceChannel;
  
  if (!voiceChannel) {
    const errorMsg = '❌ You need to be in a voice channel to play music!';
    if (source instanceof ChatInputCommandInteraction) {
      return errorMsg;
    } else {
      await source.reply(errorMsg);
      return;
    }
  }

  // Check if file exists
  const filePath = path.join(audioFolder, fileName);
  if (!fs.existsSync(filePath)) {
    const errorMsg = `❌ File "${fileName}" not found! Use \`/list\` to see available files.`;
    if (source instanceof ChatInputCommandInteraction) {
      return errorMsg;
    } else {
      await source.reply(errorMsg);
      return;
    }
  }

  try {
    // Join voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    // Update connection in bot context - THIS IS KEY!
    setConnection(connection);

    // Wait for connection to be ready
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    // Create audio resource with volume control
    const resource = createAudioResource(filePath, {
      inlineVolume: true // Enable volume control
    });
    
    // Set the volume (default 50% or current volume)
    if (resource.volume) {
      resource.volume.setVolume(currentVolume);
    }

    audioPlayer.play(resource);
    connection.subscribe(audioPlayer);

    // Get volume emoji based on current volume
    const volumePercent = Math.round(currentVolume * 100);
    let volumeEmoji = '🔇';
    if (volumePercent > 66) volumeEmoji = '🔊';
    else if (volumePercent > 33) volumeEmoji = '🔉';
    else if (volumePercent > 0) volumeEmoji = '🔈';

    const embed = new EmbedBuilder()
      .setTitle('🎵 Now Playing')
      .setDescription(`**${fileName}**`)
      .addFields(
        { name: '🏠 Voice Channel', value: voiceChannel.name, inline: true },
        { name: '👤 Requested by', value: member.displayName, inline: true },
        { name: `${volumeEmoji} Volume`, value: `${volumePercent}%`, inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp()
      .setFooter({ text: 'Use /volume to adjust playback volume' });

    if (source instanceof ChatInputCommandInteraction) {
      await source.editReply({ embeds: [embed] });
    } else {
      await source.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Error playing audio:', error);
    const errorMsg = '❌ Failed to play audio. Please try again.';
    
    if (source instanceof ChatInputCommandInteraction) {
      return errorMsg;
    } else {
      await source.reply(errorMsg);
    }
  }
}

export function getAvailableFiles(audioFolder: string): string[] {
  try {
    return fs.readdirSync(audioFolder)
      .filter(file => file.endsWith('.mp3'))
      .sort();
  } catch (error) {
    console.error('Error reading audio folder:', error);
    return [];
  }
}