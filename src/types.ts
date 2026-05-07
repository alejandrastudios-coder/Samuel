export type UserStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'user' | 'admin';

export interface UserProfile {
  userId: string;
  username: string; // Added for manual login
  password?: string; // Added for manual login/admin view
  email: string;
  displayName: string;
  photoURL?: string;
  status: UserStatus;
  role: UserRole;
  createdAt: any;
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
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}
