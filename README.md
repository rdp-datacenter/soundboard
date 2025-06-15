# 🎵 RDP Soundboard Discord Bot

A feature-rich Discord soundboard bot with **AWS S3 cloud storage** that plays MP3 files in voice channels. Built for scalability and global accessibility.

## ✨ Features

- 🎵 **Cloud Audio Playback** - Stream MP3 files directly from AWS S3
- ☁️ **Cloud Storage** - Store unlimited audio files in AWS S3
- 📁 **Organized Storage** - Files stored in configurable S3 folders
- 🚪 **Auto-Leave** - Bot automatically leaves voice channel after playback
- 🔊 **Volume Control** - Adjust playback volume (0-100%)
- 📁 **File Management** - Upload, delete, and list audio files
- 🛡️ **Permission System** - Admin-only commands with role-based access
- 💬 **Multiple Interfaces** - Slash commands, text commands, and bot mentions
- 🧹 **Maintenance Tools** - Cloud file cleanup and comprehensive statistics
- 📊 **Interactive Help** - Organized command help with category buttons
- 🌍 **Global Performance** - CDN-like streaming from AWS infrastructure
- 📈 **Scalability** - Handle thousands of audio files without local storage limits

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- **AWS Account** with S3 access
- FFmpeg installed on your system

### AWS S3 Setup

1. **Create S3 Bucket**
   - Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
   - Create bucket (e.g., `rdp-soundboard`)
   - Enable public read access for audio files
   - Configure bucket policy for public access

2. **Create IAM User**
   - Create user with S3 permissions: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`
   - Generate access keys for the bot

3. **Configure Environment**
   - Set up AWS credentials and bucket information
   - Configure S3 base URL for public access

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
   Edit `.env` and add your credentials:
   ```env
   # Discord Configuration
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_client_id_here

   # AWS S3 Configuration
   AWS_ACCESS_KEY_ID=your_aws_access_key_here
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
   AWS_REGION=ap-south-1
   S3_BUCKET_NAME=your_bucket_name
   S3_BASE_URL=https://bucket-name.region.s3.amazonaws.com
   S3_FOLDER=audio
   ```

4. **Test S3 connection**
   ```bash
   npm run test:s3
   ```

5. **Build and start**
   ```bash
   npm run build
   npm start
   ```

## 🎯 Commands

### 🎵 Audio Commands
- `/play <filename>` - Play an MP3 file from cloud storage
- `/stop` - Stop audio and leave voice channel  
- `/volume [level]` - Set or check volume (0-100%)
- `/list [detailed]` - Show all available MP3 files with cloud info

### ⚙️ Admin Commands
- `/upload <file>` - Upload MP3 files to cloud storage (Admin only)
- `/delete <filename>` - Delete audio files from cloud (Admin only)
- `/cleanup` - Remove corrupted files from S3 (Owner only)
- `/stats` - Show bot and cloud storage statistics (Admin only)

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
|   └── s3.ts              # S3 Utility
└── index.ts               # Main bot entry point
```

## 🔧 Configuration

### Cloud Storage (AWS S3)
- **Bucket Setup**: Create S3 bucket with public read access
- **Storage Location**: Global AWS infrastructure
- **File Organization**: Files stored in configurable folders (default: `audio/`)
- **Folder Structure**: All MP3 files are stored in the S3_FOLDER path (e.g., `audio/yourfile.mp3`)
- **File Limits**: Virtually unlimited storage capacity
- **Supported Formats**: MP3 files only
- **Access**: Files accessible via direct S3 URLs
- **Performance**: CDN-like global distribution
- **Auto-Cleanup**: Bot automatically leaves voice channels after playback

### S3 Folder Organization
- **Folder Path**: Set via `S3_FOLDER` environment variable (default: "audio")
- **Benefits**: Better organization, easier management, cleaner bucket structure
- **File References**: All commands automatically use the configured folder
- **URL Format**: `https://your-bucket.s3.region.amazonaws.com/audio/filename.mp3`
- **Flexible**: Can be changed to any folder name (e.g., "sounds", "effects", "music")
- **Path Display**: All commands display the current folder path for clarity

### Local Storage (Backward Compatibility)
- **Local Files**: `./audio/` directory (deprecated)
- **Migration**: Use migration script to move to S3
- **Fallback**: Local files work if S3 is unavailable

### Permissions
- **Members**: Can use audio playback commands
- **Administrators**: Can upload/delete files and view stats
- **Owner**: Can perform cleanup operations

## 🛠️ Development

### Available Scripts
The following npm scripts are available in `package.json`:

```bash
npm run build       # Compile TypeScript using tsc and tsc-alias
npm run test:s3     # Test S3 connection and configuration
npm run start       # Start the bot from compiled JavaScript
npm run dev         # Run the bot directly using ts-node (development mode)
npm run watch       # Watch for changes and recompile TypeScript
npm run clean       # Remove the dist directory
```

### Adding New Commands
1. Create command file in appropriate subfolder (`src/commands/category/`)
2. Export command object with `data` and `execute` properties
3. The command handler will automatically discover and load it

### Environment Variables
- `DISCORD_TOKEN` - Your bot's token
- `CLIENT_ID` - Your Discord application's client ID
- `AWS_ACCESS_KEY_ID` - AWS access key for S3
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for S3
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `S3_BUCKET_NAME` - Your S3 bucket name
- `S3_BASE_URL` - Public S3 URL for your bucket
- `S3_FOLDER` - Folder inside S3 bucket (default: "audio")

## 📋 Features in Detail

- **☁️ Cloud-First Architecture**: Files stored in AWS S3 for global accessibility
- **📁 Organized Folder Structure**: All files stored in a dedicated S3 folder for better organization
- **🔍 Auto-Discovery**: Commands are automatically loaded from subfolders
- **🛡️ Type Safety**: Full TypeScript support with proper error handling  
- **🎛️ Volume Control**: Real-time volume adjustment during playback
- **📝 Autocomplete**: File name suggestions from cloud storage
- **🧹 Cloud Maintenance**: Built-in S3 file cleanup and health monitoring
- **📊 Advanced Statistics**: Comprehensive bot, storage, and cost analytics
- **🌍 Global Performance**: Stream audio from AWS edge locations
- **💾 Unlimited Storage**: No local disk space limitations
- **🔄 Auto-Scaling**: Handle any number of audio files
- **💰 Cost Tracking**: Monitor and estimate AWS S3 costs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENCE) file for details.

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