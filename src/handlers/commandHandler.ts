import { 
  Collection, 
  ChatInputCommandInteraction, 
  Message, 
  REST, 
  Routes,
  AutocompleteInteraction,
  MessageFlags
} from 'discord.js';
import { Command, TextCommand, CommandContext } from '@/types/Command';
import { handleMention, isBotMention } from '@/utils/handleMention';
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

  async handleSlashCommand(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, context);
    } catch (error) {
      console.error(`❌ Error executing slash command in server ${context.guildId}:`, error);
      
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

  async handleTextCommand(message: Message, context: CommandContext): Promise<void> {
    // Handle bot mentions using the utility function
    if (isBotMention(message, context.client.user?.id || '')) {
      await handleMention(message, context);
      return;
    }

    // Handle direct mentions for file playback
    if (message.mentions.has(context.client.user!)) {
      const args = message.content.replace(`<@${context.client.user!.id}>`, '').trim().split(' ');
      const fileName = args[0];
      
      if (fileName) {
        // Try to play the mentioned file
        try {
          // Check if file exists in S3
          const files = await context.s3Service.listFiles(context.guildId);
          const fileExists = files.some(file => file.name.toLowerCase() === fileName.toLowerCase());
          
          if (fileExists) {
            // Create a simulated play command
            const playCommand = this.textCommands.get('play');
            if (playCommand) {
              await playCommand.execute(message, [fileName], context);
            } else {
              await message.reply(`❌ Play command not found. File "${fileName}" exists but cannot be played.`);
            }
          } else {
            await message.reply(`❌ File "${fileName}" not found. Use \`!list\` to see available files.`);
          }
        } catch (error) {
          console.error(`❌ Error playing mentioned file for server ${context.guildId}:`, error);
          await message.reply('❌ Error accessing audio files. Please try again.');
        }
      } else {
        await message.reply('Please specify an audio file name! Example: `@RDP Soundboard filename.mp3`');
      }
      return;
    }
  
    // Get server-specific prefix if in a guild
    let prefix = '!'; // Default fallback prefix
    try {
      if (context.guildId !== 'global') {
        const serverSettings = await context.dbService.getServerSettings(context.guildId);
        prefix = serverSettings.prefix || '!';
      }
    } catch (error) {
      console.error(`❌ Error getting server prefix for ${context.guildId}:`, error);
      // Continue with default prefix if there's an error
    }
  
    // Check if message starts with the server's prefix
    if (!message.content.startsWith(prefix)) return;
  
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
  
    if (!commandName) return;
  
    // Check for aliases
    const command = this.textCommands.get(commandName) || this.findCommandByAlias(commandName);
    
    if (!command) return;
  
    try {
      await command.execute(message, args, context);
    } catch (error) {
      console.error(`❌ Error executing text command in server ${context.guildId}:`, error);
      await message.reply('❌ There was an error while executing this command!');
    }
  }

  // Helper method to find command by alias
  private findCommandByAlias(alias: string): TextCommand | undefined {
    for (const command of this.textCommands.values()) {
      if (command.aliases && command.aliases.includes(alias)) {
        return command;
      }
    }
    return undefined;
  }

  async handleAutocomplete(interaction: AutocompleteInteraction, context: CommandContext): Promise<void> {
    try {
      // Get the guild ID from the context
      const { s3Service, guildId } = context;

      // Handle play command autocomplete with S3
      if (interaction.commandName === 'play') {
        const focusedValue = interaction.options.getFocused();
        
        try {
          // Get server-specific files
          const files = await s3Service.listFiles(guildId);
          const filenames = files.map(file => file.name);
          
          // Filter by what user has typed so far
          const filtered = filenames.filter(name => 
            name.toLowerCase().includes(focusedValue.toLowerCase())
          ).slice(0, 25); // Discord max choices is 25

          await interaction.respond(
            filtered.map(file => ({ name: file, value: file }))
          );
        } catch (error) {
          console.error(`❌ [S3] Autocomplete error for play command for server ${guildId}:`, error);
          await interaction.respond([]);
        }
        return;
      }

      // Handle delete command autocomplete with S3
      if (interaction.commandName === 'delete') {
        const focusedValue = interaction.options.getFocused();
        
        try {
          // Get server-specific files
          const files = await s3Service.listFiles(guildId);
          const filenames = files.map(file => file.name);
          
          // Filter by what user has typed so far
          const filtered = filenames.filter(name => 
            name.toLowerCase().includes(focusedValue.toLowerCase())
          ).slice(0, 25);

          await interaction.respond(
            filtered.map(file => ({ name: file, value: file }))
          );
        } catch (error) {
          console.error(`❌ [S3] Autocomplete error for delete command for server ${guildId}:`, error);
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
            // Get server-specific files
            const files = await s3Service.listFiles(guildId);
            const filenames = files.map(file => file.name);
            
            // Filter by what user has typed so far
            const filtered = filenames.filter(name => 
              name.toLowerCase().includes(focusedOption.value.toLowerCase())
            ).slice(0, 25);

            await interaction.respond(
              filtered.map(file => ({ name: file, value: file }))
            );
          } else {
            // For the new filename, don't offer suggestions
            await interaction.respond([]);
          }
        } catch (error) {
          console.error(`❌ [S3] Autocomplete error for rename command for server ${guildId}:`, error);
          await interaction.respond([]);
        }
        return;
      }

      // Handle other command autocompletions by delegating to the command's autocomplete method
      const command = this.commands.get(interaction.commandName);
      if (command && 'autocomplete' in command && typeof command.autocomplete === 'function') {
        await command.autocomplete(interaction, context);
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

  // Helper method to get available files from S3 for a specific server
  private async getAvailableFilesFromS3(context: CommandContext): Promise<string[]> {
    try {
      const { s3Service, guildId } = context; // Get the guild ID from context
      
      // Pass the guildId to the listFiles method
      const files = await s3Service.listFiles(guildId);
      
      return files.map((file: AudioFile) => file.name).sort();
    } catch (error) {
      console.error(`❌ [S3] Error getting available files for server ${context.guildId}:`, error);
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
    if (['play', 'stop', 'volume', 'list', 'song', 'skip', 'pause', 'queue'].includes(commandName)) {
      return 'Audio';
    }
    
    // Admin commands
    if (['upload', 'delete', 'rename', 'cleanup', 'stats'].includes(commandName)) {
      return 'Administration';
    }
    
    // Utility commands
    if (['ping', 'help'].includes(commandName)) {
      return 'Utility';
    }

    return 'Other';
  }
}