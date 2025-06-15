import { 
  ChatInputCommandInteraction, 
  GuildMember, 
  PermissionFlagsBits, 
  PermissionsBitField,
  MessageFlags
} from 'discord.js';

export class PermissionChecker {
  /**
   * Check if user has administrator permissions
   */
  static isAdmin(member: GuildMember): boolean {
    return member.permissions.has(PermissionFlagsBits.Administrator);
  }

  /**
   * Check if user has manage server permissions
   */
  static canManageServer(member: GuildMember): boolean {
    return member.permissions.has(PermissionFlagsBits.ManageGuild);
  }

  /**
   * Check if user has manage roles permissions
   */
  static canManageRoles(member: GuildMember): boolean {
    return member.permissions.has(PermissionFlagsBits.ManageRoles);
  }

  /**
   * Check if user has voice channel permissions
   */
  static hasVoicePermissions(member: GuildMember): boolean {
    return member.permissions.has([
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak
    ]);
  }

  /**
   * Check if user is server owner
   */
  static isOwner(member: GuildMember): boolean {
    return member.guild.ownerId === member.id;
  }

  /**
   * Check if user has any elevated permissions (Admin, Manage Server, or Owner)
   */
  static isElevated(member: GuildMember): boolean {
    return this.isOwner(member) || 
           this.isAdmin(member) || 
           this.canManageServer(member);
  }

  /**
   * Check multiple permissions at once
   */
  static hasPermissions(member: GuildMember, permissions: bigint[]): boolean {
    return member.permissions.has(permissions);
  }

  /**
   * Get user permission level as string
   */
  static getPermissionLevel(member: GuildMember): string {
    if (this.isOwner(member)) return 'Owner';
    if (this.isAdmin(member)) return 'Administrator';
    if (this.canManageServer(member)) return 'Manager';
    if (this.hasVoicePermissions(member)) return 'Member';
    return 'Limited';
  }

  /**
   * Send permission denied message
   */
  static async sendPermissionDenied(
    interaction: ChatInputCommandInteraction, 
    requiredPermission: string = 'Administrator'
  ): Promise<void> {
    await interaction.reply({
      content: `❌ **Access Denied!** This command requires **${requiredPermission}** permissions.\n` +
               `Your current permission level: **${this.getPermissionLevel(interaction.member as GuildMember)}**`,
      flags: MessageFlags.Ephemeral
    });
  }
}

// Permission decorators for easy use
export const RequireAdmin = () => {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    descriptor.value = async function(...args: any[]) {
      const interaction = args[0] as ChatInputCommandInteraction;
      const member = interaction.member as GuildMember;
      
      if (!PermissionChecker.isAdmin(member)) {
        await PermissionChecker.sendPermissionDenied(interaction, 'Administrator');
        return;
      }
      
      return method.apply(this, args);
    };
  };
};

export const RequireElevated = () => {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    descriptor.value = async function(...args: any[]) {
      const interaction = args[0] as ChatInputCommandInteraction;
      const member = interaction.member as GuildMember;
      
      if (!PermissionChecker.isElevated(member)) {
        await PermissionChecker.sendPermissionDenied(interaction, 'Administrator or Manager');
        return;
      }
      
      return method.apply(this, args);
    };
  };
};