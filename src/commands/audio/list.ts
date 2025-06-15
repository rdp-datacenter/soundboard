// src/commands/audio/list.ts
import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ButtonInteraction
} from 'discord.js';
import { Command, CommandContext } from '@/types/Command';
import { AudioFile } from '@/utils/s3';

// Helper functions defined first (hoisted)
function showSimpleListFromButton(
  buttonInteraction: ButtonInteraction,
  files: AudioFile[],
  totalSizeMB: string
) {
  const itemsPerPage = 20;
  const totalPages = Math.ceil(files.length / itemsPerPage);
  let currentPage = 0;

  const generateEmbed = (page: number) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageFiles = files.slice(start, end);
    
    const fileList = pageFiles.map((file, index) => {
      const number = start + index + 1;
      const size = (file.size / 1024).toFixed(1);
      return `${number}. **${file.name}** (${size} KB)`;
    }).join('\n');

    // Get the folder name for display
    const folderName = process.env.S3_FOLDER || 'audio';

    return new EmbedBuilder()
      .setTitle('🎵 Available MP3 Files')
      .setDescription(fileList)
      .addFields(
        { name: '📊 Storage Stats', value: `**${files.length}** files • **${totalSizeMB} MB** total`, inline: true },
        { name: '☁️ Source', value: `AWS S3 (${folderName}/ folder)`, inline: true },
        { name: '📄 Page', value: `${page + 1} of ${totalPages}`, inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp()
      .setFooter({ text: 'Use /play <filename> to play • Cloud-powered storage' });
  };

  const generateComponents = (page: number) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    if (totalPages > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('list_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('list_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
    }
    
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('list_detailed')
        .setLabel('📋 Detailed View')
        .setStyle(ButtonStyle.Primary)
    );

    return totalPages > 1 || row.components.length > 0 ? [row] : [];
  };

  return buttonInteraction.update({
    embeds: [generateEmbed(currentPage)],
    components: generateComponents(currentPage)
  }).then(response => {
    // Handle button interactions
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (subButtonInteraction: ButtonInteraction) => {
      if (subButtonInteraction.user.id !== buttonInteraction.user.id) {
        await subButtonInteraction.reply({
          content: 'You can only interact with your own list command!',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subButtonInteraction.customId === 'list_prev') {
        currentPage = Math.max(0, currentPage - 1);
        await subButtonInteraction.update({
          embeds: [generateEmbed(currentPage)],
          components: generateComponents(currentPage)
        });
      } else if (subButtonInteraction.customId === 'list_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        await subButtonInteraction.update({
          embeds: [generateEmbed(currentPage)],
          components: generateComponents(currentPage)
        });
      } else if (subButtonInteraction.customId === 'list_detailed') {
        await showDetailedListFromButton(subButtonInteraction, files, totalSizeMB);
      }
    });

    collector.on('end', async () => {
      try {
        await response.edit({ components: [] });
      } catch (error) {
        // Ignore errors when editing expired interactions
      }
    });
  });
}

