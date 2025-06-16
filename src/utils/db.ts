import { Pool } from 'pg';
import 'dotenv/config';

export interface ServerSettings {
  guildId: string;
  prefix: string;
  defaultVolume: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DatabaseService {
  private pool: Pool;
  private DEFAULT_PREFIX = '!'; // Default prefix if not set

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.NEON_DB_URL,
      ssl: {
        rejectUnauthorized: false, // Required for Neon connections
      },
      max: 20, // Maximum connection pool size
      idleTimeoutMillis: 30000, // How long a client can stay idle before being closed
    });

    this.initialize().catch(err => {
      console.error('❌ Database initialization failed:', err);
    });
  }

  // Initialize database tables
  async initialize(): Promise<void> {
    try {
      // Create server settings table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS server_settings (
          guild_id TEXT PRIMARY KEY,
          prefix TEXT NOT NULL DEFAULT '${this.DEFAULT_PREFIX}',
          default_volume NUMERIC(5,2) NOT NULL DEFAULT 0.5,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create audio stats table for future analytics
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS audio_stats (
          id SERIAL PRIMARY KEY,
          guild_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database:', error);
      throw error;
    }
  }

  // Test database connection (required by test-db.ts)
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  // Execute raw SQL query (required by test-db.ts)
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  // Get connection pool info (required by test-db.ts)
  getPoolInfo() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  // Alias for initialize method (required by test-db.ts)
  async initializeSchema(): Promise<void> {
    return this.initialize();
  }

  // Update server settings method (required by test-db.ts)
  async updateServerSettings(guildId: string, settings: { default_volume?: number; custom_prefix?: string }): Promise<boolean> {
    try {
      const { default_volume, custom_prefix } = settings;
      
      // Build dynamic query based on what settings are provided
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (default_volume !== undefined) {
        const safeVolume = Math.max(0, Math.min(1, default_volume / 100)); // Convert percentage to decimal
        updates.push(`default_volume = $${paramCount++}`);
        values.push(safeVolume);
      }

      if (custom_prefix !== undefined) {
        updates.push(`prefix = $${paramCount++}`);
        values.push(custom_prefix);
      }

      if (updates.length === 0) {
        return false; // No updates to make
      }

      updates.push(`updated_at = NOW()`);
      values.push(guildId);

      const query = `
        INSERT INTO server_settings (guild_id, ${default_volume !== undefined ? 'default_volume, ' : ''}${custom_prefix !== undefined ? 'prefix, ' : ''}updated_at)
        VALUES ($${values.length}, ${default_volume !== undefined ? '$1, ' : ''}${custom_prefix !== undefined ? `$${custom_prefix !== undefined && default_volume !== undefined ? '2' : '1'}, ` : ''}NOW())
        ON CONFLICT (guild_id) 
        DO UPDATE SET ${updates.join(', ')}
      `;

      await this.query(query, values);
      return true;
    } catch (error) {
      console.error('Error updating server settings:', error);
      return false;
    }
  }

  // Log audio play statistics (required by test-db.ts)
  async logAudioPlay(guildId: string, fileName: string, userId: string): Promise<void> {
    try {
      await this.query(`
        INSERT INTO audio_stats (guild_id, file_name, user_id)
        VALUES ($1, $2, $3)
      `, [guildId, fileName, userId]);
    } catch (error) {
      console.error('Error logging audio play:', error);
      // Don't throw error as this is not critical
    }
  }

  // Get server statistics (required by test-db.ts)
  async getServerStats(guildId: string): Promise<any> {
    try {
      const result = await this.query(`
        SELECT 
          file_name,
          COUNT(*) as play_count,
          COUNT(DISTINCT user_id) as unique_users,
          MAX(played_at) as last_played
        FROM audio_stats 
        WHERE guild_id = $1 
        GROUP BY file_name 
        ORDER BY play_count DESC 
        LIMIT 10
      `, [guildId]);

      const totalPlays = await this.query(`
        SELECT COUNT(*) as total_plays 
        FROM audio_stats 
        WHERE guild_id = $1
      `, [guildId]);

      return {
        topFiles: result.rows,
        totalPlays: totalPlays.rows[0]?.total_plays || 0
      };
    } catch (error) {
      console.error('Error getting server stats:', error);
      return { topFiles: [], totalPlays: 0 };
    }
  }

  // Get server settings, create default if doesn't exist
  async getServerSettings(guildId: string): Promise<ServerSettings> {
    try {
      // First, try to get existing settings
      const result = await this.pool.query(
        'SELECT * FROM server_settings WHERE guild_id = $1',
        [guildId]
      );

      // If server settings exist, return them
      if (result.rows.length > 0) {
        return this.mapToServerSettings(result.rows[0]);
      }

      // If settings don't exist, create default settings
      const defaultSettings = await this.createDefaultServerSettings(guildId);
      return defaultSettings;
    } catch (error) {
      console.error(`❌ Error getting server settings for ${guildId}:`, error);
      
      // Return default settings object if database query fails
      return {
        guildId,
        prefix: this.DEFAULT_PREFIX,
        defaultVolume: 0.5,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  // Create default settings for a new server
  private async createDefaultServerSettings(guildId: string): Promise<ServerSettings> {
    try {
      const result = await this.pool.query(
        `INSERT INTO server_settings (guild_id, prefix, default_volume) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [guildId, this.DEFAULT_PREFIX, 0.5]
      );

      console.log(`✅ Created default settings for server ${guildId}`);
      return this.mapToServerSettings(result.rows[0]);
    } catch (error) {
      console.error(`❌ Error creating default settings for ${guildId}:`, error);
      throw error;
    }
  }

  // Update server prefix
  async updateServerPrefix(guildId: string, newPrefix: string): Promise<ServerSettings> {
    try {
      const result = await this.pool.query(
        `UPDATE server_settings 
         SET prefix = $1, updated_at = NOW() 
         WHERE guild_id = $2 
         RETURNING *`,
        [newPrefix, guildId]
      );

      // If no rows were updated, the server doesn't exist yet
      if (result.rows.length === 0) {
        // Create server with the new prefix
        const insertResult = await this.pool.query(
          `INSERT INTO server_settings (guild_id, prefix) 
           VALUES ($1, $2) 
           RETURNING *`,
          [guildId, newPrefix]
        );
        return this.mapToServerSettings(insertResult.rows[0]);
      }

      return this.mapToServerSettings(result.rows[0]);
    } catch (error) {
      console.error(`❌ Error updating prefix for ${guildId}:`, error);
      throw error;
    }
  }

  // Update server default volume
  async updateServerVolume(guildId: string, volume: number): Promise<ServerSettings> {
    try {
      // Ensure volume is between 0 and 1
      const safeVolume = Math.max(0, Math.min(1, volume));
      
      const result = await this.pool.query(
        `UPDATE server_settings 
         SET default_volume = $1, updated_at = NOW() 
         WHERE guild_id = $2 
         RETURNING *`,
        [safeVolume, guildId]
      );

      // If no rows were updated, the server doesn't exist yet
      if (result.rows.length === 0) {
        // Create server with the new volume setting
        const insertResult = await this.pool.query(
          `INSERT INTO server_settings (guild_id, default_volume) 
           VALUES ($1, $2) 
           RETURNING *`,
          [guildId, safeVolume]
        );
        return this.mapToServerSettings(insertResult.rows[0]);
      }

      return this.mapToServerSettings(result.rows[0]);
    } catch (error) {
      console.error(`❌ Error updating volume for ${guildId}:`, error);
      throw error;
    }
  }

  // Get all servers with custom settings
  async getAllServerSettings(): Promise<ServerSettings[]> {
    try {
      const result = await this.pool.query('SELECT * FROM server_settings');
      return result.rows.map(row => this.mapToServerSettings(row));
    } catch (error) {
      console.error('❌ Error getting all server settings:', error);
      return [];
    }
  }

  // Map database row to ServerSettings object
  private mapToServerSettings(row: any): ServerSettings {
    return {
      guildId: row.guild_id,
      prefix: row.prefix,
      defaultVolume: parseFloat(row.default_volume),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Close the database connection pool
  async close(): Promise<void> {
    await this.pool.end();
    console.log('✅ Database connection closed');
  }
}