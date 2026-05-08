import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AlbumProgress } from '../types';
import { TEAMS, STICKERS_PER_TEAM, FWC_COUNT, COCA_COLA_COUNT, normalizeStickerId } from '../constants';
import { motion } from 'motion/react';
import { Trophy, Users, Star, BarChart3, TrendingUp, Clock, Repeat, CheckCircle2, MessageCircle, LogOut, ShieldCheck, ArrowRightLeft, Download, ChevronRight, RefreshCcw, Smartphone, Share as ShareIcon, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { WorldCupBall } from './ui/WorldCupBall';
import { RepeatedList } from './RepeatedList';
import { query, where } from 'firebase/firestore';

export default function Dashboard({ userProfile }: { userProfile: UserProfile | null }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<AlbumProgress | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showiOSInstall, setShowiOSInstall] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRepeatedListOpen, setIsRepeatedListOpen] = useState(false);
  const [isIOSModalOpen, setIsIOSModalOpen] = useState(false);

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
    if (allProgress.length === 0) return [];
    
    // Include current user in the comparison
    const allStats = [
      { 
        userId: userProfile?.userId, 
        progress, 
        user: userProfile 
      },
      ...allProgress.map(p => ({ 
        userId: p.userId, 
        progress: p, 
        user: allUsers[p.userId] 
      }))
    ].filter(item => item.user && item.user.status === 'approved');

    const calculated = allStats.map(item => {
      const s = item.progress?.stickers || {};
      const counts: Record<string, number> = {};
      Object.entries(s).forEach(([id, qty]) => {
        const norm = normalizeStickerId(id);
        counts[norm] = Math.max(counts[norm] || 0, qty);
      });
      const owned = Object.values(counts).filter(v => v >= 1).length;
      const rate = Math.round((owned / totalPossible) * 100);
      return {
        userId: item.userId,
        user: item.user,
        rate,
        updatedAt: item.progress?.updatedAt?.toDate?.() || new Date(0)
      };
    });

    // Sort by rate (desc) then by updatedAt (asc) - tie breaker: who reached it first
    return calculated.sort((a, b) => {
      if (b.rate !== a.rate) return b.rate - a.rate;
      return a.updatedAt.getTime() - b.updatedAt.getTime();
    }).slice(0, 3);
  }, [allProgress, allUsers, userProfile, progress, totalPossible]);

  const missingCount = totalPossible - ownedCount;
  const completionRate = Math.round((ownedCount / totalPossible) * 100);

  const teamStats = useMemo(() => {
    let emptyTeams = 0;
    let incompleteTeams = 0;
    
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
      }
    });

    return { emptyTeams, incompleteTeams };
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
    { name: 'Completado', value: `${completionRate}%`, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { name: 'En Álbum', value: ownedCount, icon: Star, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'Repetidas', value: repeatedCount, icon: Repeat, color: 'text-amber-500', bg: 'bg-amber-500/10', action: () => setIsRepeatedListOpen(true) },
    { name: 'Intercambios', value: matchesCount, icon: ArrowRightLeft, color: 'text-purple-500', bg: 'bg-purple-500/10', action: () => navigate('/market') },
    { name: 'Equipos Vacíos', value: teamStats.emptyTeams, icon: BarChart3, color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
    { name: 'Incompletos', value: teamStats.incompleteTeams, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                <h4 className="text-white font-black italic uppercase tracking-tight">Instala en tu iPhone</h4>
                <p className="text-white/80 text-xs font-medium">Lleva tu álbum siempre contigo como una App.</p>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsIOSModalOpen(true);
              }}
              className="relative z-[70] px-6 py-3 bg-white text-blue-600 font-black text-[11px] uppercase tracking-widest rounded-full shadow-2xl active:scale-95 transition-all cursor-pointer ring-4 ring-white/30"
            >
              INSTALAR AHORA
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
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] max-w-md w-full relative"
          >
            <button 
              onClick={() => setIsIOSModalOpen(false)}
              className="absolute top-6 right-6 w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 z-20 shadow-lg"
              aria-label="Cerrar"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center mb-10">
              <div className="w-24 h-24 bg-blue-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-xl shadow-blue-500/5">
                <Smartphone className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tight">Instalar en iOS</h3>
              <p className="text-zinc-400 text-sm mt-3 font-medium">Lleva Stickers 2026 siempre contigo.</p>
            </div>

            <div className="space-y-6 mb-8">
              <button 
                onClick={async () => {
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: 'Stickers 2026',
                        text: '¡Colecciona las estampas del mundial!',
                        url: window.location.origin,
                      });
                    } catch (err) {
                      console.log('Error sharing:', err);
                    }
                  }
                }}
                className="w-full flex items-center justify-center gap-3 text-white text-[11px] uppercase font-black tracking-[0.2em] bg-blue-600 hover:bg-blue-500 py-5 px-5 rounded-3xl transition-all active:scale-95 shadow-xl shadow-blue-600/20"
              >
                <ShareIcon className="w-5 h-5 text-white" />
                <span>PULSA AQUÍ PARA INSTALAR</span>
              </button>

              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center font-black text-blue-500 shrink-0">1</div>
                  <p className="text-zinc-200 text-sm leading-relaxed">
                    Si el botón de arriba no abre el menú, toca el icono de <span className="text-white font-bold inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-zinc-800 rounded">Compartir <ShareIcon className="w-3 h-3"/></span>.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center font-black text-blue-500 shrink-0">2</div>
                  <p className="text-zinc-200 text-sm leading-relaxed">
                    Desliza hacia arriba y selecciona <span className="text-white font-bold inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-zinc-800 rounded">Agregar a Inicio <Plus className="w-3 h-3"/></span>.
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsIOSModalOpen(false)}
              className="w-full py-5 bg-white text-blue-600 font-black uppercase tracking-[0.2em] text-[10px] rounded-3xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
            >
              ¡ENTENDIDO, VAMOS!
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
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">En Vivo</span>
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
                Chat
              </button>
            </div>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">
            ¡Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-worldcup-red via-worldcup-green to-worldcup-blue animate-gradient-x">{userProfile?.displayName}</span>!
          </h2>
          <p className="text-zinc-400 mt-2 font-medium">Tu camino a la gloria eterna ha comenzado.</p>
        </div>

        <div className="relative z-10 hidden sm:flex items-center gap-3 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-zinc-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-worldcup-red to-worldcup-blue flex items-center justify-center font-black text-white italic">
            #{ownedCount}
          </div>
          <div className="pr-4">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold leading-none">Puntos</p>
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
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Ver</span>
                  </div>
                )}
              </div>
              
              <div className="relative z-10">
                <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">{stat.name}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-black text-white italic">{stat.value}</p>
                  {stat.name === 'Repetidas' && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-tighter">Gold</span>}
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
        <section className="bg-zinc-900 border border-zinc-800 p-8 rounded-[3rem] relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-[120px] -mr-48 -mt-48 rounded-full" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-amber-500 rounded-full" />
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Podio de Coleccionistas</h3>
              </div>
              <p className="text-[10px] bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full border border-amber-500/20 font-black uppercase tracking-[0.2em]">Top Usuarios</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {leaderboard.map((item, idx) => (
                <div 
                  key={item.userId} 
                  className={cn(
                    "relative p-6 rounded-[2rem] border transition-all hover:scale-[1.02] duration-300",
                    idx === 0 ? "bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/10" :
                    idx === 1 ? "bg-zinc-800/10 border-zinc-700/50 shadow-lg shadow-black/20" :
                    "bg-zinc-800/10 border-zinc-800/50"
                  )}
                >
                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-zinc-950 border-2 border-zinc-800 flex items-center justify-center font-black italic shadow-xl">
                    <span className={cn(
                      "text-lg",
                      idx === 0 ? "text-amber-500" :
                      idx === 1 ? "text-zinc-400" :
                      "text-amber-700"
                    )}>{idx + 1}°</span>
                  </div>
                  
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center shadow-lg">
                      <Users className="w-8 h-8 text-white/20" />
                    </div>
                    <div>
                      <p className="text-white font-black italic uppercase truncate max-w-[150px]">{item.user?.displayName}</p>
                      <p className="text-3xl font-black text-worldcup-green italic">{item.rate}%</p>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] text-zinc-500 font-bold leading-tight px-4">
                        {idx === 0 ? "¡Liderando el camino a la gloria! Un verdadero historiador de la Copa Mundo." : 
                         idx === 1 ? "¡Paso firme y decidido! Estás a nada de la cima, no te detengas." :
                         "¡En el podio de honor! Demostrando que cada estampa cuenta."}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-black/40 rounded-[2rem] border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-zinc-400 font-medium text-center sm:text-left">
                Cada estampa conseguida o intercambiada te acerca al salón de la fama. <br/>
                <span className="text-zinc-500 text-xs">¡Sigue coleccionando y podrías ser tú quien lidere el próximo podio!</span>
              </p>
              <button 
                onClick={() => navigate('/market')}
                className="px-6 py-3 bg-worldcup-green text-black font-black uppercase tracking-widest text-[10px] rounded-full shadow-lg shadow-worldcup-green/20 hover:scale-105 active:scale-95 transition-all"
              >
                Buscar Intercambios
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
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Estado de Colección</h3>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] block">Progreso Local</span>
                  <span className="text-5xl font-black text-white italic tracking-tighter leading-none">{completionRate}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] block">Faltantes</span>
                  <span className="text-2xl font-black text-zinc-300 italic tracking-tighter leading-none">{missingCount}</span>
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
                  Estás a <span className="text-white font-bold">{missingCount}</span> estampas de completar la historia. Cada intercambio te acerca más.
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
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Siguientes Objetivos</h3>
            </div>
            
            <ul className="space-y-3">
              {[
                { text: 'Explorar Market de Intercambios', icon: Repeat, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                { text: 'Sincronizar nuevas estampas', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10' },
                { text: 'Iniciar chat con coleccionistas', icon: MessageCircle, color: 'text-blue-400', bg: 'bg-blue-400/10' },
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
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Acción Recomendada</span>
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
    </div>
  );
}
