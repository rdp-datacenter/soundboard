# 🎵 RDP Soundboard Discord Bot

A feature-rich Discord soundboard bot with **multi-tenant AWS S3 cloud storage** and **PostgreSQL database integration** that plays MP3 files in voice channels. Built for scalability, server isolation, and global accessibility.

## ✨ Features

- 🎵 **Cloud Audio Playback** - Stream MP3 files directly from AWS S3
- 🏠 **Multi-Tenant Architecture** - Complete data isolation per Discord server
- ☁️ **Cloud Storage** - Store unlimited audio files in AWS S3 with server-specific folders
- 🗄️ **Database Integration** - PostgreSQL support for persistent data and analytics
- 📁 **Organized Storage** - Files stored in server-specific S3 folders (`audio/{server_id}/`)
- 🚪 **Auto-Leave** - Bot automatically leaves voice channel after playback
- 🔊 **Volume Control** - Adjust playback volume (0-100%)
- 🎛️ **Advanced Configuration** - Custom prefixes, default volume, and server settings
- 📝 **File Management** - Upload, delete, rename, and organize audio files per server
- 🛡️ **Permission System** - Admin-only commands with role-based access
- 💬 **Multiple Interfaces** - Slash commands, text commands, and bot mentions
- 🧹 **Maintenance Tools** - Cloud file cleanup and comprehensive statistics
- 📊 **Interactive Help** - Organized command help with category buttons
- 🌍 **Global Performance** - CDN-like streaming from AWS infrastructure
- 📈 **Scalability** - Handle thousands of servers with isolated storage

## 🏗️ Multi-Tenant Architecture

### Server Isolation
- **Isolated Storage**: Each Discord server has its own S3 folder (`audio/{server_id}/`)
- **Data Separation**: Complete isolation between different Discord servers
- **Independent Collections**: Servers cannot access each other's audio files
- **Scalable Design**: Supports unlimited servers with automatic folder creation

### Database Integration
- **PostgreSQL Support**: Persistent data storage via Neon database
- **Future Analytics**: Ready for user stats, play counts, and usage tracking
- **Connection Pooling**: Efficient database connections with automatic cleanup
- **Schema Ready**: Extensible database design for future features

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- **AWS Account** with S3 access
- **PostgreSQL Database** (Neon recommended)
- FFmpeg installed on your system

### Database Setup (Neon PostgreSQL)