function showDetailedListFromButton(
  buttonInteraction: ButtonInteraction,
  files: AudioFile[],
  totalSizeMB: string
) {
  const itemsPerPage = 10;
  const totalPages = Math.ceil(files.length / itemsPerPage);
  let currentPage = 0;

  const generateDetailedEmbed = (page: number) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageFiles = files.slice(start, end);
    
    // Get the folder name for display
    const folderName = process.env.S3_FOLDER || 'audio';
    
    const embed = new EmbedBuilder()
      .setTitle('📋 Detailed File Information')
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({ text: `RDP Datacenter • ${folderName}/ folder • Cloud Storage` });

    pageFiles.forEach((file, index) => {
      const number = start + index + 1;
      const size = (file.size / 1024 / 1024).toFixed(2);
      const uploadDate = file.lastModified.toLocaleDateString();
      
      embed.addFields({
        name: `${number}. ${file.name}`,
        value: `📏 **Size:** ${size} MB\n📅 **Modified:** ${uploadDate}\n🔗 **URL:** [Direct Link](${file.url})`,
        inline: false
      });
    });

    embed.addFields(
      { name: '📊 Total Files', value: files.length.toString(), inline: true },
      { name: '💾 Total Size', value: `${totalSizeMB} MB`, inline: true },
      { name: '📄 Page', value: `${page + 1} of ${totalPages}`, inline: true }
    );

    return embed;
  };

  const generateDetailedComponents = (page: number) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    if (totalPages > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('detailed_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('detailed_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
    }
    
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('detailed_simple')
        .setLabel('📝 Simple View')
        .setStyle(ButtonStyle.Primary)
    );

    return [row];
  };

  return buttonInteraction.update({
    embeds: [generateDetailedEmbed(currentPage)],
    components: generateDetailedComponents(currentPage)
  }).then(response => {
    // Handle button interactions for detailed view
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (subButtonInteraction: ButtonInteraction) => {
      if (subButtonInteraction.user.id !== buttonInteraction.user.id) {
        await subButtonInteraction.reply({
          content: 'You can only interact with your own list command!',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (subButtonInteraction.customId === 'detailed_prev') {
        currentPage = Math.max(0, currentPage - 1);
        await subButtonInteraction.update({
          embeds: [generateDetailedEmbed(currentPage)],
          components: generateDetailedComponents(currentPage)
        });
      } else if (subButtonInteraction.customId === 'detailed_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        await subButtonInteraction.update({
          embeds: [generateDetailedEmbed(currentPage)],
          components: generateDetailedComponents(currentPage)
        });
      } else if (subButtonInteraction.customId === 'detailed_simple') {
        // Switch back to simple view
        await showSimpleListFromButton(subButtonInteraction, files, totalSizeMB);
      }
    });

    collector.on('end', async () => {
      try {
        await response.edit({ components: [] });
      } catch (error) {
        // Ignore errors when editing expired interactions
      }
    });
  });
}

export const listCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all available MP3 files from cloud storage')
    .addBooleanOption(option =>
      option.setName('detailed')
        .setDescription('Show detailed file information')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
    const { s3Service } = context;
    const showDetails = interaction.options.getBoolean('detailed') || false;
    
    await interaction.deferReply();
    
    try {
      const files = await s3Service.listFiles();
      
      if (files.length === 0) {
        // Get the folder name for display
        const folderName = process.env.S3_FOLDER || 'audio';
        
        const embed = new EmbedBuilder()
          .setTitle('📁 Cloud Storage Empty')
          .setDescription(`No MP3 files available in the ${folderName}/ folder. Upload some using \`/upload\`!`)
          .setColor(0xff8800)
          .setFooter({ text: 'RDP Datacenter • Cloud Storage' });
          
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Get total storage stats
      const totalSize = files.reduce((sum: number, file: AudioFile) => sum + file.size, 0);
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

      if (showDetails) {
        // Detailed view with file information
        await showDetailedList(interaction, files, totalSizeMB);
      } else {
        // Simple list view with pagination if needed
        await showSimpleList(interaction, files, totalSizeMB);
      }
      
    } catch (error) {
      console.error('❌ [S3] List files failed:', error);
      
      const embed = new EmbedBuilder()
        .setTitle('❌ Cloud Storage Error')
        .setDescription('Unable to retrieve file list from cloud storage. Please try again.')
        .setColor(0xff0000)
        .setFooter({ text: 'RDP Datacenter • Storage Error' });
        
      await interaction.editReply({ embeds: [embed] });
    }
  }
};

