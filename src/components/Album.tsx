import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, getDocs, setDoc, where, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AlbumProgress, StickerStatus } from '../types';
import { TEAMS, STICKERS_PER_TEAM, FWC_COUNT, COCA_COLA_COUNT, FLAGS, normalizeStickerId } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Trophy, Star, Repeat, ChevronRight, Check, ArrowLeft, LogOut, User as UserIcon, X, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

interface StickerGroup {
  id: string;
  name: string;
  count: number;
  type: 'team' | 'special';
  flag?: string;
}

export default function Album({ userProfile }: { userProfile: UserProfile | null }) {
  const [progress, setProgress] = useState<AlbumProgress | null>(null);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<{ id: string; num: number; group: StickerGroup } | null>(null);
  const [matchingUsers, setMatchingUsers] = useState<{ user: UserProfile, stickerId: string }[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const navigate = useNavigate();

  const findWhoHasIt = async (stickerId: string) => {
    setLoadingMatches(true);
    setIsMatchModalOpen(true);
    try {
      const targetNormId = normalizeStickerId(stickerId);

      const querySnap = await getDocs(collection(db, 'album_progress'));
      const usersSnap = await getDocs(collection(db, 'users'));
      
      const usersMap: Record<string, UserProfile> = {};
      usersSnap.docs.forEach(d => usersMap[d.id] = d.data() as UserProfile);

      const matches = querySnap.docs
        .map(d => ({
          userId: d.id,
          ...d.data()
        } as AlbumProgress))
        .filter(p => p.userId !== userProfile?.userId)
        .filter(p => {
          // Check if user has targetNormId repeated
          const counts: Record<string, number> = {};
          Object.entries(p.stickers).forEach(([id, s]) => {
            const norm = normalizeStickerId(id);
            counts[norm] = (counts[norm] || 0) + s;
          });
          return (counts[targetNormId] || 0) > 1;
        })
        .map(p => ({ user: usersMap[p.userId], stickerId: targetNormId }))
        .filter(m => m.user && m.user.status === 'approved');

      setMatchingUsers(matches);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      return onSnapshot(
        doc(db, 'album_progress', userProfile.userId), 
        (doc) => {
          if (doc.exists()) {
            setProgress(doc.data() as AlbumProgress);
          }
        },
        (error) => console.error("Error fetching progress:", error)
      );
    }
  }, [userProfile]);

  const [filter, setFilter] = useState<'all' | 'complete' | 'empty' | 'incomplete'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const groups: StickerGroup[] = useMemo(() => {
    const list: StickerGroup[] = TEAMS.map(team => ({
      id: team,
      name: team,
      count: STICKERS_PER_TEAM,
      type: 'team',
      flag: FLAGS[team] || 'https://flagcdn.com/un.svg'
    }));

    list.push({ id: 'UFW', name: 'FWC', count: FWC_COUNT, type: 'special' });
    list.push({ id: 'COCA-COLA', name: 'Coca Cola', count: COCA_COLA_COUNT, type: 'special' });
    
    return list;
  }, []);

  const normalizedMyStickers = useMemo(() => {
    const counts: Record<string, number> = {};
    if (progress?.stickers) {
      Object.entries(progress.stickers).forEach(([id, s]) => {
        const norm = normalizeStickerId(id);
        counts[norm] = (counts[norm] || 0) + s;
      });
    }
    return counts;
  }, [progress?.stickers]);

  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      // Search filter
      const matchesSearch = group.name.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (filter === 'all') return true;

      const ownedCount = Array.from({ length: group.count }).filter((_, i) => {
        const id = `${group.id}-${i + 1}`;
        return (normalizedMyStickers[id] || 0) >= 1;
      }).length;

      if (filter === 'complete') return ownedCount === group.count;
      if (filter === 'empty') return ownedCount === 0;
      if (filter === 'incomplete') return ownedCount < group.count;

      return true;
    });
  }, [groups, search, filter, normalizedMyStickers]);

  const toggleSticker = async (stickerId: string, decrement: boolean = false) => {
    if (!userProfile || !progress) return;
    
    const targetNormId = normalizeStickerId(stickerId);
    
    // Find all keys that normalize to this targetId
    const entries = Object.entries(progress.stickers);
    let totalCount = 0;
    const existingKeys: string[] = [];
    
    entries.forEach(([id, s]) => {
      if (normalizeStickerId(id) === targetNormId) {
        totalCount += s;
        if (s > 0) existingKeys.push(id);
      }
    });

    let nextCount = decrement ? Math.max(0, totalCount - 1) : totalCount + 1;
    
    try {
      // If decrementing, we ideally want to decrement from an existing key
      // If multiple keys exist, we'll standardize to the one used by the grid (stickerId)
      const updates: Record<string, any> = {
        updatedAt: serverTimestamp()
      };

      if (decrement) {
        if (totalCount <= 0) return;
        
        // Remove 1 from the first key that has a count
        if (existingKeys.length > 0) {
          const keyToUpdate = existingKeys[0];
          updates[`stickers.${keyToUpdate}`] = progress.stickers[keyToUpdate] - 1;
        }
      } else {
        // Increment - if targetNormId exists in any form, increment that one, or use stickerId
        const keyToUpdate = existingKeys.length > 0 ? existingKeys[0] : stickerId;
        updates[`stickers.${keyToUpdate}`] = (progress.stickers[keyToUpdate] || 0) + 1;
      }

      await updateDoc(doc(db, 'album_progress', userProfile.userId), updates);
    } catch (error) {
      console.error("Error updating sticker:", error);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-20 py-4 -mt-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Mi Colección</h2>
            <p className="text-sm text-zinc-500">Toca para añadir. Click derecho o botones para reducir.</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Buscar selección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 border border-zinc-800 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'complete', label: 'Completos' },
              { id: 'empty', label: 'Vacíos' },
              { id: 'incomplete', label: 'Incompletos' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                  filter === f.id 
                    ? "bg-white text-black shadow-lg" 
                    : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.map((group, idx) => {
          const ownedInGroup = Array.from({ length: group.count }).filter((_, i) => {
            const id = `${group.id}-${i + 1}`;
            return (normalizedMyStickers[id] || 0) >= 1;
          }).length;

          const hasRepeated = Array.from({ length: group.count }).some((_, i) => {
            const id = `${group.id}-${i + 1}`;
            return (normalizedMyStickers[id] || 0) > 1;
          });
          
          const isCompleted = ownedInGroup === group.count;

          const isExpanded = expandedGroups[group.id] || search.length > 0;

          return (
            <motion.div 
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={cn(
                "bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden group transition-all duration-300",
                isCompleted ? "border-green-500/30 bg-green-950/5" : "hover:border-zinc-700",
                isExpanded && "ring-1 ring-zinc-700 shadow-xl"
              )}
            >
              <button 
                onClick={() => toggleGroup(group.id)}
                className="w-full p-5 flex items-center justify-between border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {group.type === 'team' ? (
                      <img src={group.flag} alt={group.name} className="w-8 h-6 object-cover rounded-sm shadow-sm" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center">
                         {group.id === 'FWC' || group.id === 'UFW' ? <Trophy className="w-4 h-4 text-green-500" /> : <Star className="w-4 h-4 text-green-500" />}
                      </div>
                    )}
                    {hasRepeated && (
                      <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-zinc-900 flex items-center justify-center shadow-lg">
                        <Repeat className="w-2 h-2 text-black" strokeWidth={4} />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-bold">{group.name}</h4>
                      {hasRepeated && (
                        <span className="text-[8px] font-black bg-amber-500/10 text-amber-500 px-1 rounded ring-1 ring-amber-500/20 uppercase tracking-tighter">
                          +Rep
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-tighter font-bold">
                        {ownedInGroup}/{group.count} ESTAMPAS
                      </p>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-tighter px-1 rounded",
                        ownedInGroup === 0 ? "bg-zinc-800 text-zinc-500" :
                        ownedInGroup === group.count ? "bg-green-500/10 text-green-500" :
                        "bg-blue-500/10 text-blue-500"
                      )}>
                        {ownedInGroup === 0 ? 'Vacío' :
                         ownedInGroup === group.count ? 'Completo' :
                         'Incompleto'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isCompleted && (
                    <div className="bg-green-600/20 text-green-500 p-1.5 rounded-full">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  <div className={cn(
                    "p-1.5 rounded-xl bg-zinc-800 text-zinc-500 transition-transform duration-300",
                    isExpanded && "rotate-180 bg-zinc-700 text-white"
                  )}>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="p-4 grid grid-cols-5 gap-2 border-t border-zinc-800/30">
                      {Array.from({ length: group.count }).map((_, i) => {
                        const id = `${group.id}-${i + 1}`;
                        const count = normalizedMyStickers[id] || 0;
                        
                        return (
                          <div key={id} className="relative group/sticker">
                            <button
                              onClick={() => setSelectedSticker({ id, num: i + 1, group })}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                if (count > 0) toggleSticker(id, true);
                              }}
                              className={cn(
                                "w-full aspect-square rounded-xl text-[10px] font-black flex items-center justify-center transition-all relative border-2 active:scale-90",
                                count === 0 && "bg-zinc-900 border-zinc-800 text-zinc-700 hover:border-zinc-700",
                                count === 1 && "bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(22,163,74,0.3)]",
                                count >= 2 && "bg-amber-500 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                              )}
                            >
                              {i + 1}
                              {count >= 2 && (
                                <div className="absolute -top-2 -right-2 bg-amber-500 text-black rounded-full px-1.5 py-0.5 border-2 border-zinc-900 font-black flex items-center justify-center min-w-[20px] shadow-xl animate-in zoom-in-50">
                                   <span className="text-[10px]">+{count - 1}</span>
                                </div>
                              )}
                            </button>
                            {count === 0 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); findWhoHasIt(id); }}
                                className="absolute -top-1 -right-1 bg-zinc-800 text-zinc-400 rounded-full p-1 border border-zinc-700 opacity-0 group-hover/sticker:opacity-100 transition-opacity hover:text-green-500"
                                title="¿Quién la tiene?"
                              >
                                <Search className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedSticker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSticker(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 p-8 pt-4 bg-zinc-950 border-t border-zinc-800 rounded-t-[3rem] z-[101] shadow-2xl safe-area-bottom"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 opacity-50" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className={cn(
                  "w-20 h-20 rounded-[2rem] flex items-center justify-center text-3xl font-black italic shadow-2xl border-4",
                  (normalizedMyStickers[selectedSticker.id] || 0) === 0 ? "bg-zinc-900 border-zinc-800 text-zinc-700" :
                  (normalizedMyStickers[selectedSticker.id] || 0) === 1 ? "bg-green-600 border-green-500 text-white" :
                  "bg-amber-500 border-amber-400 text-white"
                )}>
                  {selectedSticker.num}
                </div>
                <div>
                  <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                    {selectedSticker.group.name} #{selectedSticker.num}
                  </h4>
                  <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest mt-1">
                    Tienes {(normalizedMyStickers[selectedSticker.id] || 0)} {(normalizedMyStickers[selectedSticker.id] || 0) === 1 ? 'copia' : 'copias'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSticker(selectedSticker.id, true); }}
                  disabled={(normalizedMyStickers[selectedSticker.id] || 0) === 0}
                  className="flex items-center justify-center gap-3 py-6 bg-zinc-900 border border-zinc-800 rounded-[2rem] text-white font-black text-lg transition-all active:scale-95 disabled:opacity-20 disabled:active:scale-100"
                >
                  <span className="text-3xl">-</span>
                  RESTAR
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSticker(selectedSticker.id); }}
                  className="flex items-center justify-center gap-3 py-6 bg-white text-black rounded-[2rem] font-black text-lg transition-all active:scale-95"
                >
                  <span className="text-3xl">+</span>
                  SUMAR
                </button>
              </div>

              <button
                onClick={() => setSelectedSticker(null)}
                className="w-full mt-6 py-2 text-zinc-500 font-black uppercase text-[10px] tracking-[0.2em]"
              >
                Cerrar Panel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMatchModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMatchModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/20">
                <div>
                  <h3 className="text-xl font-bold text-white">¿Quién la tiene repetida?</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {(() => {
                      const id = matchingUsers[0]?.stickerId;
                      if (!id) return '...';
                      const [teamName, num] = id.split('-');
                      return `Estampa ${teamName} ${num}`;
                    })()}
                  </p>
                </div>
                <button onClick={() => setIsMatchModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {loadingMatches ? (
                  <div className="py-12 flex flex-col items-center gap-4 text-zinc-500">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest">Buscando Coleccionistas...</p>
                  </div>
                ) : matchingUsers.length > 0 ? (
                  <div className="space-y-4">
                    {matchingUsers.map((match, idx) => (
                      <motion.div 
                        key={match.user.userId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-zinc-800/50 border border-zinc-700/50 p-4 rounded-2xl flex items-center justify-between group hover:border-green-500/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-700 overflow-hidden">
                            {match.user.photoURL ? (
                              <img src={match.user.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-full h-full p-2 text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{match.user.displayName}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">@{match.user.username}</p>
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                          if (!userProfile) return;
                          const peerUserId = match.user.userId;
                          const participants = [userProfile.userId, peerUserId].sort();
                          const chatId = participants.join('_');
                          
                          try {
                            const chatRef = doc(db, 'chats', chatId);
                            const chatSnap = await getDoc(chatRef);
                            
                            if (!chatSnap.exists()) {
                              const [teamId, num] = match.stickerId.split('-');
                              const label = teamId === 'UFW' ? 'FWC' : teamId;
                              const initialMessage = `¡Hola! Vi que tienes la estampa de ${label} ${num} repetida y me interesa.`;
                              await setDoc(chatRef, {
                                participants,
                                lastMessage: initialMessage,
                                updatedAt: serverTimestamp(),
                                hiddenBy: [],
                                unreadCounts: {
                                  [peerUserId]: 1,
                                  [userProfile.userId]: 0
                                }
                              });
                              
                              await addDoc(collection(db, 'chats', chatId, 'messages'), {
                                senderId: userProfile.userId,
                                text: initialMessage,
                                createdAt: serverTimestamp()
                              });
                            } else {
                              const data = chatSnap.data() as any;
                              const hiddenBy = data.hiddenBy || [];
                              if (hiddenBy.includes(userProfile.userId)) {
                                await updateDoc(chatRef, {
                                  hiddenBy: hiddenBy.filter((id: string) => id !== userProfile.userId)
                                });
                              }
                            }
                            
                            navigate(`/chat/${chatId}`);
                          } catch (error) {
                            console.error("Error starting chat from album:", error);
                            alert("Error al iniciar el chat.");
                          }
                        }}
                          className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-500 transition-all shadow-lg shadow-green-600/20 active:scale-95"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-500">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Repeat className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm font-medium">Nadie tiene esta estampa repetida aún.</p>
                    <p className="text-[10px] uppercase mt-1 tracking-widest">Sigue intentando más tarde</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-zinc-950/50 border-t border-zinc-800">
                <button 
                  onClick={() => setIsMatchModalOpen(false)}
                  className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-bold text-sm tracking-widest uppercase hover:bg-zinc-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
