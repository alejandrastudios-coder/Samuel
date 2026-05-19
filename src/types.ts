export type UserStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'user' | 'admin';

export interface UserGroup {
  id: string;
  name: string;
  color: string;
  createdAt: any;
}

export interface UserProfile {
  userId: string;
  username: string; // Added for manual login
  password?: string; // Added for manual login/admin view
  email: string;
  displayName: string;
  photoURL?: string;
  rarity?: string;
  residingCountry?: string; // Non-album country
  groupIds?: string[]; // Sectors/Groups assigned
  status: UserStatus;
  role: UserRole;
  createdAt: any;
  completedAt?: any; // New field for Hall of Fame
  online?: boolean; // Live presence state
}

export type StickerStatus = number; // 0: missing, 1: owned, 2+: count of stickers

export interface AlbumProgress {
  userId: string;
  stickers: Record<string, StickerStatus>;
  updatedAt: any;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  updatedAt: any;
  hiddenBy?: string[];
  unreadCounts?: Record<string, number>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  tradeData?: {
    gave: string[]; // Stickers given by sender
    received: string[]; // Stickers received by sender
    appliedBy?: string[]; // List of userIds who already synced this specific trade
  };
}
