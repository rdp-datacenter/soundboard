import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    GuildMember,
    MessageFlags,
    AutocompleteInteraction
  } from 'discord.js';
  import { Command, CommandContext } from '@/types/Command';
  import { PermissionChecker } from '@/utils/permissions';
  
  export const renameCommand: Command = {
    data: new SlashCommandBuilder()
      .setName('rename')
      .setDescription('Rename an MP3 file in cloud storage (Admin only)')
      .addStringOption(option =>
        option.setName('current')
          .setDescription('Current file name to rename')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option.setName('new')
          .setDescription('New file name (must end with .mp3)')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
    async execute(interaction: ChatInputCommandInteraction, context: CommandContext) {
      const { s3Service } = context;
      const member = interaction.member as GuildMember;
      
      // Check admin permissions
      if (!PermissionChecker.isAdmin(member)) {
        await PermissionChecker.sendPermissionDenied(interaction);
        return;
      }
  
      const currentFileName = interaction.options.getString('current', true);
      let newFileName = interaction.options.getString('new', true);
      
      // Ensure new filename has .mp3 extension
      if (!newFileName.toLowerCase().endsWith('.mp3')) {
        newFileName += '.mp3';
      }
      
      // Validate filenames
      if (currentFileName === newFileName) {
        await interaction.reply({
          content: '❌ The new file name must be different from the current name.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
  
      // Check if source file exists in S3
      try {
        const fileExists = await s3Service.fileExists(currentFileName);
        if (!fileExists) {
          await interaction.reply({
            content: `❌ File **${currentFileName}** not found in cloud storage!`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      } catch (error) {
        console.error('❌ [S3] Error checking file existence:', error);
        await interaction.reply({
          content: '❌ Unable to access cloud storage. Please try again.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Check if destination file already exists
      try {
        const destExists = await s3Service.fileExists(newFileName);
        if (destExists) {
          await interaction.reply({
            content: `❌ File **${newFileName}** already exists in cloud storage! Please choose a different name or delete the existing file first.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      } catch (error) {
        console.error('❌ [S3] Error checking destination file:', error);
        await interaction.reply({
          content: '❌ Unable to check destination file. Please try again.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
  
      await interaction.deferReply();
  
      try {
        // Get file info before renaming for the confirmation embed
        let fileInfo = null;
        try {
          fileInfo = await s3Service.getFileInfo(currentFileName);
        } catch (error) {
          // Continue with renaming even if we can't get file info
          console.warn('⚠️ [S3] Could not get file info before renaming:', error);
        }
  
        // Get the folder name for display
        const folderName = process.env.S3_FOLDER || 'audio';
  
        // 1. Copy the file to the new name
        const fileStream = await s3Service.getFileStream(currentFileName);
        const bufferChunks: Uint8Array[] = [];
        
        for await (const chunk of fileStream) {
          bufferChunks.push(chunk);
        }
        
        const fileBuffer = Buffer.concat(bufferChunks);
        
        // Upload with the new name
        await s3Service.uploadFile(newFileName, fileBuffer, 'audio/mpeg');
        
        // 2. Delete the old file
        await s3Service.deleteFile(currentFileName);
        
        // Log the rename operation
        console.log(`🔄 [RENAME] ${member.displayName} (${member.id}) renamed file in S3 ${folderName}/ folder: ${currentFileName} → ${newFileName}`);
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Audio File Renamed')
          .setDescription(`Successfully renamed file in cloud storage.`)
          .addFields(
            { name: '📁 Original Name', value: currentFileName, inline: true },
            { name: '📁 New Name', value: newFileName, inline: true },
            { name: '👤 Renamed by', value: member.displayName, inline: true },
            { name: '☁️ Storage', value: `AWS S3 (${folderName}/ folder)`, inline: true }
          )
          .setColor(0x00AE86)
          .setTimestamp()
          .setFooter({ text: 'RDP Datacenter • Cloud File Management' });
  
        // Add file size info if we got it
        if (fileInfo) {
          const fileSizeMB = (fileInfo.size / 1024 / 1024).toFixed(2);
          embed.addFields(
            { name: '📏 File Size', value: `${fileSizeMB} MB`, inline: true },
            { name: '📅 Last Modified', value: fileInfo.lastModified.toLocaleDateString(), inline: true }
          );
        }
  
        // Add usage field
        embed.addFields(
          { name: '🎵 How to Play', value: `Use \`/play ${newFileName}\` or \`@RDP Soundboard ${newFileName}\``, inline: false }
        );
  
        await interaction.editReply({ embeds: [embed] });
  
        // Update bucket stats for logging
        try {
          const stats = await s3Service.getBucketStats();
          console.log(`📊 [S3] After rename - Total files: ${stats.fileCount}, Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
        } catch (error) {
          // Don't fail the command if stats fail
          console.error('⚠️ [S3] Failed to get bucket stats after rename:', error);
        }
        
      } catch (error) {
        console.error('❌ [ERROR] S3 Rename failed:', error);
        
        let errorMessage = '❌ Failed to rename file in cloud storage.';
        
        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes('credentials')) {
            errorMessage += ' (AWS credentials issue)';
          } else if (error.message.includes('bucket')) {
            errorMessage += ' (S3 bucket access issue)';
          } else if (error.message.includes('permissions')) {
            errorMessage += ' (Insufficient permissions)';
          } else if (error.message.includes('network')) {
            errorMessage += ' (Network connectivity issue)';
          }
        }
        
        errorMessage += ' Please contact the system administrator.';
        
        await interaction.editReply({
          content: errorMessage
        });
      }
    },
    
    // Add autocomplete handler for both current and new filename fields
    async autocomplete(interaction: AutocompleteInteraction, context: CommandContext) {
      const { s3Service } = context;
      const focusedOption = interaction.options.getFocused(true);
      
      try {
        if (focusedOption.name === 'current') {
          // For current filename, show existing files
          const files = await s3Service.listFiles();
          const filenames = files.map(file => file.name);
          
          // Filter by what user has typed so far
          const filtered = filenames.filter(name => 
            name.toLowerCase().includes(focusedOption.value.toLowerCase())
          ).slice(0, 25); // Discord max choices is 25
          
          await interaction.respond(
            filtered.map(filename => ({ name: filename, value: filename }))
          );
        } 
        else if (focusedOption.name === 'new') {
          // For new filename, suggest a variation of existing files
          const files = await s3Service.listFiles();
          const currentFileInput = interaction.options.getString('current') || '';
          const userInput = focusedOption.value.toLowerCase();
          
          // Find files with similar names for suggestions
          let suggestions: string[] = [];
          
          // If there's a current file selected, offer variations of its name
          if (currentFileInput) {
            // Remove extension for better suggestions
            const baseName = currentFileInput.replace(/\.mp3$/i, '');
            
            // Add some variations
            suggestions.push(`${baseName}_new.mp3`);
            suggestions.push(`${baseName}_2.mp3`);
            suggestions.push(`${baseName}_edit.mp3`);
            
            // If user has typed something, use it as a suggestion
            if (userInput) {
              if (!userInput.endsWith('.mp3')) {
                suggestions.push(`${userInput}.mp3`);
              } else {
                suggestions.push(userInput);
              }
            }
          } 
          
          // Add other files as suggestions if they match user input
          const otherFiles = files.map(file => file.name)
            .filter(name => name.toLowerCase().includes(userInput))
            .slice(0, 5); // Limit to 5 matches
          
          suggestions = [...suggestions, ...otherFiles];
          
          // Remove duplicates and ensure we don't suggest the current file
          const uniqueSuggestions = [...new Set(suggestions)]
            .filter(name => name !== currentFileInput)
            .slice(0, 25); // Discord max
            
          await interaction.respond(
            uniqueSuggestions.map(filename => ({ name: filename, value: filename }))
          );
        }
      } catch (error) {
        console.error('❌ [S3] Autocomplete error:', error);
        // Return empty results on error
        await interaction.respond([]);
      }
    }
  };