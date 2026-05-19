
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { TEAMS, STICKERS_PER_TEAM, FWC_COUNT, COCA_COLA_COUNT, normalizeStickerId } from '../constants';
import { UserProfile, AlbumProgress } from '../types';

export const TOTAL_POSSIBLE_STICKERS = (TEAMS.length * STICKERS_PER_TEAM) + FWC_COUNT + COCA_COLA_COUNT;

export const calculateOwnedCount = (stickers: Record<string, number>) => {
  const normalized: Record<string, number> = {};
  Object.entries(stickers).forEach(([id, s]) => {
    if (s <= 0) return;
    const norm = normalizeStickerId(id);
    normalized[norm] = (normalized[norm] || 0) + s;
  });
  return Object.keys(normalized).length;
};

export const checkCompletionAndNotify = async (userId: string, stickers: Record<string, number>) => {
  const ownedCount = calculateOwnedCount(stickers);
  
  if (ownedCount === TOTAL_POSSIBLE_STICKERS) {
    // Check if user already has completedAt
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      if (!data.completedAt) {
        // Record exact date of completion
        await updateDoc(userRef, {
          completedAt: serverTimestamp()
        });
      }
    }
  }
};
