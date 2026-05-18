import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, orderBy, addDoc, serverTimestamp, updateDoc, where, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Chat as ChatType, Message, AlbumProgress } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User as UserIcon, ArrowLeft, MoreVertical, ShieldCheck, LogOut, ArrowRightLeft, ChevronDown, ChevronUp, Trash2, Check, X, Zap, Sparkles, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { TEAMS, normalizeStickerId, RARITIES, FWC_COUNT, COCA_COLA_COUNT, STICKERS_PER_TEAM } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { TranslatedMessage } from './TranslatedMessage';

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
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [selectedToGive, setSelectedToGive] = useState<string[]>([]);
  const [selectedToReceive, setSelectedToReceive] = useState<string[]>([]);
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
        // Filter out chats hidden by the current user OR not in the same circle
        setChats(chatData.filter(c => {
          const hiddenBy = c.hiddenBy || [];
          if (hiddenBy.includes(userProfile.userId)) return false;

          // --- EXCLUSIVE CIRCLE CHECK ---
          const pId = c.participants.find(p => p !== userProfile.userId);
          const peer = pId ? allUsers[pId] : null;
          
          if (!peer) return true; // Keep while loading users
          
          // Compatibilidad: Mismo país y al menos 1 grupo compartido
          const sameCountry = userProfile.residingCountry === peer.residingCountry;
          const sharedGroups = userProfile.groupIds?.filter(gid => peer.groupIds?.includes(gid)) || [];
          
          return sameCountry && sharedGroups.length > 0;
        }));
      }, (error) => {
        console.error("Error fetching chats in Chat component:", error);
      });

      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const usersMap: Record<string, UserProfile> = {};
        snap.docs.forEach(d => {
          usersMap[d.id] = d.data() as UserProfile;
        });
        setAllUsers(usersMap);
      }, (error) => {
        console.error("Error fetching users in Chat component:", error);
      });

      unsubMyProgress = onSnapshot(doc(db, 'album_progress', userProfile.userId), (snap) => {
        if (snap.exists()) setMyProgress(snap.data() as AlbumProgress);
      }, (error) => {
        console.error("Error fetching my progress in Chat component:", error);
      });
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
    }, (error) => {
      console.error("Error watching messages in Chat component:", error);
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
    }, (error) => {
      console.error("Error watching peer progress in Chat component:", error);
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

  const getStickerImpact = (stickerId: string) => {
    if (!myProgress) return null;
    const normId = normalizeStickerId(stickerId);
    if ((myProgress.stickers[normId] || 0) === 0) {
      // Check if this sticker completes a team
      const [teamName] = normId.split('-');
      const teamStickers = Object.keys(myProgress.stickers).filter(id => id.startsWith(teamName));
      const stickersPerTeam = teamName === 'FWC' ? FWC_COUNT : (teamName === 'CC' ? COCA_COLA_COUNT : STICKERS_PER_TEAM);
      
      if (teamStickers.length === stickersPerTeam - 1) {
        return 'complete';
      }
      return 'new';
    }
    return null;
  };

  const handleToggleGive = (id: string) => {
    setSelectedToGive(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleReceive = (id: string) => {
    setSelectedToReceive(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCompleteExchange = async () => {
    if (!userProfile || !chatId || !peerId || (selectedToGive.length === 0 && selectedToReceive.length === 0)) return;

    try {
      // 1. Send special message
      const tradeMsg = {
        senderId: userProfile.userId,
        text: `${t('chat.trade_completed_msg')}\n\n📤 ${t('market.gave')}: ${selectedToGive.map(id => tradeInfo?.theyNeed.find(t => t.id === id)?.label || id).join(', ')}\n📥 ${t('market.received')}: ${selectedToReceive.map(id => tradeInfo?.iNeed.find(t => t.id === id)?.label || id).join(', ')}`,
        createdAt: serverTimestamp(),
        tradeData: {
          gave: selectedToGive,
          received: selectedToReceive,
          appliedBy: [userProfile.userId]
        }
      };

      await addDoc(collection(db, 'chats', chatId, 'messages'), tradeMsg);

      // 2. Update my album progress
      const currentStickers = { ...myProgress?.stickers };
      
      selectedToGive.forEach(id => {
        currentStickers[id] = Math.max(0, (currentStickers[id] || 0) - 1);
      });
      
      selectedToReceive.forEach(id => {
        currentStickers[id] = (currentStickers[id] || 0) + 1;
      });

      await updateDoc(doc(db, 'album_progress', userProfile.userId), {
        stickers: currentStickers,
        updatedAt: serverTimestamp()
      });

      // 3. Update chat last message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: t('chat.trade_completed_summary'),
        updatedAt: serverTimestamp()
      });

      // Clear selection and hide info
      setSelectedToGive([]);
      setSelectedToReceive([]);
      setIsNegotiating(false);
    } catch (err) {
      console.error("Error completing exchange:", err);
    }
  };

  const handleSyncMessageTrade = async (msg: Message) => {
    if (!userProfile || !msg.tradeData || msg.tradeData.appliedBy?.includes(userProfile.userId)) return;

    try {
      const currentStickers = { ...myProgress?.stickers };
      
      // If I am NOT the sender, I should RECEIVE what they GAVE, and GIVE what they RECEIVED
      const isSender = msg.senderId === userProfile.userId;
      const toReceive = isSender ? msg.tradeData.received : msg.tradeData.gave;
      const toGive = isSender ? msg.tradeData.gave : msg.tradeData.received;

      toGive.forEach(id => {
        currentStickers[id] = Math.max(0, (currentStickers[id] || 0) - 1);
      });
      
      toReceive.forEach(id => {
        currentStickers[id] = (currentStickers[id] || 0) + 1;
      });

      await updateDoc(doc(db, 'album_progress', userProfile.userId), {
        stickers: currentStickers,
        updatedAt: serverTimestamp()
      });

      // Mark message as applied by me
      const applied = [...(msg.tradeData.appliedBy || []), userProfile.userId];
      await updateDoc(doc(db, 'chats', chatId!, 'messages', msg.id), {
        'tradeData.appliedBy': applied
      });
    } catch (err) {
      console.error("Error syncing trade from message:", err);
    }
  };

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
                    <h4 className="text-sm font-bold text-white truncate">{user?.displayName || (t('admin.users').slice(0,-1))}</h4>
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
                      title={deleteConfirmId === chat.id ? t('chat.confirm_delete') : t('chat.delete_chat')}
                    >
                      {deleteConfirmId === chat.id ? (
                        <>
                          <Trash2 className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase">{t('admin.delete')}</span>
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
              {t('chat.no_chats')}
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
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{t('chat.online')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsNegotiating(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white text-black hover:bg-green-400 transition-all shadow-xl shadow-white/5 active:scale-95"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {t('chat.negotiate_btn')}
              </button>
              <button className="text-zinc-500 hover:text-white p-2">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 flex flex-col min-h-0 bg-dots">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
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
                      : (msg.tradeData ? "bg-zinc-950 border-2 border-green-500/50 text-white rounded-tl-none ring-4 ring-green-500/5 shadow-2xl" : "bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none")
                  )}>
                    <TranslatedMessage 
                      text={msg.text} 
                      senderId={msg.senderId} 
                      currentUserId={userProfile?.userId} 
                    />
                    
                    {msg.tradeData && (
                      <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-300">
                          <Check className="w-3 h-3" />
                          {t('chat.trade_verification')}
                        </div>
                        
                        {msg.tradeData.appliedBy?.includes(userProfile?.userId || '') ? (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-green-400 bg-green-500/10 px-3 py-2 rounded-xl border border-green-500/20">
                            <Check className="w-3 h-3" />
                            {t('chat.album_synced')}
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleSyncMessageTrade(msg)}
                            className="w-full py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-400 transition-all active:scale-95 shadow-lg group-hover:scale-105"
                          >
                            {t('chat.sync_my_album')}
                          </button>
                        )}
                      </div>
                    )}

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
          </div>

          <AnimatePresence>
            {isNegotiating && tradeInfo && (
              <motion.div 
                initial={{ opacity: 0, scale: 1.1, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="absolute inset-0 z-50 bg-zinc-950 flex flex-col"
              >
                {/* Trading Zone Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                      <ArrowRightLeft className="text-black w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight uppercase">{t('chat.trading_zone')}</h2>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
                        {t('chat.negotiating_with')} <span className="text-green-500">{peerUser?.displayName}</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsNegotiating(false)}
                    className="p-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-2xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Main Interaction Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 pb-32">
                  
                  {/* YOU GIVE SECTION */}
                  <section className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-500/10 rounded-xl">
                          <Zap className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white uppercase tracking-tight">
                            {t('chat.your_offering_to')} <span className="text-green-500">{peerUser?.displayName}</span>
                          </h3>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('chat.select_stickers_to_give')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('chat.selected')}:</span>
                        <span className="text-sm font-black text-green-500">{selectedToGive.length}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {tradeInfo.theyNeed.length > 0 ? tradeInfo.theyNeed.map(sticker => (
                        <TradeSlot 
                          key={sticker.id} 
                          sticker={sticker} 
                          isSelected={selectedToGive.includes(sticker.id)}
                          onToggle={() => handleToggleGive(sticker.id)}
                          type="give"
                        />
                      )) : (
                        <div className="py-12 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
                          <p className="text-zinc-500 font-bold italic text-sm">{t('chat.no_repeats_peer')}</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* YOU RECEIVE SECTION */}
                  <section className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/10 rounded-xl">
                          <Trophy className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white uppercase tracking-tight">
                            {t('chat.receiving_from')} <span className="text-amber-500">{peerUser?.displayName}</span>
                          </h3>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('chat.select_stickers_to_receive')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('chat.selected')}:</span>
                        <span className="text-sm font-black text-amber-500">{selectedToReceive.length}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {tradeInfo.iNeed.length > 0 ? tradeInfo.iNeed.map(sticker => (
                        <TradeSlot 
                          key={sticker.id} 
                          sticker={sticker} 
                          isSelected={selectedToReceive.includes(sticker.id)}
                          onToggle={() => handleToggleReceive(sticker.id)}
                          type="receive"
                          impact={getStickerImpact(sticker.id)}
                        />
                      )) : (
                        <div className="py-12 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
                          <p className="text-zinc-500 font-bold italic text-sm">{t('chat.no_missing_peer')}</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>


                {/* Final Confirmation Floating Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-8 pt-12 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent pointer-events-none">
                  <div className="max-w-4xl mx-auto flex items-center gap-4 pointer-events-auto">
                    <button 
                      onClick={() => setIsNegotiating(false)}
                      className="px-8 py-4 bg-zinc-900 text-zinc-400 font-bold rounded-2xl border border-zinc-800 hover:text-white transition-all active:scale-95 text-xs uppercase"
                    >
                      {t('chat.cancel_negotiation')}
                    </button>
                    {(selectedToGive.length > 0 || selectedToReceive.length > 0) && (
                      <motion.button 
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        onClick={handleCompleteExchange}
                        className="flex-1 py-4 bg-green-500 text-black rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-green-400 transition-all shadow-2xl shadow-green-500/30 flex items-center justify-center gap-3 relative overflow-hidden group"
                      >
                         <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                         <ArrowRightLeft className="w-5 h-5" />
                         {t('chat.confirm_exchange')}
                         <div className="px-3 py-1 bg-black/10 rounded-full text-[10px]">
                           {selectedToGive.length + selectedToReceive.length}
                         </div>
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="p-4 bg-zinc-900/50 border-t border-zinc-800">
             <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
               <input 
                 value={text}
                 onChange={(e) => setText(e.target.value)}
                 placeholder={t('chat.type_message')}
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
              <h3 className="text-2xl font-bold text-white mb-2">{t('chat.select_chat')}</h3>
              <p className="text-zinc-500 max-w-xs mx-auto">{t('chat.select_chat_desc')}</p>
           </div>
        </div>
      )}
    </div>
  );
}

const MessageSquare = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);

const TradeSlot = ({ sticker, isSelected, onToggle, type, impact }: any) => {
  const { t } = useLanguage();
  
  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onToggle}
      className={cn(
        "w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all duration-200 overflow-hidden",
        isSelected 
          ? (type === 'give' 
              ? "bg-green-600 border-green-400 text-white shadow-lg shadow-green-900/20" 
              : "bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-900/20")
          : "bg-zinc-900/40 border-zinc-800/80 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-900"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-9 h-9 flex items-center justify-center rounded-lg font-black text-xs border transition-colors",
          isSelected 
            ? "bg-white/10 border-white/20" 
            : "bg-zinc-950 border-zinc-800"
        )}>
          {isSelected ? (
            <Check className={cn("w-5 h-5", type === 'give' ? "text-white" : "text-black")} />
          ) : (
            type === 'give' ? <Zap className="w-4 h-4 text-green-500" /> : <Trophy className="w-4 h-4 text-amber-500" />
          )}
        </div>
        
        <div className="flex flex-col items-start px-1">
          <div className="text-sm font-bold tracking-tight uppercase">
            {sticker.label}
          </div>
          {impact && !isSelected && (
            <div className="text-[7px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1 mt-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              {impact === 'new' ? t('chat.impact_new') : t('chat.impact_complete')}
            </div>
          )}
        </div>
      </div>

      {isSelected && (
        <div className={cn(
          "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border bg-white/20 border-white/10 shrink-0 ml-2",
          type === 'give' ? "text-white" : "text-black/60"
        )}>
          {t('chat.selected')}
        </div>
      )}
    </motion.button>
  );
};
