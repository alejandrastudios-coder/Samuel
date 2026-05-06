import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Trophy, Lock, User as UserIcon, UserPlus, LogIn } from 'lucide-react';
import { UserProfile } from '../types';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
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
          createdAt: serverTimestamp()
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
           await updateDoc(doc(db, 'users', userCredential.user.uid), {
             role: 'admin',
             status: 'approved'
           });
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
    <div className="h-screen w-full flex items-center justify-center bg-zinc-950 overflow-hidden relative p-4">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
         <div className="absolute top-[10%] left-[10%] w-[40vw] h-[40vw] bg-green-900/40 rounded-full blur-[120px]" />
         <div className="absolute bottom-[10%] right-[10%] w-[30vw] h-[30vw] bg-amber-900/20 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-[1.5rem] shadow-[0_0_30px_rgba(22,163,74,0.3)] mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">MI ÁLBUM <span className="text-green-500">2026</span></h1>
          <p className="text-zinc-400 text-sm font-medium">Panel de Coleccionistas</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-6 md:p-8 rounded-[2rem] shadow-2xl">
          <form onSubmit={handleAuth} className="space-y-4">
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
              className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
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
