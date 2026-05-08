/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from './lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  BookText, 
  Repeat, 
  MessageCircle, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X, 
  Trophy,
  Users,
  Settings,
  Bell,
  Search,
  CheckCircle2,
  Lock,
  User as UserIcon,
  UserPlus,
  ArrowLeft,
  Clock,
  Download
} from 'lucide-react';
import { cn } from './lib/utils';
import { UserProfile, AlbumProgress } from './types';

import { WorldCupBall } from './components/ui/WorldCupBall';
import { InstallPrompt } from './components/ui/InstallPrompt';

// Components
import Dashboard from './components/Dashboard';
import Album from './components/Album';
import Marketplace from './components/Marketplace';
import Chat from './components/Chat';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';

function TopNav({ userProfile, onSignOut }: { userProfile: UserProfile | null, onSignOut: () => void }) {
  const location = useLocation();
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const checkInstallable = () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
      if (isIOS && !isStandalone) setIsInstallable(true);
    };
    checkInstallable();
    const handler = (e: any) => {
      e.preventDefault();
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = () => {
    window.dispatchEvent(new CustomEvent('trigger-install-prompt'));
  };

  const menuItems = [
    { name: 'Inicio', icon: LayoutDashboard, path: '/' },
    { name: 'Álbum', icon: BookText, path: '/album' },
    { name: 'Mercado', icon: Repeat, path: '/market' },
    { name: 'Chat', icon: MessageCircle, path: '/chat' },
  ];

  if (userProfile?.role === 'admin') {
    menuItems.push({ name: 'Admin', icon: ShieldCheck, path: '/admin' });
  }

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 z-50 px-4 md:px-8",
      "pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]"
    )}>
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <WorldCupBall className="w-10 h-10" />
            <span className="hidden sm:inline font-black text-sm tracking-tighter uppercase text-white">Mi Álbum <span className="text-worldcup-green">26</span></span>
          </Link>
          
          <nav className="flex items-center gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl transition-all flex-shrink-0",
                    isActive 
                      ? "bg-green-600/10 text-green-500" 
                      : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-bold hidden md:inline">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {isInstallable && (
            <button 
              onClick={triggerInstall}
              className="flex items-center gap-2 px-3 py-2 bg-green-600/10 text-green-500 rounded-xl font-bold hover:bg-green-600/20 transition-all border border-green-500/20"
            >
              <Download className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-wider hidden xs:inline">Instalar</span>
            </button>
          )}
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1.5 md:px-3 md:py-2">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center border border-zinc-700/50">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 md:w-5 md:h-5 text-zinc-600" />
              )}
            </div>
            <div className="hidden xs:block min-w-0">
              <p className="text-[10px] md:text-xs font-black text-white truncate max-w-[80px] uppercase tracking-tighter">
                {userProfile?.displayName?.split(' ')[0]}
              </p>
              <p className="text-[8px] text-zinc-500 font-bold tracking-widest leading-none mt-0.5">ESTADO: {userProfile?.status}</p>
            </div>
          </div>
          <button 
            onClick={onSignOut}
            className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
            title="Sali"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}


