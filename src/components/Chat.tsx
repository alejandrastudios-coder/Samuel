import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, orderBy, addDoc, serverTimestamp, updateDoc, where, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Chat as ChatType, Message, AlbumProgress } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User as UserIcon, ArrowLeft, MoreVertical, ShieldCheck, LogOut, ArrowRightLeft, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { TEAMS, normalizeStickerId, RARITIES } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

export default function Chat({ userProfile }: { userProfile: UserProfile | null }) {
  const { t } = useLanguage();
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatType[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>({});
  const [text, setText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [myProgress, setMyProgress] = useState<AlbumProgress | null>(null);
  const [peerProgress, setPeerProgress] = useState<AlbumProgress | null>(null);
  const [showTradeInfo, setShowTradeInfo] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userProfile) return;

    let unsubChats: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubMyProgress: (() => void) | undefined;

    if (userProfile.status === 'approved' || userProfile.role === 'admin') {
      // Fetch all chats for user
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', userProfile.userId),
        orderBy('updatedAt', 'desc')
      );
      
      unsubChats = onSnapshot(q, (snap) => {
        const chatData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatType));
        // Filter out chats hidden by the current user
        setChats(chatData.filter(c => {
          const hiddenBy = c.hiddenBy || [];
          return !hiddenBy.includes(userProfile.userId);
        }));
      }, (error) => console.error("Error fetching chats:", error));

      // Fetch all users
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const usersMap: Record<string, UserProfile> = {};
        snap.docs.forEach(d => {
          usersMap[d.id] = d.data() as UserProfile;
        });
        setAllUsers(usersMap);
      }, (error) => console.error("Error fetching users:", error));

      // Fetch my progress
      unsubMyProgress = onSnapshot(doc(db, 'album_progress', userProfile.userId), (snap) => {
        if (snap.exists()) setMyProgress(snap.data() as AlbumProgress);
      }, (error) => console.error("Error fetching my progress:", error));
    }

    return () => {
      unsubChats?.();
      unsubUsers?.();
      unsubMyProgress?.();
    };
  }, [userProfile]);

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubMessages = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });

    return unsubMessages;
  }, [chatId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !chatId || !userProfile || !peerId) return;

    const msgText = text;
    setText('');

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: userProfile.userId,
        text: msgText,
        createdAt: serverTimestamp()
      });

      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      const chatData = chatSnap.data() as ChatType;
      const unreadCounts = chatData.unreadCounts || {};
      
      await updateDoc(chatRef, {
        lastMessage: msgText,
        updatedAt: serverTimestamp(),
        [`unreadCounts.${peerId}`]: (unreadCounts[peerId] || 0) + 1,
        // Reset my count just in case called while sending
        [`unreadCounts.${userProfile.userId}`]: 0
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const activeChat = chats.find(c => c.id === chatId);
  
  const peerId = useMemo(() => {
    if (activeChat) return activeChat.participants.find(p => p !== userProfile?.userId);
    if (chatId && userProfile) {
      const parts = chatId.split('_');
      return parts.find(p => p !== userProfile.userId);
    }
    return null;
  }, [activeChat, chatId, userProfile]);

  const peerUser = peerId ? allUsers[peerId] : null;

  // Reset unread count when chat is opened
  useEffect(() => {
    if (!chatId || !userProfile || !activeChat) return;
    
    const resetUnread = async () => {
      const counts = activeChat.unreadCounts || {};
      if ((counts[userProfile.userId] || 0) > 0) {
        await updateDoc(doc(db, 'chats', chatId), {
          [`unreadCounts.${userProfile.userId}`]: 0
        });
      }
    };
    
    resetUnread();
  }, [chatId, userProfile, activeChat?.unreadCounts?.[userProfile?.userId || '']]);

  const deleteChat = async (e: React.MouseEvent, chatIdToDelete: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userProfile) return;
    
    if (deleteConfirmId !== chatIdToDelete) {
      setDeleteConfirmId(chatIdToDelete);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeleteConfirmId(prev => prev === chatIdToDelete ? null : prev), 3000);
      return;
    }

    try {
      const chatRef = doc(db, 'chats', chatIdToDelete);
      const chatDoc = chats.find(c => c.id === chatIdToDelete);
      if (!chatDoc) return;
      
      const hiddenBy = chatDoc.hiddenBy || [];
      if (!hiddenBy.includes(userProfile.userId)) {
        await updateDoc(chatRef, {
          hiddenBy: [...hiddenBy, userProfile.userId]
        });
      }
      
      setDeleteConfirmId(null);
      if (chatId === chatIdToDelete) {
        navigate('/chat');
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  useEffect(() => {
    if (!peerId) {
      setPeerProgress(null);
      return;
    }
    setPeerProgress(null);
    const unsubPeerProgress = onSnapshot(doc(db, 'album_progress', peerId), (snap) => {
      if (snap.exists()) {
        setPeerProgress(snap.data() as AlbumProgress);
      } else {
        setPeerProgress({ userId: peerId, stickers: {} } as AlbumProgress);
      }
    });
    return unsubPeerProgress;
  }, [peerId]);

  const tradeInfo = useMemo(() => {
    // If we don't have my progress, we can't calculate anything
    if (!myProgress) return null;
    
    // If peer progress doesn't exist, assume they have 0 stickers
    const pStickers = peerProgress?.stickers || {};

    // Normalize my stickers: aggregate by normalized ID
    const myStickersNormalized: Record<string, number> = {};
    Object.entries(myProgress.stickers).forEach(([id, s]) => {
      const norm = normalizeStickerId(id);
      myStickersNormalized[norm] = Math.max(myStickersNormalized[norm] || 0, s);
    });

    // Normalize peer stickers: aggregate by normalized ID
    const peerStickersNormalized: Record<string, number> = {};
    Object.entries(pStickers).forEach(([id, s]) => {
      const norm = normalizeStickerId(id);
      peerStickersNormalized[norm] = Math.max(peerStickersNormalized[norm] || 0, s);
    });

    const iNeed = Object.entries(peerStickersNormalized)
      .filter(([normId, status]) => status >= 2 && (myStickersNormalized[normId] || 0) === 0)
      .map(([normId]) => {
        const [teamName, num] = normId.split('-');
        const label = teamName === 'UFW' ? 'FWC' : teamName;
        return { id: normId, label: `${label} ${num}` };
      });

    const theyNeed = Object.entries(myStickersNormalized)
      .filter(([normId, status]) => status >= 2 && (peerStickersNormalized[normId] || 0) === 0)
      .map(([normId]) => {
        const [teamName, num] = normId.split('-');
        const label = teamName === 'UFW' ? 'FWC' : teamName;
        return { id: normId, label: `${label} ${num}` };
      });

    return { iNeed, theyNeed };
  }, [myProgress, peerProgress]);

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Sidebar - Chat List */}
      <div className={cn(
        "w-full md:w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/30",
        chatId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <button 
               onClick={() => navigate('/')}
               className="md:hidden p-2 text-zinc-400 hover:text-white bg-zinc-800/50 rounded-xl"
             >
               <ArrowLeft className="w-5 h-5" />
             </button>
             <h2 className="text-xl font-bold text-white tracking-tight">{t('chat.title')}</h2>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map(chat => {
            const pId = chat.participants.find(p => p !== userProfile?.userId);
            const user = pId ? allUsers[pId] : null;
            const isActive = chat.id === chatId;
            return (
              <Link 
                key={chat.id} 
                to={`/chat/${chat.id}`}
                className={cn(
                  "flex items-center gap-4 p-4 transition-all hover:bg-zinc-800/50 group",
                  isActive && "bg-green-600/10 border-r-2 border-green-500"
                )}
              >
                <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-zinc-700">
                   {user?.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon className="text-zinc-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-bold text-white truncate">{user?.displayName || 'Usuario'}</h4>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-zinc-500">
                        {chat.updatedAt ? format(chat.updatedAt.toDate(), 'HH:mm') : ''}
                      </span>
                      {chat.unreadCounts?.[userProfile?.userId || ''] > 0 && (
                        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-black text-black">
                           {chat.unreadCounts[userProfile!.userId]}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-xs text-zinc-500 truncate flex-1">{chat.lastMessage}</p>
                    <button 
                      onClick={(e) => deleteChat(e, chat.id)}
                      className={cn(
                        "p-1.5 transition-all rounded-lg flex items-center gap-1",
                        deleteConfirmId === chat.id 
                          ? "bg-red-500 text-white animate-pulse px-2" 
                          : "text-zinc-600 hover:text-red-500 hover:bg-red-500/10 md:opacity-0 group-hover:opacity-100"
                      )}
                      title={deleteConfirmId === chat.id ? "Confirmar eliminar" : "Eliminar chat"}
                    >
                      {deleteConfirmId === chat.id ? (
                        <>
                          <Trash2 className="w-3 h-3" />
                          <span className="text-[10px] font-bold">BORRAR</span>
                        </>
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
          {chats.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">
              No tienes chats activos. Ve a Intercambios para empezar una charla.
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {chatId ? (
        <div className="flex-1 flex flex-col bg-zinc-950">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/chat')} 
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-zinc-800 rounded-xl overflow-hidden border border-zinc-800 shadow-sm">
                 {peerUser?.photoURL ? <img src={peerUser.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon className="text-zinc-500 p-2" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1">
                  {peerUser?.displayName}
                  {peerUser?.role === 'admin' && <ShieldCheck className="w-3 h-3 text-green-500" />}
                </h3>
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">En línea</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowTradeInfo(!showTradeInfo)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                  showTradeInfo ? "bg-green-600 text-white border-green-500" : "bg-zinc-800 text-zinc-400 border-zinc-700"
                )}
              >
                <ArrowRightLeft className="w-3 h-3" />
                Negociación
                {showTradeInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 transition-transform" />}
              </button>
              <button className="text-zinc-500 hover:text-white p-2">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showTradeInfo && tradeInfo && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-zinc-950 border-b border-zinc-800"
              >
                 <div className="p-4 flex flex-col gap-4 max-w-4xl mx-auto">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <div className="flex items-center gap-2 text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Lo que tú le puedes dar:
                       </div>
                       <div className="flex flex-wrap gap-1.5">
                         {tradeInfo.theyNeed.length > 0 ? tradeInfo.theyNeed.map(item => (
                           <span key={item.id} className="px-2.5 py-1 bg-zinc-900 border border-zinc-700/50 rounded-lg text-[10px] font-bold text-zinc-200">
                             {item.label}
                           </span>
                         )) : <span className="text-[10px] text-zinc-600 italic">No tienes repetidas que necesite</span>}
                       </div>
                     </div>
                     <div className="space-y-2 border-l border-zinc-800 pl-4">
                       <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Lo que tiene para ti:
                       </div>
                       <div className="flex flex-wrap gap-1.5">
                         {tradeInfo.iNeed.length > 0 ? tradeInfo.iNeed.map(item => (
                           <span key={item.id} className="px-2.5 py-1 bg-zinc-900 border border-zinc-700/50 rounded-lg text-[10px] font-bold text-zinc-200">
                             {item.label}
                           </span>
                         )) : <span className="text-[10px] text-zinc-600 italic">No tiene repetidas que te falten</span>}
                       </div>
                     </div>
                   </div>

                   {(tradeInfo.iNeed.length > 0 || tradeInfo.theyNeed.length > 0) && (
                     <button 
                       onClick={async () => {
                         const userRarity = userProfile?.rarity || 'cualquier';
                         const rarityData = RARITIES.find(r => r.id === userRarity);
                         const userRarityName = rarityData ? rarityData.name : 'Cualquier color';

                         const peerRarity = peerUser?.rarity || 'cualquier';
                         const rData = RARITIES.find(r => r.id === peerRarity);
                         const peerRarityName = rData ? rData.name : 'Cualquier color';

                         let t = `¡Hola! He revisado nuestras coincidencias.\n\nYo estoy coleccionando el álbum en rareza ${userRarityName.toUpperCase()}.\n¿Tú también lo haces en rareza ${peerRarityName.toUpperCase()}?\n\n`;
                         if (tradeInfo.theyNeed.length > 0) {
                           t += `👉 Te puedo dar: ${tradeInfo.theyNeed.slice(0, 5).map(i => i.label).join(', ')}${tradeInfo.theyNeed.length > 5 ? '...' : ''}\n`;
                         }
                         if (tradeInfo.iNeed.length > 0) {
                           t += `👈 Me interesan: ${tradeInfo.iNeed.slice(0, 5).map(i => i.label).join(', ')}${tradeInfo.iNeed.length > 5 ? '...' : ''}\n`;
                         }
                         t += "\n¿Te interesa cambiar?";
                         
                         await addDoc(collection(db, 'chats', chatId!, 'messages'), {
                           senderId: userProfile?.userId,
                           text: t,
                           createdAt: serverTimestamp()
                         });
                         
                         await updateDoc(doc(db, 'chats', chatId!), {
                           lastMessage: "Propuesta de intercambio enviada",
                           updatedAt: serverTimestamp()
                         });
                         setShowTradeInfo(false);
                       }}
                       className="w-full py-2 bg-green-600/10 text-green-500 border border-green-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all"
                     >
                       Enviar propuesta automática
                     </button>
                   )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-dots">
            {messages.map((msg, idx) => {
              const isMine = msg.senderId === userProfile?.userId;
              return (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.95, x: isMine ? 20 : -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  className={cn("flex", isMine ? "justify-end" : "justify-start")}
                >
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                    isMine 
                      ? "bg-green-600 text-white rounded-tr-none" 
                      : "bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none"
                  )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    <div className={cn(
                      "text-[10px] mt-1 text-right",
                      isMine ? "text-green-100/70" : "text-zinc-500"
                    )}>
                      {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : '...'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-4 bg-zinc-900/50 border-t border-zinc-800">
             <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
               <input 
                 value={text}
                 onChange={(e) => setText(e.target.value)}
                 placeholder="Escribe un mensaje..."
                 className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-6 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-zinc-600"
               />
               <button 
                type="submit"
                disabled={!text.trim()}
                className="bg-green-600 text-white p-3 rounded-2xl hover:bg-green-500 disabled:opacity-50 disabled:grayscale transition-all active:scale-95 shadow-lg shadow-green-600/20"
               >
                 <Send className="w-5 h-5" />
               </button>
             </form>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-zinc-950 relative overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-green-500/5 blur-[100px] rounded-full" />
           <div className="text-center z-10">
              <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl border border-zinc-800">
                <MessageSquare className="w-10 h-10 text-zinc-700" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Selecciona un chat</h3>
              <p className="text-zinc-500 max-w-xs mx-auto">Selecciona una conversación del lateral o inicia una desde el Market.</p>
           </div>
        </div>
      )}
    </div>
  );
}

const MessageSquare = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