async function showSimpleList(
  interaction: ChatInputCommandInteraction, 
  files: AudioFile[], 
  totalSizeMB: string
) {
  const itemsPerPage = 20;
  const totalPages = Math.ceil(files.length / itemsPerPage);
  let currentPage = 0;

  const generateEmbed = (page: number) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageFiles = files.slice(start, end);
    
    const fileList = pageFiles.map((file, index) => {
      const number = start + index + 1;
      const size = (file.size / 1024).toFixed(1);
      return `${number}. **${file.name}** (${size} KB)`;
    }).join('\n');

    // Get the folder name for display
    const folderName = process.env.S3_FOLDER || 'audio';

    return new EmbedBuilder()
      .setTitle('🎵 Available MP3 Files')
      .setDescription(fileList)
      .addFields(
        { name: '📊 Storage Stats', value: `**${files.length}** files • **${totalSizeMB} MB** total`, inline: true },
        { name: '☁️ Source', value: `AWS S3 (${folderName}/ folder)`, inline: true },
        { name: '📄 Page', value: `${page + 1} of ${totalPages}`, inline: true }
      )
      .setColor(0x00AE86)
      .setTimestamp()
      .setFooter({ text: 'Use /play <filename> to play • Cloud-powered storage' });
  };

  const generateComponents = (page: number) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    if (totalPages > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('list_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('list_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
    }
    
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('list_detailed')
        .setLabel('📋 Detailed View')
        .setStyle(ButtonStyle.Primary)
    );

    return totalPages > 1 || row.components.length > 0 ? [row] : [];
  };

  const response = await interaction.editReply({
    embeds: [generateEmbed(currentPage)],
    components: generateComponents(currentPage)
  });

  if (totalPages <= 1 && !generateComponents(currentPage).length) return;

  // Handle button interactions
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: 'You can only interact with your own list command!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (buttonInteraction.customId === 'list_prev') {
      currentPage = Math.max(0, currentPage - 1);
    } else if (buttonInteraction.customId === 'list_next') {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
    } else if (buttonInteraction.customId === 'list_detailed') {
      await showDetailedListFromButton(buttonInteraction, files, totalSizeMB);
      return;
    }

    await buttonInteraction.update({
      embeds: [generateEmbed(currentPage)],
      components: generateComponents(currentPage)
    });
  });

  collector.on('end', async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch (error) {
      // Ignore errors when editing expired interactions
    }
  });
}

async function showDetailedList(
  interaction: ChatInputCommandInteraction,
  files: AudioFile[],
  totalSizeMB: string
) {
  const itemsPerPage = 10;
  const totalPages = Math.ceil(files.length / itemsPerPage);
  let currentPage = 0;

  const generateDetailedEmbed = (page: number) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageFiles = files.slice(start, end);
    
    // Get the folder name for display
    const folderName = process.env.S3_FOLDER || 'audio';
    
    const embed = new EmbedBuilder()
      .setTitle('📋 Detailed File Information')
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({ text: `RDP Datacenter • ${folderName}/ folder • Cloud Storage` });

    pageFiles.forEach((file, index) => {
      const number = start + index + 1;
      const size = (file.size / 1024 / 1024).toFixed(2);
      const uploadDate = file.lastModified.toLocaleDateString();
      
      embed.addFields({
        name: `${number}. ${file.name}`,
        value: `📏 **Size:** ${size} MB\n📅 **Modified:** ${uploadDate}\n🔗 **URL:** [Direct Link](${file.url})`,
        inline: false
      });
    });

    embed.addFields(
      { name: '📊 Total Files', value: files.length.toString(), inline: true },
      { name: '💾 Total Size', value: `${totalSizeMB} MB`, inline: true },
      { name: '📄 Page', value: `${page + 1} of ${totalPages}`, inline: true }
    );

    return embed;
  };

  const generateDetailedComponents = (page: number) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    if (totalPages > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('detailed_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('detailed_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );
    }
    
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('detailed_simple')
        .setLabel('📝 Simple View')
        .setStyle(ButtonStyle.Primary)
    );

    return [row];
  };

  let response;
  if (interaction.deferred || interaction.replied) {
    response = await interaction.editReply({
      embeds: [generateDetailedEmbed(currentPage)],
      components: generateDetailedComponents(currentPage)
    });
  } else {
    response = await interaction.reply({
      embeds: [generateDetailedEmbed(currentPage)],
      components: generateDetailedComponents(currentPage)
    });
  }

  // Handle button interactions for detailed view
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000 // 5 minutes
  });

  collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: 'You can only interact with your own list command!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (buttonInteraction.customId === 'detailed_prev') {
      currentPage = Math.max(0, currentPage - 1);
      await buttonInteraction.update({
        embeds: [generateDetailedEmbed(currentPage)],
        components: generateDetailedComponents(currentPage)
      });
    } else if (buttonInteraction.customId === 'detailed_next') {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
      await buttonInteraction.update({
        embeds: [generateDetailedEmbed(currentPage)],
        components: generateDetailedComponents(currentPage)
      });
    } else if (buttonInteraction.customId === 'detailed_simple') {
      // Switch back to simple view
      await showSimpleListFromButton(buttonInteraction, files, totalSizeMB);
      return; // Exit the collector since we switched views
    }
  });

  collector.on('end', async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch (error) {
      // Ignore errors when editing expired interactions
    }
  });
}