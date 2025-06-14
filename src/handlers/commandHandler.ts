import { Collection, ChatInputCommandInteraction, Message, REST, Routes } from 'discord.js';
import { Command, TextCommand, BotContext } from '../types/Command';

// Import all commands
import { playCommand, playTextCommand, handleMention, getAvailableFiles } from '../commands/play';
import { stopCommand } from '../commands/stop';
import { listCommand } from '../commands/list';
import { uploadCommand } from '../commands/upload';
import { pingCommand, pingTextCommand } from '../commands/ping';

export class CommandHandler {
  private commands: Collection<string, Command> = new Collection();
  private textCommands: Collection<string, TextCommand> = new Collection();

  constructor() {
    this.loadCommands();
  }

  private loadCommands() {
    // Load slash commands
    const slashCommands = [
      playCommand,
      stopCommand,
      listCommand,
      uploadCommand,
      pingCommand
    ];

    slashCommands.forEach(command => {
      this.commands.set(command.data.name, command);
    });

    // Load text commands
    const textCommandsList = [
      playTextCommand,
      pingTextCommand
    ];

    textCommandsList.forEach(command => {
      this.textCommands.set(command.name, command);
    });

    console.log(`✅ Loaded ${this.commands.size} slash commands and ${this.textCommands.size} text commands`);
  }

  async handleSlashCommand(interaction: ChatInputCommandInteraction, context: BotContext) {
    const command = this.commands.get(interaction.commandName);
    
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, context);
    } catch (error) {
      console.error('Error executing slash command:', error);
      
      const errorMessage = 'There was an error while executing this command!';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  async handleTextCommand(message: Message, context: BotContext) {
    // Handle mentions
    if (message.mentions.has(context.client.user!)) {
      const args = message.content.replace(`<@${context.client.user!.id}>`, '').trim().split(' ');
      const fileName = args[0];
      await handleMention(message, fileName, context);
      return;
    }

    // Handle text commands
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = this.textCommands.get(commandName);
    
    if (!command) return;

    try {
      await command.execute(message, args, context);
    } catch (error) {
      console.error('Error executing text command:', error);
      await message.reply('There was an error while executing this command!');
    }
  }

  async handleAutocomplete(interaction: any, context: BotContext) {
    if (interaction.commandName === 'play') {
      const focusedValue = interaction.options.getFocused();
      const files = getAvailableFiles(context.audioFolder);
      const filtered = files.filter(file => 
        file.toLowerCase().includes(focusedValue.toLowerCase())
      ).slice(0, 25);

      await interaction.respond(
        filtered.map(file => ({ name: file, value: file }))
      );
    }
  }

  async registerCommands(token: string, clientId: string) {
    const commandsData = Array.from(this.commands.values()).map(command => command.data.toJSON());
    
    const rest = new REST({ version: '10' }).setToken(token);

    try {
      console.log('🔄 Starting to refresh application (/) commands...');
      
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commandsData }
      );

      console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error('❌ Error registering commands:', error);
    }
  }

  getCommandsList() {
    return {
      slashCommands: Array.from(this.commands.keys()),
      textCommands: Array.from(this.textCommands.keys())
    };
  }
}
