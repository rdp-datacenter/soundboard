# 🎵 RDP Soundboard Discord Bot

A feature-rich Discord soundboard bot that plays MP3 files in voice channels. Perfect for adding memes, sound effects, and audio clips to your Discord server.

## ✨ Features

- 🎵 **Audio Playbook** - Play MP3 files in voice channels with autocomplete
- 🔊 **Volume Control** - Adjust playback volume (0-100%)
- 📁 **File Management** - Upload, delete, and list audio files
- 🛡️ **Permission System** - Admin-only commands with role-based access
- 💬 **Multiple Interfaces** - Slash commands, text commands, and bot mentions
- 🧹 **Maintenance Tools** - File cleanup and bot statistics
- 📊 **Interactive Help** - Organized command help with category buttons

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- FFmpeg installed on your system

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rdp-datacenter/soundboard.git
   cd soundboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   ```
   Edit `.env` and add your bot credentials:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_client_id_here
   ```

4. **Build and start**
   ```bash
   npm run build
   npm start
   ```

## 🎯 Commands

### 🎵 Audio Commands
- `/play <filename>` - Play an MP3 file in voice channel
- `/stop` - Stop audio and leave voice channel  
- `/volume [level]` - Set or check volume (0-100%)
- `/list` - Show all available MP3 files

### ⚙️ Admin Commands
- `/upload <file>` - Upload MP3 files (Admin only)
- `/delete <filename>` - Delete audio files (Admin only)
- `/cleanup` - Remove corrupted files (Owner only)
- `/stats` - Show bot statistics (Admin only)

### 🛠️ Utility Commands
- `/ping` - Check bot latency
- `/help [category]` - Interactive command help

### 📝 Text Commands & Mentions
- `!play filename.mp3` - Alternative to slash commands
- `@RDP Soundboard filename.mp3` - Play via bot mention
- `!help`, `!ping`, `!volume 75` - Text equivalents

## 📁 Project Structure

```
src/
├── commands/
│   ├── audio/          # Music & playback commands
│   │   ├── play.ts
│   │   ├── stop.ts
│   │   ├── volume.ts
│   │   └── list.ts
│   ├── admin/          # Administrative commands
│   │   ├── upload.ts
│   │   ├── delete.ts
│   │   ├── cleanup.ts
│   │   └── stats.ts
│   └── utility/        # General utilities
│       ├── ping.ts
│       └── help.ts
├── handlers/
│   └── commandHandler.ts  # Auto-discovery command loader
├── types/
│   └── Command.ts         # TypeScript interfaces
├── utils/
│   └── permissions.ts     # Permission checking utilities
└── index.ts              # Main bot entry point
```

## 🔧 Configuration

### Audio Files
- Place MP3 files in the `./audio/` directory
- Maximum file size: 25MB (Discord limit)
- Supported format: MP3 only

### Permissions
- **Members**: Can use audio playback commands
- **Administrators**: Can upload/delete files and view stats
- **Owner**: Can perform cleanup operations

## 🛠️ Development

### Scripts
```bash
npm run dev      # Development mode with hot reload
npm run build    # Compile TypeScript
npm run start    # Start production bot
npm run watch    # Watch mode compilation
```

### Adding New Commands
1. Create command file in appropriate subfolder (`src/commands/category/`)
2. Export command object with `data` and `execute` properties
3. The command handler will automatically discover and load it

### Environment Variables
- `DISCORD_TOKEN` - Your bot's token
- `CLIENT_ID` - Your Discord application's client ID

## 📋 Features in Detail

- **🔍 Auto-Discovery**: Commands are automatically loaded from subfolders
- **🛡️ Type Safety**: Full TypeScript support with proper error handling  
- **🎛️ Volume Control**: Real-time volume adjustment during playback
- **📝 Autocomplete**: File name suggestions for play/delete commands
- **🧹 Maintenance**: Built-in file cleanup and health monitoring
- **📊 Statistics**: Comprehensive bot usage and performance metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Node.js Download](https://nodejs.org/)

## 🐛 Issues & Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/rdp-datacenter/soundboard/issues) page
2. Create a new issue with detailed information
3. Include error logs and system information

---

<div align="center">
  <strong>Made with ❤️ for Discord Communities</strong><br>
  <sub>Keep your server entertained with quality sound effects and audio clips!</sub>
</div>