import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
  Message,
  MessageFlags
} from 'discord.js';
import { Command, TextCommand, CommandContext } from '@/types/Command';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands organized by category')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Show commands for a specific category')
        .setRequired(false)
        .addChoices(
          { name: '🎵 Audio Commands', value: 'audio' },
          { name: '⚙️ Admin Commands', value: 'admin' },
          { name: '🛠️ Utility Commands', value: 'utility' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const category = interaction.options.getString('category');
    
    if (category) {
      await showCategoryHelp(interaction, category);
    } else {
      await showGeneralHelp(interaction);
    }
  }
};

export const helpTextCommand: TextCommand = {
  name: 'help',
  
  async execute(message: Message, args: string[], context: CommandContext) {
    const category = args[0]?.toLowerCase();
    
    if (category && ['audio', 'admin', 'utility'].includes(category)) {
      await showCategoryHelpText(message, category);
    } else {
      await showGeneralHelpText(message);
    }
  }
};

// Slash command help functions
async function showGeneralHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 RDP-MemeBox Commands')
    .setDescription('Your Discord music bot for playing MP3 memes!')
    .addFields(
      {
        name: '🎵 Audio Commands',
        value: '`/play` • `/stop` • `/volume` • `/list`\nMusic playback and control',
        inline: false
      },
      {
        name: '⚙️ Admin Commands',
        value: '`/upload` • `/delete` • `/cleanup` • `/stats`\nFile management and bot administration',
        inline: false
      },
      {
        name: '🛠️ Utility Commands',
        value: '`/ping` • `/help`\nGeneral bot utilities and information',
        inline: false
      },
      {
        name: '📝 Text Commands',
        value: 'Use `!command` or mention the bot `@RDP-MemeBox filename.mp3`',
        inline: false
      }
    )
    .setColor(0x00AE86)
    .setTimestamp()
    .setFooter({ text: 'Use /help [category] for detailed command info' });

  // Add category buttons
  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_audio')
        .setLabel('🎵 Audio')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help_admin')
        .setLabel('⚙️ Admin')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_utility')
        .setLabel('🛠️ Utility')
        .setStyle(ButtonStyle.Success)
    );

  const response = await interaction.reply({ 
    embeds: [embed], 
    components: [buttons] 
  });

  // Handle button interactions
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000 // 1 minute
  });

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({ 
        content: 'You can only interact with your own help command!', 
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const category = buttonInteraction.customId.replace('help_', '');
    const embed = getCategoryEmbed(category);
    await buttonInteraction.update({ embeds: [embed] });
  });

  collector.on('end', async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch (error) {
      // Ignore errors when editing expired interactions
    }
  });
}

async function showCategoryHelp(interaction: ChatInputCommandInteraction, category: string) {
  const embed = getCategoryEmbed(category);
  await interaction.reply({ embeds: [embed] });
}

function getCategoryEmbed(category: string): EmbedBuilder {
  let embed: EmbedBuilder;

  switch (category) {
    case 'audio':
      embed = new EmbedBuilder()
        .setTitle('🎵 Audio Commands')
        .setDescription('Commands for music playback and audio control')
        .addFields(
          {
            name: '🎵 `/play <filename>`',
            value: 'Play an MP3 file in your voice channel\n*Also: `!play filename` or `@bot filename`*',
            inline: false
          },
          {
            name: '⏹️ `/stop`',
            value: 'Stop playing audio and leave voice channel\n*Also: `!stop`*',
            inline: false
          },
          {
            name: '🔊 `/volume [level]`',
            value: 'Set or check volume (0-100)\n*Also: `!volume 75`*',
            inline: false
          },
          {
            name: '📋 `/list`',
            value: 'Show all available MP3 files\n*Also: `!list`*',
            inline: false
          }
        )
        .setColor(0x00AE86);
      break;

    case 'admin':
      embed = new EmbedBuilder()
        .setTitle('⚙️ Admin Commands')
        .setDescription('Administrative commands (Requires admin permissions)')
        .addFields(
          {
            name: '📁 `/upload <file>`',
            value: 'Upload a new MP3 file to the bot\n*Max size: 25MB*',
            inline: false
          },
          {
            name: '🗑️ `/delete <filename>`',
            value: 'Delete an MP3 file from the library\n*Permanent action - be careful!*',
            inline: false
          },
          {
            name: '🧹 `/cleanup`',
            value: 'Remove corrupted or empty files\n*Owner only*',
            inline: false
          },
          {
            name: '📊 `/stats`',
            value: 'Show bot statistics and information\n*Admin/Manager only*',
            inline: false
          }
        )
        .setColor(0xff8800);
      break;

    case 'utility':
      embed = new EmbedBuilder()
        .setTitle('🛠️ Utility Commands')
        .setDescription('General bot utilities and information')
        .addFields(
          {
            name: '🏓 `/ping`',
            value: 'Check bot latency and response time\n*Also: `!ping`*',
            inline: false
          },
          {
            name: '❓ `/help [category]`',
            value: 'Show this help message\n*Also: `!help [category]`*',
            inline: false
          }
        )
        .setColor(0x0099ff);
      break;

    default:
      embed = new EmbedBuilder()
        .setTitle('❌ Invalid Category')
        .setDescription('Please choose from: audio, admin, utility')
        .setColor(0xff0000);
  }

  embed.setTimestamp().setFooter({ text: 'RDP Datacenter • Command Help' });
  
  return embed;
}

// Text command help functions
async function showGeneralHelpText(message: Message) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 RDP-MemeBox Commands')
    .setDescription('Your Discord music bot for playing MP3 memes!')
    .addFields(
      {
        name: '🎵 Audio Commands',
        value: '`!play filename` • `!stop` • `!volume 75` • `!list`',
        inline: false
      },
      {
        name: '⚙️ Admin Commands (Slash only)',
        value: '`/upload` • `/delete` • `/cleanup` • `/stats`',
        inline: false
      },
      {
        name: '🛠️ Utility Commands',
        value: '`!ping` • `!help [category]`',
        inline: false
      },
      {
        name: '📝 Bot Mention',
        value: 'You can also mention the bot: `@RDP-MemeBox filename.mp3`',
        inline: false
      }
    )
    .setColor(0x00AE86)
    .setTimestamp()
    .setFooter({ text: 'Use !help [audio|admin|utility] for detailed info' });

  await message.reply({ embeds: [embed] });
}

async function showCategoryHelpText(message: Message, category: string) {
  const embed = getCategoryEmbed(category);
  await message.reply({ embeds: [embed] });
}