// src/handlers/commandHandler.ts
import { 
  Collection, 
  ChatInputCommandInteraction, 
  Message, 
  REST, 
  Routes,
  AutocompleteInteraction,
  MessageFlags
} from 'discord.js';
import { Command, TextCommand, BotContext } from '@/types/Command';
import fs from 'fs';
import path from 'path';
import { AudioFile } from '@/utils/s3';

interface CommandModule {
  [key: string]: any;
}

export class CommandHandler {
  private commands: Collection<string, Command> = new Collection();
  private textCommands: Collection<string, TextCommand> = new Collection();

  constructor() {
    this.loadCommands();
  }

  private async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, '../commands');
    await this.loadCommandsFromDirectory(commandsPath);
    
    console.log(`✅ Loaded ${this.commands.size} slash commands and ${this.textCommands.size} text commands`);
  }

  private async loadCommandsFromDirectory(directory: string): Promise<void> {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // Recursively load commands from subdirectories
        await this.loadCommandsFromDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        await this.loadCommandFromFile(fullPath, entry.name);
      }
    }
  }

  private async loadCommandFromFile(filePath: string, fileName: string): Promise<void> {
    try {
      // Convert absolute path to relative path for import
      const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
      const modulePath = `./${relativePath.replace(/\.(ts|js)$/, '')}`;
      
      const commandModule: CommandModule = await import(modulePath);
      
      // Load slash commands with proper type checking
      const commandExports = Object.values(commandModule).filter(
        (exp: any): exp is Command => {
          return (
            exp &&
            typeof exp === 'object' &&
            exp !== null &&
            'data' in exp &&
            'execute' in exp &&
            typeof exp.execute === 'function' &&
            exp.data &&
            typeof exp.data.name === 'string'
          );
        }
      );

      for (const command of commandExports) {
        this.commands.set(command.data.name, command);
        console.log(`📁 Loaded slash command: ${command.data.name} from ${fileName}`);
      }

      // Load text commands with proper type checking
      const textCommandExports = Object.values(commandModule).filter(
        (exp: any): exp is TextCommand => {
          return (
            exp &&
            typeof exp === 'object' &&
            exp !== null &&
            'name' in exp &&
            'execute' in exp &&
            typeof exp.execute === 'function' &&
            typeof exp.name === 'string' &&
            !('data' in exp) // Distinguish from slash commands
          );
        }
      );

      for (const textCommand of textCommandExports) {
        this.textCommands.set(textCommand.name, textCommand);
        console.log(`📝 Loaded text command: ${textCommand.name} from ${fileName}`);
      }

    } catch (error) {
      console.error(`❌ Failed to load command from ${fileName}:`, error);
    }
  }

  async handleSlashCommand(interaction: ChatInputCommandInteraction, context: BotContext): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, context);
    } catch (error) {
      console.error('Error executing slash command:', error);
      
      const errorMessage = '❌ There was an error while executing this command!';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ 
          content: errorMessage, 
          flags: MessageFlags.Ephemeral 
        });
      }
    }
  }

  async handleTextCommand(message: Message, context: BotContext): Promise<void> {
    // Handle mentions
    if (message.mentions.has(context.client.user!)) {
      const args = message.content.replace(`<@${context.client.user!.id}>`, '').trim().split(' ');
      const fileName = args[0];
      
      // Try to find a mention handler (usually in audio/play.ts)
      try {
        const { handleMention } = await import('../commands/audio/play');
        if (typeof handleMention === 'function') {
          await handleMention(message, fileName, context);
        } else {
          await message.reply('Please specify an MP3 file name! Example: `@RDP Soundboard filename.mp3`');
        }
      } catch (error) {
        console.error('No mention handler found:', error);
        await message.reply('Please specify an MP3 file name! Example: `@RDP Soundboard filename.mp3`');
      }
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
      await message.reply('❌ There was an error while executing this command!');
    }
  }

  async handleAutocomplete(interaction: AutocompleteInteraction, context: BotContext): Promise<void> {
    try {
      // Handle play command autocomplete with S3
      if (interaction.commandName === 'play') {
        const focusedValue = interaction.options.getFocused();
        
        try {
          const files = await this.getAvailableFilesFromS3(context);
          const filtered = files.filter(file => 
            file.toLowerCase().includes(focusedValue.toLowerCase())
          ).slice(0, 25);
  
          await interaction.respond(
            filtered.map(file => ({ name: file, value: file }))
          );
        } catch (error) {
          console.error('❌ [S3] Autocomplete error for play command:', error);
          await interaction.respond([]);
        }
        return;
      }
  
      // Handle delete command autocomplete with S3
      if (interaction.commandName === 'delete') {
        const focusedValue = interaction.options.getFocused();
        
        try {
          const files = await this.getAvailableFilesFromS3(context);
          const filtered = files.filter(file => 
            file.toLowerCase().includes(focusedValue.toLowerCase())
          ).slice(0, 25);
  
          await interaction.respond(
            filtered.map(file => ({ name: file, value: file }))
          );
        } catch (error) {
          console.error('❌ [S3] Autocomplete error for delete command:', error);
          await interaction.respond([]);
        }
        return;
      }
      
      // Handle rename command autocomplete with S3
      if (interaction.commandName === 'rename') {
        // Find the command in the collection
        const command = this.commands.get('rename');
        
        // If the command has an autocomplete handler, use it
        if (command && 'autocomplete' in command && typeof command.autocomplete === 'function') {
          await command.autocomplete(interaction, context);
          return;
        }
        
        // Fallback to basic autocomplete if the command doesn't have a specific handler
        const focusedOption = interaction.options.getFocused(true);
        
        try {
          if (focusedOption.name === 'current') {
            const files = await this.getAvailableFilesFromS3(context);
            const filtered = files.filter(file => 
              file.toLowerCase().includes(focusedOption.value.toLowerCase())
            ).slice(0, 25);
  
            await interaction.respond(
              filtered.map(file => ({ name: file, value: file }))
            );
          } else {
            // For the new filename, don't offer suggestions
            await interaction.respond([]);
          }
        } catch (error) {
          console.error('❌ [S3] Autocomplete error for rename command:', error);
          await interaction.respond([]);
        }
        return;
      }
  
      // Default empty response for unhandled autocomplete
      await interaction.respond([]);
  
    } catch (error) {
      console.error('❌ Error in autocomplete:', error);
      try {
        await interaction.respond([]);
      } catch (responseError) {
        console.error('❌ Failed to send empty autocomplete response:', responseError);
      }
    }
  }  

  // Helper method to get available files from S3
  private async getAvailableFilesFromS3(context: BotContext): Promise<string[]> {
    try {
      const { s3Service } = context;
      const files = await s3Service.listFiles();
      return files.map((file: AudioFile) => file.name).sort();
    } catch (error) {
      console.error('❌ [S3] Error getting available files for autocomplete:', error);
      return [];
    }
  }

  async registerCommands(token: string, clientId: string): Promise<void> {
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

  getCommandsList(): { slashCommands: string[]; textCommands: string[] } {
    return {
      slashCommands: Array.from(this.commands.keys()),
      textCommands: Array.from(this.textCommands.keys())
    };
  }

  // Get commands organized by category for help command
  getCommandsByCategory(): Record<string, string[]> {
    const categories: Record<string, string[]> = {};
    
    this.commands.forEach((command) => {
      const category = this.getCategoryFromCommandName(command.data.name);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(command.data.name);
    });

    return categories;
  }

  private getCategoryFromCommandName(commandName: string): string {
    // Audio commands
    if (['play', 'stop', 'volume', 'list'].includes(commandName)) {
      return 'Audio';
    }
    
    // Admin commands
    if (['upload', 'delete', 'cleanup', 'stats'].includes(commandName)) {
      return 'Administration';
    }
    
    // Utility commands
    if (['ping', 'help'].includes(commandName)) {
      return 'Utility';
    }

    return 'Other';
  }
}