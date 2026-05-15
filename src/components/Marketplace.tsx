import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, setDoc, addDoc, serverTimestamp, where, getDocs, or, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, AlbumProgress, Chat, UserGroup } from '../types';
import { TEAMS, normalizeStickerId } from '../constants';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, MapPin, MessageSquare, Repeat, User as UserIcon, ArrowRightLeft, ArrowLeft, LogOut, Tag } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

export default function Marketplace({ userProfile }: { userProfile: UserProfile | null }) {
  const { t } = useLanguage();
  const [allProgress, setAllProgress] = useState<AlbumProgress[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>({});
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'groups'), (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserGroup)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userProfile) return;

    let unsubProgress: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;

    if (userProfile.status === 'approved' || userProfile.role === 'admin') {
      // 1. Fetch all progress
      unsubProgress = onSnapshot(
        collection(db, 'album_progress'), 
        (snap) => {
          const data = snap.docs.map(d => ({
            userId: d.id, // Ensure we use the document ID as userId
            ...d.data()
          } as AlbumProgress));
          setAllProgress(data.filter(p => p.userId !== userProfile.userId));
        },
        (error) => console.error("Error fetching progress:", error)
      );

      // 2. Fetch all users
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
      unsubProgress?.();
      unsubUsers?.();
    };
  }, [userProfile]);

  const [myProgress, setMyProgress] = useState<AlbumProgress | null>(null);
  useEffect(() => {
    if (userProfile) {
      const unsub = onSnapshot(
        doc(db, 'album_progress', userProfile.userId), 
        (doc) => {
          if (doc.exists()) setMyProgress(doc.data() as AlbumProgress);
        },
        (error) => console.error("Error fetching my progress:", error)
      );
      return unsub;
    }
  }, [userProfile]);

  const matches = React.useMemo(() => {
    return allProgress.map(p => {
      const peerUser = allUsers[p.userId];
      if (!peerUser || peerUser.status !== 'approved') return null;

      // --- EXCLUSIVE CIRCLE LOGIC ---
      const sameCountry = userProfile.residingCountry === peerUser.residingCountry;
      const sharedGroups = userProfile.groupIds?.filter(gid => peerUser.groupIds?.includes(gid)) || [];
      const isCompatible = sameCountry && sharedGroups.length > 0;

      if (!isCompatible) return null;

      // Aggregate my stickers
      const myStickersNormalized: Record<string, number> = {};
      Object.entries(myProgress?.stickers || {}).forEach(([id, s]) => {
        const norm = normalizeStickerId(id);
        myStickersNormalized[norm] = (myStickersNormalized[norm] || 0) + s;
      });

      // Aggregate peer stickers
      const peerStickersNormalized: Record<string, number> = {};
      Object.entries(p.stickers).forEach(([id, s]) => {
        const norm = normalizeStickerId(id);
        peerStickersNormalized[norm] = (peerStickersNormalized[norm] || 0) + s;
      });

      const peerRepeated = Object.entries(peerStickersNormalized)
        .filter(([_, s]) => s > 1)
        .map(([id]) => id);

      const myRepeated = Object.entries(myStickersNormalized)
        .filter(([_, s]) => s > 1)
        .map(([id]) => id);

      const theyCanGiveMe = peerRepeated.filter(id => (myStickersNormalized[id] || 0) === 0);
      const iCanGiveThem = myRepeated.filter(id => (peerStickersNormalized[id] || 0) === 0);

      if (theyCanGiveMe.length === 0 && iCanGiveThem.length === 0) return null;

      const getLabel = (id: string) => {
        const [teamName, num] = id.split('-');
        let label = teamName;
        if (teamName === 'FWC' || teamName === 'UFW') label = 'FWC';
        if (teamName === 'CC' || teamName === 'COCA-COLA') label = 'Coca Cola';
        return `${label} ${num}`;
      };

      return {
        userId: p.userId,
        user: peerUser,
        iNeed: theyCanGiveMe,
        theyNeed: iCanGiveThem,
        sharedGroups,
        getLabel
      };
    }).filter((m): m is any => m !== null);
  }, [allProgress, allUsers, myProgress]);

  const filteredMatches = React.useMemo(() => {
    if (!search.trim()) return matches;
    
    const terms = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(Boolean);
    
    return matches.filter(match => {
      // Filter by collector name
      const userName = match.user.displayName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const matchesUserName = terms.every(term => userName.includes(term));
      if (matchesUserName) return true;

      // Filter by stickers (team + number)
      const allStickers = [...match.iNeed, ...match.theyNeed];
      const labels = allStickers.map(id => match.getLabel(id).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      
      // Check if any single sticker matches all search terms (e.g. "ARG" and "5")
      return labels.some(label => {
        return terms.every(term => label.includes(term));
      });
    });
  }, [matches, search]);

  const startChat = async (peerUserId: string) => {
    if (!userProfile) return;
    const participants = [userProfile.userId, peerUserId].sort();
    const chatId = participants.join('_');
    
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      
      if (!chatSnap.exists()) {
        const initialMessage = '¡Hola! He visto tus repetidas en el Market y me interesan.';
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
        // If it exists, make sure it's not hidden for me
        const data = chatSnap.data() as Chat;
        const hiddenBy = data.hiddenBy || [];
        if (hiddenBy.includes(userProfile.userId)) {
          await updateDoc(chatRef, {
            hiddenBy: hiddenBy.filter(id => id !== userProfile.userId)
          });
        }
      }
      
      navigate(`/chat/${chatId}`);
    } catch (error) {
      console.error("Error starting chat:", error);
      alert("Error al iniciar el chat. Por favor intenta de nuevo.");
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-white tracking-tight italic uppercase">{t('market.title')}</h2>
          <p className="text-zinc-400 mt-1">{t('market.matches')}</p>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input 
          type="text"
          placeholder="Buscar por coleccionista, equipo o número (ej: ARG 10)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all font-medium"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMatches.length > 0 ? filteredMatches.map((match: any) => (
          <motion.div 
            key={match.userId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-6 hover:border-green-500/30 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden border border-zinc-700">
                  {match.user.photoURL ? (
                    <img src={match.user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="text-zinc-500 w-8 h-8" />
                  )}
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">{match.user.displayName}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {match.user.residingCountry && (
                      <div className="flex items-center gap-1 text-zinc-500 text-[10px] uppercase font-black tracking-tight" title="Mismo país">
                        <MapPin className="w-3 h-3 text-worldcup-red" />
                        <span>{match.user.residingCountry}</span>
                      </div>
                    )}
                    {match.sharedGroups?.map((gid: string) => {
                      const group = groups.find(g => g.id === gid);
                      if (!group) return null;
                      return (
                        <div 
                          key={gid} 
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-[8px] font-black uppercase italic text-green-500"
                          title={`Sector compartido: ${group.name}`}
                        >
                          <Tag className="w-2 h-2" />
                          {group.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => startChat(match.userId)}
                className="bg-white text-black p-3 rounded-2xl hover:bg-green-500 hover:text-white transition-all active:scale-95 shadow-lg shadow-white/5"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ArrowRightLeft className="w-3 h-3" /> Tiene para ti
                </p>
                <div className="flex flex-wrap gap-2">
                  {match.iNeed.slice(0, 5).map((id: string) => (
                    <span key={id} className="text-[10px] font-bold px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md border border-zinc-700">
                      {match.getLabel(id)}
                    </span>
                  ))}
                  {match.iNeed.length > 5 && (
                    <span className="text-[10px] font-bold px-2 py-1 text-zinc-600">+{match.iNeed.length - 5}</span>
                  )}
                </div>
              </div>
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <Repeat className="w-3 h-3" /> Tú tienes para él
                </p>
                <div className="flex flex-wrap gap-2">
                  {match.theyNeed.slice(0, 5).map((id: string) => (
                    <span key={id} className="text-[10px] font-bold px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md border border-zinc-700">
                      {match.getLabel(id)}
                    </span>
                  ))}
                   {match.theyNeed.length > 5 && (
                    <span className="text-[10px] font-bold px-2 py-1 text-zinc-600">+{match.theyNeed.length - 5}</span>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => startChat(match.userId)}
              className="w-full py-4 bg-gradient-to-r from-worldcup-red to-worldcup-red/80 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-worldcup-red/20 active:scale-95 transition-all hover:brightness-110 flex items-center justify-center gap-3 mt-2"
            >
              <MessageSquare className="w-4 h-4" />
              Negociar Intercambio
            </button>
          </motion.div>
        )) : (
          <div className="col-span-2 text-center py-20 bg-zinc-900 shadow-inner rounded-[3rem] border border-zinc-800 border-dashed">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sin coincidencias exactas</h3>
            <p className="text-zinc-500 max-w-sm mx-auto">
              Sigue completando tu álbum. Aparecerán usuarios cuando tengan repetidas las que te faltan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
