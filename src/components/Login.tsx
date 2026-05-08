import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Trophy, Lock, User as UserIcon, UserPlus, LogIn } from 'lucide-react';
import { UserProfile } from '../types';
import { WorldCupBall } from './ui/WorldCupBall';
import { RARITIES } from '../constants';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('cualquier');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getInternalEmail = (u: string) => `${u.toLowerCase().trim()}@album2026.com`;

  useEffect(() => {
    // Check if we just registered and are now logged in but pending
    const checkStatus = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          if (profile.status === 'approved' || profile.role === 'admin') {
            navigate('/');
          }
        }
      }
    };
    checkStatus();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = getInternalEmail(username);

    try {
      if (isRegister) {
        console.log('Registering user:', username);
        // 1. Create in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;
        console.log('Auth user created:', userId);

        // 2. Create Profile in Firestore
        const isSamuel = username.toLowerCase().trim() === 'samuel';
        const newUser: UserProfile = {
          userId,
          username: username.trim(),
          password, 
          displayName: displayName || username,
          email: email,
          status: isSamuel ? 'approved' : 'pending',
          role: isSamuel ? 'admin' : 'user',
          createdAt: serverTimestamp(),
          rarity: selectedRarity
        };

        await setDoc(doc(db, 'users', userId), newUser);
        await setDoc(doc(db, 'album_progress', userId), {
          userId,
          stickers: {},
          updatedAt: serverTimestamp()
        });
        
        console.log('Firestore profile created');
        
        if (isSamuel) {
          navigate('/');
        } else {
          setError('Registro exitoso. Tu cuenta está pendiente de aprobación por Samuel.');
          setIsRegister(false);
          // We stay logged in, AuthGuard will handle the "Pending" screen if they try to go home
        }
      } else {
        console.log('Logging in user:', username);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // If it's samuel, ensure the doc has admin role
        if (username.toLowerCase().trim() === 'samuel') {
           const userRef = doc(db, 'users', userCredential.user.uid);
           const userSnap = await getDoc(userRef);
           
           if (!userSnap.exists()) {
             // Create profile if missing
             await setDoc(userRef, {
               userId: userCredential.user.uid,
               username: 'samuel',
               displayName: 'Samuel',
               email: email,
               role: 'admin',
               status: 'approved',
               createdAt: serverTimestamp()
             });
             // Also ensure album_progress exists
             await setDoc(doc(db, 'album_progress', userCredential.user.uid), {
               userId: userCredential.user.uid,
               stickers: {},
               updatedAt: serverTimestamp()
             });
           } else {
             await updateDoc(userRef, {
               role: 'admin',
               status: 'approved'
             });
           }
        }
        
        console.log('Login successful');
        navigate('/');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Usuario o contraseña incorrectos');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este nombre de usuario ya está registrado');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es muy débil (mínimo 6 caracteres)');
      } else {
        setError('Error: ' + (err.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-zinc-950 overflow-hidden relative p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-sans bg-fluid-waves">
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none overflow-hidden">
         <div className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] bg-worldcup-red/20 rounded-full blur-[140px] animate-pulse" />
         <div className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] bg-worldcup-green/20 rounded-full blur-[120px] animate-pulse transition-all duration-[5000ms]" />
         <div className="absolute top-[30%] left-[60%] w-[30vw] h-[30vw] bg-worldcup-blue/10 rounded-full blur-[100px]" />
         
         <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
           <motion.path 
             initial={{ pathLength: 0, opacity: 0 }}
             animate={{ pathLength: 1, opacity: 1 }}
             transition={{ duration: 2, ease: "easeInOut" }}
             d="M0 20 Q 25 40 50 20 T 100 20" 
             fill="none" 
             stroke="white" 
             strokeWidth="0.1" 
           />
           <path d="M0 50 Q 25 70 50 50 T 100 50" fill="none" stroke="white" strokeWidth="0.05" />
           <path d="M0 80 Q 25 100 50 80 T 100 80" fill="none" stroke="white" strokeWidth="0.1" />
         </svg>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full z-10"
      >
        <div className="text-center mb-10">
          <div className="relative inline-flex items-center justify-center w-28 h-28 mb-8 group">
            <div className="absolute inset-0 bg-gradient-to-tr from-worldcup-red via-worldcup-green to-worldcup-blue rounded-full animate-spin-slow opacity-30 group-hover:opacity-50 transition-opacity blur-xl" />
            <WorldCupBall className="w-20 h-20 shadow-2xl relative z-10" animate />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none mb-2">MI ÁLBUM <span className="text-transparent bg-clip-text bg-gradient-to-r from-worldcup-green to-worldcup-blue">2026</span></h1>
          <p className="text-zinc-400 text-sm font-bold uppercase tracking-[0.2em] opacity-60">United for the Game</p>
        </div>

        <div className="glass-panel p-8 md:p-10 rounded-[2.5rem] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-worldcup-green/10 blur-2xl -mr-16 -mt-16" />
          
          <form onSubmit={handleAuth} className="space-y-5 relative z-10">
            {isRegister && (
               <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Nombre Público</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input 
                    required
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-green-500/50 text-sm"
                    placeholder="Tu nombre en el app"
                  />
                </div>
              </div>
            )}

            {isRegister && (
              <div className="space-y-4 pt-2">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-2">¿En qué rareza quieres el álbum?</label>
                <div className="grid grid-cols-2 gap-3">
                  {RARITIES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRarity(r.id)}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col items-center gap-1 transition-all relative overflow-hidden",
                        selectedRarity === r.id 
                          ? `${r.border} bg-white/5 shadow-xl scale-[1.02]` 
                          : "border-zinc-800 bg-zinc-900/30 opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                      )}
                    >
                      <div className={cn("w-6 h-6 rounded-lg", r.color)} />
                      <span className="text-[10px] font-black uppercase text-white">{r.name}</span>
                      <span className="text-[8px] font-bold uppercase text-zinc-500">{r.label}</span>
                      {selectedRarity === r.id && (
                        <div className={cn("absolute top-0 right-0 w-1.5 h-1.5 rounded-full m-2", r.color)} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Usuario</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input 
                  required
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-green-500/50 text-sm"
                  placeholder="Ej: samuel"
                  autoCapitalize="none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-green-500/50 text-sm"
                  placeholder="**********"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "p-3 rounded-xl text-xs font-bold text-center",
                  error.includes('Registro exitoso') ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                )}
              >
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-worldcup-green to-worldcup-blue text-white font-bold rounded-2xl hover:brightness-110 shadow-lg shadow-worldcup-green/20 transition-all active:scale-[0.98] disabled:opacity-50 mt-6 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? <><UserPlus className="w-5 h-5" /> Registrarse</> : <><LogIn className="w-5 h-5" /> Ingresar</>}
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <button 
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="w-full flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
            >
              {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
