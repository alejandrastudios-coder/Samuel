import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AlbumProgress } from '../types';
import { TEAMS, STICKERS_PER_TEAM, PRIZES_COUNT, COCA_COLA_COUNT } from '../constants';
import { motion } from 'motion/react';
import { Trophy, Users, Star, BarChart3, TrendingUp, Clock, Repeat, CheckCircle2, MessageCircle, LogOut, ShieldCheck, ArrowRightLeft, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { WorldCupBall } from './ui/WorldCupBall';

export default function Dashboard({ userProfile }: { userProfile: UserProfile | null }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<AlbumProgress | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
      setIsStandalone(!!standalone);
    };
    checkStandalone();
    
    // Standard handler for Chrome/Android
    const handler = (e: any) => {
      e.preventDefault();
      // We don't hide the UI, we just keep the event for later
      window.addEventListener('beforeinstallprompt', (ev) => {
        (window as any).deferredPrompt = ev;
      });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = () => {
    window.dispatchEvent(new CustomEvent('trigger-install-prompt'));
  };

  useEffect(() => {
    if (userProfile) {
      return onSnapshot(doc(db, 'album_progress', userProfile.userId), (doc) => {
         if (doc.exists()) {
           setProgress(doc.data() as AlbumProgress);
         }
      });
    }
  }, [userProfile]);

  const totalPossible = (TEAMS.length * STICKERS_PER_TEAM) + PRIZES_COUNT + COCA_COLA_COUNT;
  const stickers = progress?.stickers || {};
  const ownedCount = Object.values(stickers).filter(s => s >= 1).length;
  const repeatedCount = Object.values(stickers).filter(s => s === 2).length;
  const missingCount = totalPossible - ownedCount;
  const completionRate = Math.round((ownedCount / totalPossible) * 100);

  const [allProgress, setAllProgress] = useState<AlbumProgress[]>([]);
  const [myProgress, setMyProgress] = useState<AlbumProgress | null>(null);

  useEffect(() => {
    if (!userProfile) return;

    let unsubAll: (() => void) | undefined;
    let unsubMe: (() => void) | undefined;

    // Only fetch others' progress if approved or admin
    if (userProfile.status === 'approved' || userProfile.role === 'admin') {
      unsubAll = onSnapshot(
        collection(db, 'album_progress'), 
        (snap) => {
          setAllProgress(snap.docs.map(d => d.data() as AlbumProgress).filter(p => p.userId !== userProfile.userId));
        },
        (error) => {
          console.error("Error fetching all progress:", error);
        }
      );
    }

    // Always try to fetch my progress
    unsubMe = onSnapshot(
      doc(db, 'album_progress', userProfile.userId), 
      (snap) => {
        if (snap.exists()) setMyProgress(snap.data() as AlbumProgress);
      },
      (error) => {
        console.error("Error fetching my progress:", error);
      }
    );

    return () => {
      unsubAll?.();
      unsubMe?.();
    };
  }, [userProfile]);

  const matchesCount = useMemo(() => {
    if (!myProgress || allProgress.length === 0) return 0;
    
    let count = 0;
    allProgress.forEach(peer => {
      // Stickers the peer has repeated
      const peerRepeated = Object.entries(peer.stickers)
        .filter(([_, s]) => s === 2)
        .map(([id]) => id);
      
      // Stickers I have repeated
      const myRepeated = Object.entries(myProgress.stickers)
        .filter(([_, s]) => s === 2)
        .map(([id]) => id);
      
      // They can give me if they have it repeated AND I don't have it (0 or undefined)
      const theyCanGiveMe = peerRepeated.some(id => (myProgress.stickers[id] || 0) === 0);
      // I can give them if I have it repeated AND they don't have it (0 or undefined)
      const iCanGiveThem = myRepeated.some(id => (peer.stickers[id] || 0) === 0);
      
      if (theyCanGiveMe || iCanGiveThem) {
        count++;
      }
    });
    return count;
  }, [myProgress, allProgress]);

  const stats = [
    { name: 'Completado', value: `${completionRate}%`, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { name: 'En Álbum', value: ownedCount, icon: Star, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'Repetidas', value: repeatedCount, icon: Repeat, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { name: 'Intercambios', value: matchesCount, icon: ArrowRightLeft, color: 'text-purple-500', bg: 'bg-purple-500/10', action: () => navigate('/market') },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden p-8 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-worldcup-green/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-worldcup-red/5 blur-[100px] -ml-32 -mb-32 rounded-full" />
        
        <div className="relative z-10 w-full md:w-auto">
          <div className="flex justify-between items-start">
            <WorldCupBall className="w-16 h-16 mb-4 shadow-2xl" animate />
            {!isStandalone && (
              <button 
                onClick={triggerInstall}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-transform"
              >
                <Download className="w-4 h-4" />
                Instalar App
              </button>
            )}
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
        {!isStandalone && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-2 lg:col-span-4 bg-gradient-to-br from-green-500 to-emerald-600 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group shadow-2xl shadow-green-500/20"
          >
            <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/20 blur-3xl rounded-full" />
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 rounded-3xl bg-white text-green-600 flex items-center justify-center flex-shrink-0 shadow-xl group-hover:rotate-12 transition-transform">
                <Download className="w-8 h-8" />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Descargar en el Teléfono</h3>
                <p className="text-white/80 font-medium">Instala la app para recibir notificaciones y entrar directo.</p>
              </div>
            </div>
            <button 
              onClick={triggerInstall}
              className="w-full md:w-auto px-10 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl relative z-10"
            >
              Instalar Ahora
            </button>
          </motion.div>
        )}
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
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
                stat.action && "cursor-pointer active:scale-95"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]" />
              
              <div className={cn("w-14 h-14 rounded-[1.25rem] flex items-center justify-center mb-6 shadow-2xl relative z-10", stat.bg)}>
                <Icon className={cn("w-7 h-7 group-hover:scale-110 transition-transform", stat.color)} />
              </div>
              
              <div className="relative z-10">
                <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">{stat.name}</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-black text-white italic">{stat.value}</p>
                  {stat.name === 'Repetidas' && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-tighter">Gold</span>}
                </div>
              </div>
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
    </div>
  );
}
