import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

export interface AudioFile {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  url: string;
}

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private baseUrl: string;
  private baseFolderPrefix: string;

  constructor() {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    });

    this.bucketName = process.env.S3_BUCKET_NAME!;
    this.baseUrl = process.env.S3_BASE_URL!;
    
    // Set the base folder prefix (ensure it ends with /)
    this.baseFolderPrefix = process.env.S3_FOLDER || 'audio';
    if (!this.baseFolderPrefix.endsWith('/')) {
      this.baseFolderPrefix += '/';
    }

    // Validate required environment variables
    this.validateConfig();
  }

  private validateConfig(): void {
    const required = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY', 
      'AWS_REGION',
      'S3_BUCKET_NAME',
      'S3_BASE_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    console.log(`🗂️ [S3] Using base folder prefix: ${this.baseFolderPrefix}`);
  }

  /**
   * Get server-specific folder prefix
   * @param serverId Discord server (guild) ID
   * @returns Full folder path for the server
   */
  private getServerFolderPrefix(serverId: string): string {
    return `${this.baseFolderPrefix}${serverId}/`;
  }

  /**
   * Upload a file to S3 in server-specific folder
   */
  async uploadFile(
    fileName: string, 
    fileBuffer: Buffer, 
    contentType: string = 'audio/mpeg',
    serverId: string
  ): Promise<string> {
    try {
      const sanitizedName = this.sanitizeFileName(fileName);
      const folderPrefix = this.getServerFolderPrefix(serverId);
      const key = `${folderPrefix}${sanitizedName}`;
      
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
          CacheControl: 'max-age=31536000', // 1 year cache
          Metadata: {
            'uploaded-by': 'rdp-soundboard',
            'upload-date': new Date().toISOString(),
            'server-id': serverId,
          },
        },
      });

      await upload.done();
      
      console.log(`✅ [S3] Uploaded to server ${serverId}: ${key}`);
      return this.getPublicUrl(key);
      
    } catch (error) {
      console.error('❌ [S3] Upload failed:', error);
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Delete a file from S3 from server-specific folder
   */
  async deleteFile(fileName: string, serverId: string): Promise<void> {
    try {
      const sanitizedName = this.sanitizeFileName(fileName);
      const folderPrefix = this.getServerFolderPrefix(serverId);
      const key = `${folderPrefix}${sanitizedName}`;
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      console.log(`🗑️ [S3] Deleted from server ${serverId}: ${key}`);
      
    } catch (error) {
      console.error('❌ [S3] Delete failed:', error);
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * List all MP3 files for a specific server
   */
  async listFiles(serverId: string): Promise<AudioFile[]> {
    try {
      const folderPrefix = this.getServerFolderPrefix(serverId);
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: folderPrefix, // Use server-specific folder prefix
        MaxKeys: 1000, // Adjust as needed
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      // Filter for MP3 files and map to AudioFile interface
      const audioFiles: AudioFile[] = response.Contents
        .filter(object => object.Key?.endsWith('.mp3'))
        .map(object => ({
          key: object.Key!,
          // Extract just the filename without the folder prefix
          name: object.Key!.replace(folderPrefix, ''),
          size: object.Size || 0,
          lastModified: object.LastModified || new Date(),
          url: this.getPublicUrl(object.Key!),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return audioFiles;
      
    } catch (error) {
      console.error(`❌ [S3] List files failed for server ${serverId}:`, error);
      throw new Error(`Failed to list files: ${error}`);
    }
  }

  /**
   * Check if a file exists in S3 for a specific server
   */
  async fileExists(fileName: string, serverId: string): Promise<boolean> {
    try {
      const sanitizedName = this.sanitizeFileName(fileName);
      const folderPrefix = this.getServerFolderPrefix(serverId);
      const key = `${folderPrefix}${sanitizedName}`;
      
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
      
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get a readable stream for a file (for Discord voice)
   */
  async getFileStream(fileName: string, serverId: string): Promise<Readable> {
    try {
      const sanitizedName = this.sanitizeFileName(fileName);
      const folderPrefix = this.getServerFolderPrefix(serverId);
      const key = `${folderPrefix}${sanitizedName}`;
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No file body received');
      }

      return response.Body as Readable;
      
    } catch (error) {
      console.error(`❌ [S3] Get file stream failed for server ${serverId}:`, error);
      throw new Error(`Failed to get file stream: ${error}`);
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  /**
   * Get server-specific public URL for a file
   */
  getServerFileUrl(fileName: string, serverId: string): string {
    const sanitizedName = this.sanitizeFileName(fileName);
    const folderPrefix = this.getServerFolderPrefix(serverId);
    const key = `${folderPrefix}${sanitizedName}`;
    return this.getPublicUrl(key);
  }

  /**
   * Get file information for a specific server
   */
  async getFileInfo(fileName: string, serverId: string): Promise<{ size: number; lastModified: Date } | null> {
    try {
      const sanitizedName = this.sanitizeFileName(fileName);
      const folderPrefix = this.getServerFolderPrefix(serverId);
      const key = `${folderPrefix}${sanitizedName}`;
      
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
      };
      
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get bucket statistics for a specific server
   */
  async getBucketStats(serverId: string): Promise<{ fileCount: number; totalSize: number }> {
    try {
      const files = await this.listFiles(serverId);
      
      return {
        fileCount: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
      };
      
    } catch (error) {
      console.error(`❌ [S3] Get bucket stats failed for server ${serverId}:`, error);
      return { fileCount: 0, totalSize: 0 };
    }
  }

  /**
   * Clean up corrupted or empty files for a specific server
   */
  async cleanupFiles(serverId: string): Promise<string[]> {
    try {
      const files = await this.listFiles(serverId);
      const cleanedFiles: string[] = [];
      
      // Remove files smaller than 1KB (likely corrupted)
      for (const file of files) {
        if (file.size < 1024) {
          await this.deleteFile(file.name, serverId);
          cleanedFiles.push(file.name);
        }
      }
      
      return cleanedFiles;
      
    } catch (error) {
      console.error(`❌ [S3] Cleanup failed for server ${serverId}:`, error);
      throw new Error(`Failed to cleanup files: ${error}`);
    }
  }

  /**
   * Rename a file in S3 for a specific server (copy and delete operation)
   * Note: S3 doesn't have a native rename operation, so we implement it as copy + delete
   */
  async renameFile(
    currentFileName: string, 
    newFileName: string,
    serverId: string
  ): Promise<string> {
    try {
      // 1. Make sure files are sanitized
      const currentKey = this.sanitizeFileName(currentFileName);
      const newKey = this.sanitizeFileName(newFileName);
      
      // 2. Prepare the full S3 keys with folder prefix
      const folderPrefix = this.getServerFolderPrefix(serverId);
      const sourceKey = `${folderPrefix}${currentKey}`;
      const destinationKey = `${folderPrefix}${newKey}`;
      
      // 3. Set up the copy command (copying from same bucket)
      const copyParams = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
        ContentType: 'audio/mpeg',
        CacheControl: 'max-age=31536000', // 1 year cache
        MetadataDirective: 'COPY', // Copy the metadata from the source
      };
      
      // 4. Execute the copy operation
      const copyCommand = {
        Bucket: copyParams.Bucket,
        CopySource: copyParams.CopySource,
        Key: copyParams.Key,
        ContentType: copyParams.ContentType,
        CacheControl: copyParams.CacheControl,
        MetadataDirective: copyParams.MetadataDirective as 'COPY' | 'REPLACE',
      };
      
      await this.s3Client.send(new CopyObjectCommand(copyCommand));
      
      // 5. Delete the original file
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: sourceKey,
      });
      
      await this.s3Client.send(deleteCommand);
      
      console.log(`✅ [S3] Renamed for server ${serverId}: ${sourceKey} → ${destinationKey}`);
      return this.getPublicUrl(destinationKey);
      
    } catch (error) {
      console.error(`❌ [S3] Rename failed for server ${serverId}:`, error);
      throw new Error(`Failed to rename file: ${error}`);
    }
  }

  /**
   * Sanitize file name for S3 key
   */
  sanitizeFileName(fileName: string): string {
    // Remove any path separators and ensure .mp3 extension
    const sanitized = fileName.replace(/[\/\\]/g, '');
    return sanitized.endsWith('.mp3') ? sanitized : `${sanitized}.mp3`;
  }

  /**
   * Test S3 connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });

      await this.s3Client.send(command);
      console.log('✅ [S3] Connection test successful');
      return true;
      
    } catch (error) {
      console.error('❌ [S3] Connection test failed:', error);
      return false;
    }
  }

  /**
   * List all server IDs with files in the bucket
   */
  async listServers(): Promise<string[]> {
    try {
      // List all objects with the base prefix to find server folders
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.baseFolderPrefix,
        Delimiter: '/', // Use delimiter to get common prefixes (folders)
      });

      const response = await this.s3Client.send(command);
      
      // Extract server IDs from common prefixes
      const serverIds: string[] = [];
      
      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          if (prefix.Prefix) {
            // Extract server ID from the prefix
            // Format: audio/123456789/ -> 123456789
            const serverId = prefix.Prefix.replace(this.baseFolderPrefix, '').replace('/', '');
            if (serverId) {
              serverIds.push(serverId);
            }
          }
        }
      }
      
      return serverIds;
      
    } catch (error) {
      console.error('❌ [S3] List servers failed:', error);
      return [];
    }
  }

  /**
   * Get total statistics across all servers
   */
  async getTotalStats(): Promise<{ serverCount: number; fileCount: number; totalSize: number }> {
    try {
      const servers = await this.listServers();
      let totalFiles = 0;
      let totalSize = 0;
      
      for (const serverId of servers) {
        const stats = await this.getBucketStats(serverId);
        totalFiles += stats.fileCount;
        totalSize += stats.totalSize;
      }
      
      return {
        serverCount: servers.length,
        fileCount: totalFiles,
        totalSize: totalSize,
      };
      
    } catch (error) {
      console.error('❌ [S3] Get total stats failed:', error);
      return { serverCount: 0, fileCount: 0, totalSize: 0 };
    }
  }
}