function AuthGuard({ children, userProfile, profileLoading, logout }: { children: React.ReactNode, userProfile: UserProfile | null, profileLoading: boolean, logout: () => void }) {
  const [user, loading] = useAuthState(auth);

  if (loading || profileLoading) return (
    <div className="h-screen w-full flex items-center justify-center bg-zinc-950">
       <WorldCupBall className="w-20 h-20" animate />
    </div>
  );

  if (!user) return <Navigate to="/login" />;

  // Wait for profile if we are logged in
  if (!userProfile) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 p-6">
         <div className="max-w-md w-full glass-panel p-10 rounded-[2.5rem] flex flex-col items-center gap-6 text-center">
           <WorldCupBall className="w-16 h-16" animate />
           <div>
             <h2 className="text-2xl font-black text-white mb-2">PERFIL NO ENCONTRADO</h2>
             <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">No pudimos cargar tus datos de usuario.</p>
           </div>
           <button 
             onClick={logout}
             className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl font-bold hover:bg-red-500/20 transition-all uppercase tracking-widest mt-4"
           >
             Regresar al Login
           </button>
         </div>
      </div>
    );
  }

  if (userProfile.status !== 'approved' && userProfile.role !== 'admin') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-10 rounded-[2.5rem] shadow-2xl text-center">
          <Clock className="w-20 h-20 text-amber-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">Acceso Pendiente</h2>
          <p className="text-zinc-400 mb-8 text-lg">
            Tu cuenta ha sido registrada con éxito, pero un administrador debe aprobar tu acceso. Por favor, vuelve más tarde.
          </p>
          <button 
            onClick={logout}
            className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-bold hover:bg-zinc-700 transition-colors uppercase tracking-widest"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  const [user] = useAuthState(auth);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (user && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [user]);

  // Notification sound helper
  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Autoplay prevented or sound error:', e));
    } catch (err) {
      console.error('Error playing sound:', err);
    }
  };

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Badge API Logic: Update icon badge based on unread messages
  useEffect(() => {
    let lastUnreadCount = 0;
    
    if (user) {
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        let unreadTotal = 0;
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.lastMessageBy && data.lastMessageBy !== user.uid && data.unreadCount?.[user.uid]) {
            unreadTotal += data.unreadCount[user.uid];
          }
        });

        // Update badge
        if ('setAppBadge' in navigator) {
          if (unreadTotal > 0) {
            (navigator as any).setAppBadge(unreadTotal).catch(console.error);
          } else {
            (navigator as any).clearAppBadge().catch(console.error);
          }
        }

        // Notify app components
        window.dispatchEvent(new CustomEvent('unread-total-changed', { detail: unreadTotal }));

        // Play sound and show system notification if unread count increased
        if (unreadTotal > lastUnreadCount) {
          playNotificationSound();
          
          if (Notification.permission === 'granted') {
            new Notification('Stickers 2026', {
              body: unreadTotal === 1 ? 'Tienes 1 mensaje nuevo' : `Tienes ${unreadTotal} mensajes nuevos`,
              icon: 'https://cdn-icons-png.flaticon.com/512/1165/1165187.png',
              tag: 'new-message', // Prevents flooding
              renotify: true
            } as any);
          }
        }
        lastUnreadCount = unreadTotal;
      });
      
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setProfileLoading(true);
      const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          setUserProfile(doc.data() as UserProfile);
        } else {
          setUserProfile(null);
        }
        setProfileLoading(false);
      }, (error) => {
        console.error("Error loading profile:", error);
        setProfileLoading(false);
      });
      return () => unsub();
    } else {
      setUserProfile(null);
      setProfileLoading(false);
    }
  }, [user]);

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <BrowserRouter>
      <div className="min-h-[100dvh] bg-zinc-950 text-white font-sans selection:bg-green-500/30 selection:text-green-500 flex flex-col">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <AuthGuard userProfile={userProfile} profileLoading={profileLoading} logout={handleLogout}>
              <TopNav userProfile={userProfile} onSignOut={handleLogout} />
              <main className="flex-1 overflow-y-auto pt-[calc(4rem+env(safe-area-inset-top))] h-[100dvh]">
                <div className="max-w-7xl mx-auto p-4 md:p-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                   <Routes>
                      <Route path="/" element={<Dashboard userProfile={userProfile} />} />
                      <Route path="/album" element={<Album userProfile={userProfile} />} />
                      <Route path="/market" element={<Marketplace userProfile={userProfile} />} />
                      <Route path="/chat" element={<Chat userProfile={userProfile} />} />
                      <Route path="/chat/:chatId" element={<Chat userProfile={userProfile} />} />
                      {userProfile?.role === 'admin' && (
                        <Route path="/admin" element={<AdminPanel userProfile={userProfile} />} />
                      )}
                      <Route path="*" element={<Navigate to="/" />} />
                   </Routes>
                   <InstallPrompt />
                </div>
              </main>
            </AuthGuard>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