1. **Create Neon Account**
   - Go to [Neon Console](https://console.neon.tech/)
   - Create a new project
   - Get connection string from dashboard

2. **Database Configuration**
   - Database will auto-initialize on first run
   - Connection pooling enabled by default
   - SSL connections enforced

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

   # Database Configuration
   NEON_DB_URL=postgresql://username:password@hostname/database?sslmode=require

   # AWS S3 Configuration
   AWS_ACCESS_KEY_ID=your_aws_access_key_here
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
   AWS_REGION=ap-south-1
   S3_BUCKET_NAME=your_bucket_name
   S3_BASE_URL=https://bucket-name.region.s3.amazonaws.com
   S3_FOLDER=audio
   ```

4. **Test connections**
   ```bash
   npm run test:s3
   npm run test:db
   ```

5. **Build and start**
   ```bash
   npm run build
   npm start
   ```

## 🎯 Commands

### 🎵 Audio Commands
- `/play <filename>` - Play an MP3 file from your server's cloud storage
- `/stop` - Stop audio and leave voice channel  
- `/volume [level]` - Set or check volume (0-100%)
- `/list [detailed]` - Show all available MP3 files in your server's collection

### ⚙️ Admin Commands
- `/upload <file>` - Upload MP3 files to your server's cloud storage (Admin only)
- `/delete <filename>` - Delete audio files from your server's storage (Admin only)
- `/rename <oldname> <newname>` - Rename files in your server's collection (Admin only)
- `/cleanup` - Remove corrupted files from your server's S3 folder (Owner only)
- `/stats` - Show bot and server-specific storage statistics (Admin only)
- `/defaultvolume [level]` - Set default volume for new voice connections (Admin only)

### 🛠️ Utility Commands
- `/ping` - Check bot latency
- `/help [category]` - Interactive command help
- `/prefix [new_prefix]` - Set or view custom text command prefix (Admin only)
- `/settings` - View and manage server configuration (Admin only)

### 📝 Text Commands & Mentions
- `!play filename.mp3` - Alternative to slash commands
- `@RDP Soundboard filename.mp3` - Play via bot mention
- `!help`, `!ping`, `!volume 75` - Text equivalents

## 📁 Project Structure

```
src/
├── commands/
│   ├── audio/          # Music & playback commands
│   │   ├── play.ts     # Play audio files from cloud storage
│   │   ├── stop.ts     # Stop playback and leave voice channel
│   │   ├── volume.ts   # Real-time volume control
│   │   └── list.ts     # List server's audio collection
│   ├── admin/          # Administrative commands
│   │   ├── upload.ts   # Upload files to server's S3 folder
│   │   ├── delete.ts   # Delete files from server's storage
│   │   ├── rename.ts   # Rename files in server's collection
│   │   ├── cleanup.ts  # Clean up corrupted/invalid files
│   │   ├── stats.ts    # Server-specific storage statistics
│   │   └── defaultvolume.ts # Set default volume for server
│   └── utility/        # General utilities & configuration
│       ├── ping.ts     # Bot latency check
│       ├── help.ts     # Interactive command help system
│       ├── prefix.ts   # Configure text command prefix
│       └── settings.ts # Server configuration management
├── handlers/
│   └── commandHandler.ts  # Auto-discovery command loader
├── types/
│   └── Command.ts         # TypeScript interfaces & types
├── utils/
│   ├── permissions.ts     # Role-based permission system
│   ├── s3.ts              # S3 service with multi-tenant support
│   └── db.ts              # PostgreSQL database service
└── index.ts               # Main bot entry point & initialization
```

## 🔧 Configuration

### Multi-Tenant Cloud Storage (AWS S3)
- **Bucket Setup**: Create S3 bucket with public read access
- **Storage Location**: Global AWS infrastructure
- **Server Isolation**: Each Discord server gets isolated folder (`audio/{server_id}/`)
- **File Organization**: Server-specific file collections
- **Folder Structure**: Files stored as `{S3_FOLDER}/{server_id}/filename.mp3`
- **File Limits**: Virtually unlimited storage capacity per server
- **Supported Formats**: MP3 files only
- **Access**: Files accessible via direct S3 URLs
- **Performance**: CDN-like global distribution
- **Auto-Cleanup**: Bot automatically leaves voice channels after playback

### Database Configuration (PostgreSQL)
- **Database Provider**: Neon PostgreSQL (recommended)
- **Connection**: SSL-enforced connections with pooling
- **Schema**: Auto-initializes on first run
- **Multi-Tenant**: Server-specific data isolation
- **Future Features**: Ready for analytics, user stats, play tracking

### S3 Folder Organization
- **Multi-Tenant Path**: `{S3_FOLDER}/{server_id}/filename.mp3`
- **Server Isolation**: Complete separation between Discord servers
- **Folder Path**: Set via `S3_FOLDER` environment variable (default: "audio")
- **Benefits**: Better organization, server isolation, easier management
- **File References**: All commands automatically use server-specific folders
- **URL Format**: `https://your-bucket.s3.region.amazonaws.com/audio/server_guildid/filename.mp3`
- **Flexible**: Can be changed to any base folder name
- **Path Display**: All commands display the current server's folder path

### Permissions
- **Members**: Can use audio playback commands for their server
- **Administrators**: Can upload/delete files and view stats for their server
- **Owner**: Can perform cleanup operations for their server

## 🛠️ Development

### Available Scripts
The following npm scripts are available in `package.json`:

```bash
npm run build       # Compile TypeScript using tsc and tsc-alias
npm run test:s3     # Test S3 connection and configuration
npm run test:db     # Test database connection
npm run start       # Start the bot from compiled JavaScript
npm run dev         # Run the bot directly using ts-node (development mode)
npm run watch       # Watch for changes and recompile TypeScript
npm run clean       # Remove the dist directory
```

### Adding New Commands
1. Create command file in appropriate subfolder (`src/commands/category/`)
2. Export command object with `data` and `execute` properties
3. Use `context.guildId` for server-specific operations
4. The command handler will automatically discover and load it

### Environment Variables
- `DISCORD_TOKEN` - Your bot's token
- `CLIENT_ID` - Your Discord application's client ID
- `NEON_DB_URL` - PostgreSQL connection string
- `AWS_ACCESS_KEY_ID` - AWS access key for S3
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for S3
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `S3_BUCKET_NAME` - Your S3 bucket name
- `S3_BASE_URL` - Public S3 URL for your bucket
- `S3_FOLDER` - Base folder inside S3 bucket (default: "audio")

## 📋 Features in Detail

- **🏠 Multi-Tenant Architecture**: Complete server isolation with dedicated storage folders
- **🗄️ Database Integration**: PostgreSQL support for persistent data and future analytics
- **☁️ Cloud-First Architecture**: Files stored in AWS S3 for global accessibility
- **📁 Server-Specific Storage**: Each Discord server has isolated file collections
- **🔍 Auto-Discovery**: Commands are automatically loaded from subfolders
- **🛡️ Type Safety**: Full TypeScript support with proper error handling  
- **🎛️ Volume Control**: Real-time volume adjustment with server-specific defaults
- **📝 Autocomplete**: File name suggestions from server-specific cloud storage
- **⚙️ Server Configuration**: Custom prefixes, default settings, and server management
- **🔄 File Operations**: Upload, delete, rename, and organize files with cloud storage
- **🧹 Cloud Maintenance**: Built-in S3 file cleanup and health monitoring per server
- **📊 Advanced Statistics**: Comprehensive bot, storage, and server-specific analytics
- **🌍 Global Performance**: Stream audio from AWS edge locations
- **💾 Unlimited Storage**: No local disk space limitations per server
- **🔄 Auto-Scaling**: Handle any number of servers with automatic folder creation
- **💰 Cost Tracking**: Monitor and estimate AWS S3 costs across all servers

## 🔄 Migration from Single-Tenant

If you're upgrading from a previous version:

1. **Backward Compatibility**: Existing files remain accessible in root folder
2. **Automatic Migration**: New uploads automatically use server-specific folders
3. **Gradual Transition**: Files can be manually moved to server folders as needed
4. **Database Schema**: Automatically initializes on first database connection

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
- [Neon PostgreSQL](https://neon.tech/)

## 🐛 Issues & Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/rdp-datacenter/soundboard/issues) page
2. Create a new issue with detailed information
3. Include error logs and system information

---

<div align="center">
  <strong>Made with ❤️ for Discord Communities</strong><br>
  <sub>Keep your servers entertained with isolated, scalable sound collections!</sub>
</div>