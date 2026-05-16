import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AlbumProgress, UserGroup } from '../types';
import { TEAMS, STICKERS_PER_TEAM, FWC_COUNT, COCA_COLA_COUNT, normalizeStickerId, RARITIES, ALL_COUNTRIES, FLAGS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Star, BarChart3, TrendingUp, Clock, Repeat, CheckCircle2, MessageCircle, LogOut, ShieldCheck, ArrowRightLeft, Download, ChevronRight, RefreshCcw, Smartphone, Share as ShareIcon, Plus, X, Settings2, MapPin, Tag } from 'lucide-react';
import { cn } from '../lib/utils';
import { WorldCupBall } from './ui/WorldCupBall';
import { RepeatedList } from './RepeatedList';
import { useLanguage } from '../contexts/LanguageContext';

export default function Dashboard({ userProfile }: { userProfile: UserProfile | null }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [progress, setProgress] = useState<AlbumProgress | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showiOSInstall, setShowiOSInstall] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRepeatedListOpen, setIsRepeatedListOpen] = useState(false);
  const [isIOSModalOpen, setIsIOSModalOpen] = useState(false);
  const [isRarityModalOpen, setIsRarityModalOpen] = useState(false);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [groups, setGroups] = useState<UserGroup[]>([]);

  const currentRarity = userProfile?.rarity || 'cualquier';
  const rarityData = RARITIES.find(r => r.id === currentRarity) || RARITIES[0];

  const updateRarity = async (rarityId: string) => {
    if (!userProfile) return;
    try {
      await updateDoc(doc(db, 'users', userProfile.userId), { rarity: rarityId });
      setIsRarityModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const updateCountry = async (countryName: string) => {
    if (!userProfile) return;
    try {
      await updateDoc(doc(db, 'users', userProfile.userId), { residingCountry: countryName });
      setIsCountryModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'groups'), (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserGroup)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userProfile) return;

    // Listen to real-time unread counts from chats
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userProfile.userId)
    );

    const unsub = onSnapshot(q, (snap) => {
      let total = 0;
      snap.docs.forEach(doc => {
        const data = doc.data();
        const counts = data.unreadCounts || {};
        total += (counts[userProfile.userId] || 0);
      });
      setUnreadCount(total);
    });

    return () => unsub();
  }, [userProfile]);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const standalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(!!standalone);
    
    if (isIOS && !standalone) {
      setShowiOSInstall(true);
    }
    
    // Listen for the custom event from main.tsx
    const handler = () => setIsStandalone(false);
    window.addEventListener('trigger-install-prompt', handler);
    return () => window.removeEventListener('trigger-install-prompt', handler);
  }, []);

  const triggerInstall = () => {
    window.dispatchEvent(new CustomEvent('trigger-install-prompt'));
  };

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [allProgress, setAllProgress] = useState<AlbumProgress[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (userProfile) {
      return onSnapshot(doc(db, 'album_progress', userProfile.userId), (doc) => {
         if (doc.exists()) {
           setProgress(doc.data() as AlbumProgress);
           setLastUpdate(new Date());
         }
      });
    }
  }, [userProfile]);

  const totalPossible = (TEAMS.length * STICKERS_PER_TEAM) + FWC_COUNT + COCA_COLA_COUNT;
  const stickers = progress?.stickers || {};
  
  // Aggregate stats using normalization
  const normalizedMyStickers = React.useMemo(() => {
    const counts: Record<string, number> = {};
    Object.entries(stickers).forEach(([id, s]) => {
      const norm = normalizeStickerId(id);
      counts[norm] = (counts[norm] || 0) + s;
    });
    return counts;
  }, [stickers]);

  const ownedCount = Object.values(normalizedMyStickers).filter(s => s >= 1).length;
  
  const repeatedCount = useMemo(() => {
    let count = 0;
    Object.values(normalizedMyStickers).forEach(s => {
      if (s > 1) count += (s - 1);
    });
    return count;
  }, [normalizedMyStickers]);

  const leaderboard = useMemo(() => {
    // Combine all available users with their corresponding progress
    const allStats = Object.keys(allUsers).map(uId => {
      const user = allUsers[uId];
      // Prefer local progress state for current user for immediate feedback
      const userProgress = uId === userProfile?.userId ? progress : allProgress.find(p => p.userId === uId);
      
      return {
        userId: uId,
        user,
        progress: userProgress
      };
    }).filter(item => item.user && item.user.status === 'approved');

    const calculated = allStats.map(item => {
      const s = item.progress?.stickers || {};
      const uniqueFWC = new Set<string>();
      const uniqueCC = new Set<string>();
      const uniqueStandard = new Set<string>();

      Object.entries(s).forEach(([id, qty]) => {
        if (qty <= 0) return;
        const norm = normalizeStickerId(id);
        
        if (norm.startsWith('UFW') || norm.startsWith('FWC')) {
          uniqueFWC.add(norm);
        } else if (norm.startsWith('COCA-COLA') || norm.startsWith('CC')) {
          uniqueCC.add(norm);
        } else {
          uniqueStandard.add(norm);
        }
      });

      const owned = uniqueFWC.size + uniqueCC.size + uniqueStandard.size;
      const rate = Math.round((owned / totalPossible) * 100);
      
      return {
        userId: item.userId,
        user: item.user,
        rate,
        owned,
        fwcOwned: uniqueFWC.size,
        ccOwned: uniqueCC.size,
        updatedAt: item.progress?.updatedAt?.toDate?.() || new Date(0)
      };
    });

    // Sort by rate (desc) then by updatedAt (asc) - tie breaker: who reached it first
    return calculated.sort((a, b) => {
      if (b.rate !== a.rate) return b.rate - a.rate;
      return a.updatedAt.getTime() - b.updatedAt.getTime();
    }).slice(0, 10);
  }, [allProgress, allUsers, userProfile, progress, totalPossible]);

  const missingCount = totalPossible - ownedCount;
  const missingRate = Math.round((missingCount / totalPossible) * 100);
  const completionRate = Math.round((ownedCount / totalPossible) * 100);

  const teamStats = useMemo(() => {
    let emptyTeams = 0;
    let incompleteTeams = 0;
    let fullTeams = 0;
    
    TEAMS.forEach((team) => {
      let teamOwned = 0;
      for (let i = 1; i <= STICKERS_PER_TEAM; i++) {
        const id = `${team}-${i}`;
        if ((normalizedMyStickers[id] || 0) >= 1) {
          teamOwned++;
        }
      }
      
      if (teamOwned === 0) {
        emptyTeams++;
      } else if (teamOwned < STICKERS_PER_TEAM) {
        incompleteTeams++;
      } else {
        fullTeams++;
      }
    });

    return { emptyTeams, incompleteTeams, fullTeams };
  }, [normalizedMyStickers]);

  useEffect(() => {
    if (!userProfile) return;

    let unsubAll: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;

    // Only fetch others' progress if approved or admin
    if (userProfile.status === 'approved' || userProfile.role === 'admin') {
      unsubAll = onSnapshot(
        collection(db, 'album_progress'), 
        (snap) => {
          const data = snap.docs.map(d => ({
            userId: d.id,
            ...d.data()
          } as AlbumProgress));
          setAllProgress(data.filter(p => p.userId !== userProfile.userId));
        },
        (error) => {
          console.error("Error fetching all progress:", error);
        }
      );

      unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          const usersMap: Record<string, UserProfile> = {};
          snap.docs.forEach(d => {
            usersMap[d.id] = d.data() as UserProfile;
          });
          setAllUsers(usersMap);
        },
        (error) => console.error("Error fetching users:", error)
      );
    }

    return () => {
      unsubAll?.();
      unsubUsers?.();
    };
  }, [userProfile]);

  const matchesCount = useMemo(() => {
    if (!progress || allProgress.length === 0) return 0;
    
    const myRepeated = Object.entries(normalizedMyStickers)
      .filter(([_, s]) => s > 1)
      .map(([id]) => id);

    let count = 0;
    allProgress.forEach(peer => {
      const peerUser = allUsers[peer.userId];
      if (!peerUser || peerUser.status !== 'approved') return;

      const peerStickersNormalized: Record<string, number> = {};
      Object.entries(peer.stickers).forEach(([id, s]) => {
        const norm = normalizeStickerId(id);
        peerStickersNormalized[norm] = (peerStickersNormalized[norm] || 0) + s;
      });

      const peerRepeated = Object.entries(peerStickersNormalized)
        .filter(([_, s]) => s > 1)
        .map(([id]) => id);
      
      const theyCanGiveMe = peerRepeated.some(id => (normalizedMyStickers[id] || 0) === 0);
      const iCanGiveThem = myRepeated.some(id => (peerStickersNormalized[id] || 0) === 0);
      
      if (theyCanGiveMe || iCanGiveThem) {
        count++;
      }
    });
    return count;
  }, [progress, allProgress, allUsers, normalizedMyStickers]);

  const stats = [
    { 
      name: t('dash.completion'), 
      value: `${completionRate}%`, 
      subValue: `${ownedCount} / ${totalPossible} ${t('dash.figures')}`,
      icon: Trophy, 
      color: 'text-amber-500', 
      bg: 'bg-amber-500/10' 
    },
    { name: t('dash.missing'), value: missingCount, subValue: `${missingRate}%`, icon: Clock, color: 'text-worldcup-red', bg: 'bg-worldcup-red/10' },
    { name: t('dash.repeated'), value: repeatedCount, icon: Repeat, color: 'text-amber-500', bg: 'bg-amber-500/10', action: () => setIsRepeatedListOpen(true) },
    { name: t('dash.exchanges'), value: matchesCount, icon: ArrowRightLeft, color: 'text-purple-500', bg: 'bg-purple-500/10', action: () => navigate('/market') },
    { 
      name: t('dash.incomplete'), 
      value: teamStats.incompleteTeams, 
      subValue: `${t('dash.empty')}: ${teamStats.emptyTeams} | ${t('dash.full')}: ${teamStats.fullTeams}`, 
      icon: TrendingUp, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10' 
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Self-healing for Samuel admin role or quick access */}
      {userProfile?.username.toLowerCase().trim() === 'samuel' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border-2 border-green-500/30 p-6 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h4 className="text-white font-black uppercase tracking-tight">{t('admin.title')}</h4>
              <p className="text-zinc-500 text-xs font-medium">{t('dash.admin_status')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/admin')}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-zinc-700"
            >
              {t('admin.title')}
            </button>
            {userProfile.role !== 'admin' && (
              <button 
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'users', userProfile.userId), { role: 'admin', status: 'approved' });
                    alert(t('dash.restore_role_alert'));
                    window.location.reload();
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="px-6 py-3 bg-green-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
              >
                {t('dash.restore_role')}
              </button>
            )}
          </div>
        </motion.div>
      )}

      {showiOSInstall && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-[60] bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl -mr-16 -mt-16 rounded-full" />
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-white font-black italic uppercase tracking-tight">{t('dash.pwa_title')}</h4>
                <p className="text-white/80 text-xs font-medium">{t('dash.pwa_desc')}</p>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsIOSModalOpen(true);
              }}
              className="relative z-[70] px-6 py-3 bg-white text-blue-600 font-black text-[11px] uppercase tracking-widest rounded-full shadow-2xl active:scale-95 transition-all cursor-pointer ring-4 ring-white/30"
            >
              {t('nav.install')}
            </button>
          </div>
        </motion.div>
      )}

      {/* iOS Installation Instructions Modal */}
      {isIOSModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] max-w-md w-full relative z-[210]"
          >
            {/* Floating Arrow Guidance */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: [0, 15, 0], opacity: 1 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
            >
              <div className="bg-blue-600 text-white px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl">
                {t('dash.pwa_touch_below')}
              </div>
              <ChevronRight className="w-10 h-10 text-blue-600 rotate-90" />
            </motion.div>
            <button 
              onClick={() => setIsIOSModalOpen(false)}
              className="absolute top-6 right-6 w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 z-20 shadow-lg"
              aria-label={t('album.close')}
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center mb-10">
              <div className="w-24 h-24 bg-blue-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-xl shadow-blue-500/5">
                <Smartphone className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tight">{t('dash.pwa_ios_title')}</h3>
              {window.self !== window.top ? (
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <p className="text-amber-500 font-black text-[10px] uppercase tracking-widest">{t('dash.pwa_attention')}</p>
                  <p className="text-zinc-400 text-xs mt-1">{t('dash.pwa_iframe_warning')}</p>
                </div>
              ) : (
                <p className="text-zinc-400 text-sm mt-3 font-medium">{t('dash.pwa_ios_desc')}</p>
              )}
            </div>

            <div className="space-y-6 mb-8 text-center">
              <div className="relative p-6 bg-blue-600/10 rounded-[2.5rem] border border-blue-500/20 overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 rounded-full" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 bg-white rounded-[1.5rem] mb-6 flex items-center justify-center shadow-2xl animate-bounce">
                    <ShareIcon className="w-10 h-10 text-blue-600" />
                  </div>
                  <h4 className="text-white font-black text-lg uppercase tracking-widest leading-none">{t('dash.pwa_ios_step1')}</h4>
                  <p className="text-blue-400 text-[10px] font-black mt-3 uppercase tracking-widest underline">{t('dash.pwa_ios_safari_only')}</p>
                  <p className="text-zinc-400 text-xs font-bold mt-2 uppercase tracking-tight">{t('dash.pwa_ios_share_desc')}</p>
                </div>
              </div>

              <div className="relative p-6 bg-zinc-800/50 rounded-[2.5rem] border border-white/5">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-zinc-700 rounded-[1.25rem] mb-6 flex items-center justify-center shadow-xl">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-zinc-300 font-bold text-sm uppercase tracking-widest leading-none">{t('dash.pwa_ios_step2')}</h4>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold mt-2">{t('dash.pwa_ios_scroll_down')}</p>
                  <p className="text-white font-black text-md uppercase tracking-widest mt-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/5">
                    {t('dash.pwa_ios_add_home')}
                  </p>
                  <p className="text-zinc-500 text-[9px] mt-4 font-bold uppercase italic">{t('dash.pwa_ios_not_found')}</p>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: 'Stickers 2026',
                          text: t('dash.pwa_ios_share_text'),
                          url: window.location.origin,
                        });
                      } catch (err) {
                        console.log('Error sharing:', err);
                      }
                    }
                  }}
                  className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <ShareIcon className="w-6 h-6" />
                  {t('dash.pwa_ios_open_menu')}
                </button>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest italic mt-6 px-6 leading-relaxed">
                  {t('dash.pwa_ios_footer')}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsIOSModalOpen(false)}
              className="w-full py-5 bg-zinc-800 text-zinc-400 font-black uppercase tracking-[0.2em] text-[10px] rounded-[2rem] border border-zinc-700 hover:text-white transition-all"
            >
              {t('dash.pwa_close_guide')}
            </button>
          </motion.div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden p-8 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-worldcup-green/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-worldcup-red/5 blur-[100px] -ml-32 -mb-32 rounded-full" />
        
        <div className="relative z-10 w-full md:w-auto">
          <div className="flex justify-between items-start">
            <WorldCupBall className="w-16 h-16 mb-4 shadow-2xl" animate />
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-black/30 backdrop-blur-sm rounded-lg border border-white/5 mr-2">
                <RefreshCcw className="w-3 h-3 text-green-500 animate-spin" style={{ animationDuration: '3s' }} />
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{t('dash.live')}</span>
              </div>
              <button 
                onClick={() => navigate('/market')}
                className="relative flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-zinc-700 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-zinc-900">
                    {unreadCount}
                  </span>
                )}
                {t('nav.chat')}
              </button>
            </div>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">
            {t('dash.welcome')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-worldcup-red via-worldcup-green to-worldcup-blue animate-gradient-x">{userProfile?.displayName}</span>!
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <p className="text-zinc-400 font-medium whitespace-nowrap">{t('dash.path_to_glory')}</p>
            
            <button 
              onClick={() => setIsRarityModalOpen(true)}
              className={cn(
                "px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95",
                rarityData.color, rarityData.text, rarityData.border
              )}
            >
              {t('nav.album')} {t(`rarity.${rarityData.id}`)}
              <Settings2 className="w-3 h-3 opacity-60" />
            </button>

            {userProfile?.residingCountry && (
              <button 
                onClick={() => setIsCountryModalOpen(true)}
                className="px-3 py-1 bg-zinc-950/50 border border-zinc-800 rounded-lg text-[10px] font-black text-white uppercase italic tracking-widest flex items-center gap-2 transition-all hover:border-zinc-700"
              >
                <MapPin className="w-3 h-3 text-worldcup-red" />
                {userProfile.residingCountry}
              </button>
            )}

            <div className="flex items-center gap-1">
              <div className="flex -space-x-1 mr-1">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse border border-green-400" />
              </div>
              <span className="text-[9px] font-black text-green-500 tracking-widest uppercase italic">{t('dash.secure_connection')}</span>
            </div>

            <div className="flex items-center gap-1">
              {userProfile?.groupIds?.map(gid => {
                const group = groups.find(g => g.id === gid);
                if (!group) return null;
                return (
                  <div 
                    key={gid}
                    className="px-3 py-1 rounded-lg border text-[9px] font-black uppercase italic tracking-widest"
                    style={{ backgroundColor: `${group.color}15`, color: group.color, borderColor: `${group.color}30` }}
                  >
                    {group.name}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative z-10 hidden sm:flex items-center gap-3 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-zinc-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-worldcup-red to-worldcup-blue flex items-center justify-center font-black text-white italic">
            #{ownedCount}
          </div>
          <div className="pr-4">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold leading-none">{t('dash.points')}</p>
            <p className="text-lg font-black text-white leading-none mt-0.5">{ownedCount * 10}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          const isClickable = !!stat.action;
          return (
            <motion.div 
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => stat.action?.()}
              className={cn(
                "group relative bg-zinc-900 border border-zinc-800 p-6 rounded-[2.5rem] transition-all duration-300",
                "hover:border-zinc-700 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1",
                isClickable && "cursor-pointer active:scale-95 border-zinc-700/50"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]" />
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={cn("w-14 h-14 rounded-[1.25rem] flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110", stat.bg)}>
                  <Icon className={cn("w-7 h-7", stat.color)} />
                </div>
                {isClickable && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-800 shadow-inner">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">{t('dash.see')}</span>
                  </div>
                )}
              </div>
              
              <div className="relative z-10">
                <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">{stat.name}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-black text-white italic">{stat.value}</p>
                  {stat.subValue && <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">({stat.subValue})</span>}
                  {stat.name === t('dash.repeated') && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-tighter">{t('dash.gold')}</span>}
                </div>
              </div>

              {isClickable && (
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                  <ChevronRight className="w-5 h-5 text-zinc-600" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {leaderboard.length > 0 && (
        <section className="bg-zinc-900 border border-zinc-800 p-6 sm:p-10 rounded-[3rem] relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-[120px] -mr-48 -mt-48 rounded-full" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-10 bg-gradient-to-b from-amber-500 to-amber-800 rounded-full" />
                <div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{t('dash.elite_list')}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-amber-500/80 font-black uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">{t('dash.top_10')}</span>
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">
                      {Object.keys(allUsers).length} {t('admin.users')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {leaderboard.map((item, idx) => (
                <motion.div 
                  key={item.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "relative flex items-center justify-between p-4 sm:p-5 rounded-full border transition-all duration-500 group overflow-hidden",
                    idx === 0 ? "bg-gradient-to-r from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/50 shadow-[0_0_40px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/30 ml-4 border-l-[6px]" :
                    idx === 1 ? "bg-gradient-to-r from-zinc-400/15 via-zinc-400/5 to-transparent border-zinc-400/40 ml-2 border-l-4" :
                    idx === 2 ? "bg-gradient-to-r from-amber-800/15 via-amber-800/5 to-transparent border-amber-800/40 ml-1 border-l-4" :
                    "bg-transparent border-zinc-800/40 grayscale group-hover:grayscale-0 group-hover:bg-zinc-800/10 hover:border-zinc-700/60"
                  )}
                >
                  {idx < 3 && (
                    <div className={cn(
                      "absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from),_transparent)]",
                      idx === 0 ? "from-amber-500" : idx === 1 ? "from-zinc-400" : "from-amber-800"
                    )} />
                  )}
                  <div className="flex items-center gap-4 min-w-0 relative z-10">
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-black italic shadow-lg border text-base transition-transform group-hover:scale-110",
                        idx === 0 ? "bg-gradient-to-tr from-amber-400 to-amber-600 text-black border-amber-300 scale-110 shadow-amber-500/20 shadow-[0_0_20px_rgba(251,191,36,0.2)]" :
                        idx === 1 ? "bg-gradient-to-tr from-zinc-300 to-zinc-500 text-zinc-950 border-zinc-200" :
                        idx === 2 ? "bg-gradient-to-tr from-amber-700 to-amber-900 text-amber-100 border-amber-600" :
                        "bg-zinc-900 text-zinc-500 border-zinc-800"
                      )}>
                        {idx + 1}
                      </div>
                      {idx === 0 && (
                        <div className="absolute -top-4 -left-4 rotate-[-20deg] drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                          <Trophy className="w-8 h-8 text-amber-400 animate-pulse" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 py-1 px-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn(
                            "font-black uppercase tracking-tight drop-shadow-sm",
                            idx === 0 ? "text-white text-xl sm:text-2xl" : 
                            idx < 3 ? "text-zinc-50 text-lg" : 
                            "text-zinc-200 text-base"
                          )}>
                            {item.user?.displayName || t('admin.no_user_found')}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {idx === 0 && (
                              <div className="flex items-center gap-1 bg-amber-500 text-black px-2 py-0.5 rounded-md shadow-lg border border-amber-400">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                <span className="text-[8px] font-black uppercase tracking-tighter">{t('dash.legend')}</span>
                              </div>
                            )}
                            {idx === 1 && <span className="text-[8px] border border-zinc-400 bg-zinc-950 text-zinc-100 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter">{t('dash.elite')}</span>}
                            {idx === 2 && <span className="text-[8px] border border-amber-800 bg-zinc-950 text-amber-500 px-2 py-0.5 rounded-md font-black uppercase tracking-tighter">{t('dash.pro')}</span>}
                          </div>
                        </div>

                        {/* Location and Groups */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.user?.residingCountry && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/40 border border-zinc-800/50" title={item.user.residingCountry}>
                              {FLAGS[item.user.residingCountry as keyof typeof FLAGS] ? (
                                <img src={FLAGS[item.user.residingCountry as keyof typeof FLAGS]} className="w-3 h-2 object-cover rounded-[1px]" alt="" referrerPolicy="no-referrer" />
                              ) : (
                                <MapPin className="w-2 h-2 text-worldcup-red" />
                              )}
                              <span className="text-[9px] text-zinc-400 font-black uppercase italic tracking-tighter">{item.user.residingCountry}</span>
                            </div>
                          )}
                          {item.user?.groupIds?.slice(0, 3).map((gid: string) => {
                            const group = groups.find(g => g.id === gid);
                            if (!group) return null;
                            return (
                              <div 
                                key={gid}
                                className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase italic tracking-widest border"
                                style={{ backgroundColor: `${group.color}15`, color: group.color, borderColor: `${group.color}40` }}
                              >
                                {group.name}
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Stats Row */}
                        <div className="flex items-center gap-3 mt-1 underline-offset-4 decoration-zinc-800">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-tight">{t('nav.album')}:</span>
                            <span className="text-xs text-zinc-200 font-black italic">{item.owned}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-worldcup-green" />
                            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-tight">FWC:</span>
                            <span className="text-xs text-zinc-200 font-black italic">{item.fwcOwned}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-worldcup-red" />
                            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-tight">CC:</span>
                            <span className="text-xs text-zinc-200 font-black italic">{item.ccOwned}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 px-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xl font-black italic tabular-nums transition-all",
                        idx === 0 ? "text-amber-500 text-3xl drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]" : 
                        idx < 3 ? "text-zinc-100 text-xl" : 
                        "text-zinc-600"
                      )}>
                        {item.rate}%
                      </span>
                    </div>
                    {idx < 3 && (
                      <div className={cn(
                        "text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-0.5 rounded-full border shadow-sm transition-colors",
                        idx === 0 ? "bg-amber-500/20 text-amber-500 border-amber-500/30" :
                        idx === 1 ? "bg-zinc-100/10 text-zinc-300 border-zinc-100/20" :
                        "bg-amber-900/20 text-amber-600 border-amber-900/30"
                      )}>
                        {idx === 0 ? t('dash.gold') : idx === 1 ? t('dash.silver') : t('dash.bronze')}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-black/40 rounded-[2.5rem] border border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all hover:bg-black/60">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <Star className="w-6 h-6 text-amber-500" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm text-white font-black uppercase tracking-tight">{t('dash.keep_climbing')}</p>
                  <p className="text-zinc-500 text-xs font-medium">{t('dash.competing_against').replace('{count}', Object.keys(allUsers).length.toString())}</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/market')}
                className="w-full sm:w-auto px-8 py-3.5 bg-worldcup-green text-black font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl shadow-worldcup-green/20 hover:scale-105 active:scale-95 transition-all"
              >
                {t('dash.search_exchanges')}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-worldcup-green/5 blur-[120px] -mr-32 -mt-32 rounded-full transition-all group-hover:bg-worldcup-green/10" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-worldcup-green rounded-full" />
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{t('nav.status')}</h3>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] block">{t('nav.home')}</span>
                  <span className="text-5xl font-black text-white italic tracking-tighter leading-none">{completionRate}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] block">{t('dash.missing')}</span>
                  <span className="text-5xl font-black text-worldcup-red italic tracking-tighter leading-none">{missingCount}</span>
                </div>
              </div>
              
              <div className="h-4 w-full bg-zinc-800/50 rounded-full overflow-hidden p-1 border border-zinc-800">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 1.5, ease: 'circOut' }}
                  className="h-full bg-gradient-to-r from-worldcup-red via-worldcup-green to-worldcup-blue rounded-full relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/40 blur-[2px]" />
                </motion.div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/20 border border-zinc-800/50 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800">
                  <TrendingUp className="w-5 h-5 text-worldcup-green" />
                </div>
                <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                  {t('dash.history_stats').replace('{count}', missingCount.toString())}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-worldcup-blue/5 blur-[120px] -ml-32 -mb-32 rounded-full" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-worldcup-blue rounded-full" />
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{t('dash.next_objectives')}</h3>
            </div>
            
            <ul className="space-y-3">
              {[
                { text: t('dash.obj_market'), icon: Repeat, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                { text: t('dash.obj_sync'), icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10' },
                { text: t('dash.obj_chat'), icon: MessageCircle, color: 'text-blue-400', bg: 'bg-blue-400/10' },
              ].map((item, i) => (
                <li 
                  key={i} 
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-zinc-800/50 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer"
                >
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", item.bg)}>
                    <item.icon className={cn("w-6 h-6", item.color)} />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-zinc-200 block group-hover:text-white transition-colors">{item.text}</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">{t('dash.action_recommended')}</span>
                  </div>
                  <ArrowRightLeft className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <RepeatedList 
        isOpen={isRepeatedListOpen} 
        onClose={() => setIsRepeatedListOpen(false)} 
        stickers={normalizedMyStickers} 
      />

      <AnimatePresence>
        {isCountryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] max-w-md w-full relative"
            >
              <button 
                onClick={() => setIsCountryModalOpen(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-worldcup-red/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-worldcup-red/20">
                  <MapPin className="w-8 h-8 text-worldcup-red" />
                </div>
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">{t('admin.country')}</h3>
                <p className="text-zinc-500 text-xs mt-2 font-medium">{t('dash.update_location')}</p>
              </div>

              <div className="max-h-[50vh] overflow-y-auto no-scrollbar grid grid-cols-1 gap-2">
                {ALL_COUNTRIES.map((country) => (
                  <button
                    key={country}
                    onClick={() => updateCountry(country)}
                    className={cn(
                      "p-4 rounded-2xl border flex items-center justify-between transition-all",
                      userProfile?.residingCountry === country 
                        ? "border-worldcup-red bg-worldcup-red/5 text-white" 
                        : "border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    )}
                  >
                    <span className="font-black uppercase text-xs tracking-widest">{country}</span>
                    {userProfile?.residingCountry === country && <CheckCircle2 className="w-4 h-4 text-worldcup-red" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {isRarityModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] max-w-md w-full relative"
            >
              <button 
                onClick={() => setIsRarityModalOpen(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-worldcup-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-worldcup-green/20">
                  <Star className="w-8 h-8 text-worldcup-green" />
                </div>
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">{t('dash.rarity')}</h3>
                <p className="text-zinc-500 text-xs mt-2 font-medium">{t('dash.rarity_edit_desc')}</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {RARITIES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => updateRarity(r.id)}
                    className={cn(
                      "group p-4 rounded-2xl border flex items-center justify-between transition-all relative overflow-hidden",
                      currentRarity === r.id 
                        ? `${r.border} bg-white/5 shadow-xl` 
                        : "border-zinc-800 bg-zinc-950/30 hover:border-zinc-700 hover:bg-zinc-900"
                    )}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg", r.color)}>
                        <div className="w-4 h-4 bg-white/20 rounded-full blur-[2px] animate-pulse" />
                      </div>
                      <div className="text-left">
                        <p className={cn("font-black uppercase text-sm leading-tight", currentRarity === r.id ? "text-white" : "text-zinc-300 group-hover:text-white")}>
                          {t(`rarity.${r.id}`)}
                        </p>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          {t(`rarity.label_${r.id}`)}
                        </p>
                      </div>
                    </div>
                    {currentRarity === r.id ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 relative z-10" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-zinc-600 transition-colors" />
                    )}
                    {currentRarity === r.id && (
                      <motion.div 
                        layoutId="rarity-active"
                        className={cn("absolute inset-y-0 right-0 w-1", r.color.replace('bg-', 'bg-'))}
                      />
                    )}
                  </button>
                ))}
              </div>
              
              <p className="text-[9px] text-zinc-600 italic mt-6 text-center px-4 leading-relaxed">
                {t('dash.rarity_warning')}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
