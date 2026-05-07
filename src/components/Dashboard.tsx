import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AlbumProgress } from '../types';
import { TEAMS, STICKERS_PER_TEAM, FWC_COUNT, COCA_COLA_COUNT } from '../constants';
import { motion } from 'motion/react';
import { Trophy, Users, Star, BarChart3, TrendingUp, Clock, Repeat, CheckCircle2, MessageCircle, LogOut, ShieldCheck, ArrowRightLeft, Download, ChevronRight, RefreshCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { WorldCupBall } from './ui/WorldCupBall';
import { RepeatedList } from './RepeatedList';
import { query, where } from 'firebase/firestore';

export default function Dashboard({ userProfile }: { userProfile: UserProfile | null }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<AlbumProgress | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRepeatedListOpen, setIsRepeatedListOpen] = useState(false);

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
    const checkStandalone = () => {
      const standalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
      setIsStandalone(!!standalone);
    };
    checkStandalone();
    
    // Listen for the custom event from main.tsx
    const handler = () => setIsStandalone(false);
    window.addEventListener('trigger-install-prompt', handler);
    return () => window.removeEventListener('trigger-install-prompt', handler);
  }, []);

  const triggerInstall = () => {
    window.dispatchEvent(new CustomEvent('trigger-install-prompt'));
  };

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

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
  const ownedCount = Object.values(stickers).filter(s => s >= 1).length;
  
  const repeatedCount = useMemo(() => {
    let count = 0;
    const counts: Record<string, number> = {};
    const normalizeId = (id: string) => {
      if (id.startsWith('team-')) {
        const parts = id.split('-');
        const index = parseInt(parts[1]);
        if (!isNaN(index) && TEAMS[index]) {
          return `${TEAMS[index]}-${parts[2]}`;
        }
      }
      return id;
    };

    Object.entries(stickers).forEach(([id, s]) => {
      const norm = normalizeId(id);
      counts[norm] = (counts[norm] || 0) + s;
    });

    Object.values(counts).forEach(s => {
      if (s > 1) count += (s - 1);
    });
    return count;
  }, [stickers]);

  const missingCount = totalPossible - ownedCount;
  const completionRate = Math.round((ownedCount / totalPossible) * 100);

  const teamStats = useMemo(() => {
    let emptyTeams = 0;
    let incompleteTeams = 0;
    
    TEAMS.forEach((team, index) => {
      let teamOwned = 0;
      for (let i = 1; i <= STICKERS_PER_TEAM; i++) {
        const idByName = `${team}-${i}`;
        const idByIndex = `team-${index}-${i}`;
        if ((stickers[idByName] || stickers[idByIndex] || 0) >= 1) {
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
  }, [stickers]);

  const [allProgress, setAllProgress] = useState<AlbumProgress[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>({});

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
    
    const normalizeId = (id: string) => {
      if (id.startsWith('team-')) {
        const parts = id.split('-');
        const index = parseInt(parts[1]);
        if (!isNaN(index) && TEAMS[index]) {
          return `${TEAMS[index]}-${parts[2]}`;
        }
      }
      return id;
    };

    const myStickersNormalized: Record<string, number> = {};
    Object.entries(progress.stickers).forEach(([id, s]) => {
      myStickersNormalized[normalizeId(id)] = s;
    });

    const myRepeated = Object.entries(progress.stickers)
      .filter(([_, s]) => s > 1)
      .map(([id]) => normalizeId(id));

    let count = 0;
    allProgress.forEach(peer => {
      const peerUser = allUsers[peer.userId];
      if (!peerUser || peerUser.status !== 'approved') return;

      const peerStickersNormalized: Record<string, number> = {};
      Object.entries(peer.stickers).forEach(([id, s]) => {
        peerStickersNormalized[normalizeId(id)] = s;
      });

      const peerRepeated = Object.entries(peer.stickers)
        .filter(([_, s]) => s > 1)
        .map(([id]) => normalizeId(id));
      
      const theyCanGiveMe = peerRepeated.some(id => (myStickersNormalized[id] || 0) === 0);
      const iCanGiveThem = myRepeated.some(id => (peerStickersNormalized[id] || 0) === 0);
      
      if (theyCanGiveMe || iCanGiveThem) {
        count++;
      }
    });
    return count;
  }, [progress, allProgress, allUsers]);

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
        stickers={stickers} 
      />
    </div>
  );
}
