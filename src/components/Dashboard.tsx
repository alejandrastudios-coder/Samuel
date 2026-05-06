import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AlbumProgress } from '../types';
import { TEAMS, STICKERS_PER_TEAM, PRIZES_COUNT, COCA_COLA_COUNT } from '../constants';
import { motion } from 'motion/react';
import { Trophy, Users, Star, BarChart3, TrendingUp, Clock, Repeat, CheckCircle2, MessageCircle, LogOut, ShieldCheck, ArrowRightLeft } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Dashboard({ userProfile }: { userProfile: UserProfile | null }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<AlbumProgress | null>(null);

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
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">¡Hola, {userProfile?.displayName}!</h2>
          <p className="text-zinc-400 mt-1">Aquí tienes un resumen de tu colección mundialista.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div 
              key={stat.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => stat.action?.()}
              className={cn(
                "bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] hover:border-zinc-700 transition-all",
                stat.action && "cursor-pointer hover:bg-zinc-800/50 active:scale-95"
              )}
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm", stat.bg)}>
                <Icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <p className="text-zinc-400 text-sm font-medium">{stat.name}</p>
              <p className="text-3xl font-black text-white mt-1">{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Progress Bar and Details */}
        <section className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl rounded-full" />
          <h3 className="text-xl font-bold text-white mb-6">Estado General</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-sm text-zinc-400 font-medium">Progreso del Álbum</span>
              <span className="text-2xl font-black text-green-500">{completionRate}%</span>
            </div>
            <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-green-600 to-green-400 shadow-[0_0_10px_rgba(22,163,74,0.4)]"
              />
            </div>
            <p className="text-sm text-zinc-500 pt-2">
              Te faltan <span className="text-white font-bold">{missingCount}</span> estampas para completar la gloria eterna.
            </p>
          </div>
        </section>

        {/* Recent Activity or Quick Tips */}
        <section className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem]">
          <h3 className="text-xl font-bold text-white mb-6">Próximos Pasos</h3>
          <ul className="space-y-4">
            {[
              { text: 'Busca intercambios en el Market', icon: Repeat },
              { text: 'Marca tus nuevas estampas', icon: CheckCircle2 },
              { text: 'Habla con otros coleccionistas', icon: MessageCircle },
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-zinc-800/50 hover:bg-zinc-800/50 transition-colors">
                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="text-sm font-medium text-zinc-300">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
);
const MessageCircle = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
);
