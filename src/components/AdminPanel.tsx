import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, CheckCircle, XCircle, Trash2, Shield, User, 
  Search, Filter, ArrowLeft, LogOut, Plus, Edit2, 
  X, AlertTriangle, Save, Database
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function AdminPanel({ userProfile }: { userProfile: UserProfile | null }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    password: '',
    role: 'user' as 'user' | 'admin',
    status: 'approved' as 'approved' | 'pending' | 'rejected'
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile?.role !== 'admin') {
      navigate('/');
      return;
    }
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
    }, (error) => {
      console.error("Error fetching users for admin:", error);
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setFormData({
      displayName: '',
      username: '',
      password: '',
      role: 'user',
      status: 'approved'
    });
    setEditingUser(null);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.userId), {
          displayName: formData.displayName,
          username: formData.username,
          password: formData.password,
          role: formData.role,
          status: formData.status,
          updatedAt: serverTimestamp()
        });
      } else {
        const newId = doc(collection(db, 'users')).id;
        await setDoc(doc(db, 'users', newId), {
          userId: newId,
          displayName: formData.displayName,
          username: formData.username,
          email: `${formData.username.toLowerCase().trim()}@mundial.com`,
          password: formData.password,
          role: formData.role,
          status: formData.status,
          photoURL: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error al guardar el usuario');
    }
  };

  const setStatus = async (userId: string, status: 'approved' | 'rejected' | 'pending') => {
    await updateDoc(doc(db, 'users', userId), { status });
  };

  const deleteUser = async (userId: string) => {
    try {
      // 1. Delete progress
      await deleteDoc(doc(db, 'album_progress', userId));
      // 2. Delete chats and their related messages
      const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId));
      const chatSnap = await getDocs(q);
      for (const d of chatSnap.docs) {
        // Delete messages subcollection
        const msgSnap = await getDocs(collection(db, 'chats', d.id, 'messages'));
        for (const m of msgSnap.docs) {
          await deleteDoc(m.ref);
        }
        await deleteDoc(d.ref);
      }
      // 3. Delete user profile doc
      await deleteDoc(doc(db, 'users', userId));
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar el usuario y sus datos.');
    }
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      displayName: user.displayName,
      username: user.username,
      password: user.password || '',
      role: user.role,
      status: user.status
    });
    setIsModalOpen(true);
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const [isCleaning, setIsCleaning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const importSamuelStickers = async () => {
    if (!userProfile) return;
    if (!confirm('¿Deseas registrar las figuritas solicitadas para tu perfil?')) return;
    
    setIsImporting(true);
    try {
      const stickersToImport: Record<string, number[]> = {
        "KOR Korea Republic": [1,2,4,5,7,9,13,14,15,16,18],
        "CIV Côte d’Ivoire": [2,4,6,10,18,20],
        "EGY Egypt": [1,3,4,7,9,10,11,15],
        "IRN IR Iran": [3,6,7,9,11,13,14,18,20],
        "NZL New Zealand": [2,3,4,5,9,11,12,14,15,18],
        "FRA France": [3,5,6,9,11,14,17,19],
        "SEN Senegal": [2,6,7,8,10,11,13,16,17,18,20],
        "IRQ Iraq": [1,2,9,11,13,14,15],
        "NOR Norway": [1,4,6,9,11,16,18],
        "ARG Argentina": [2,3,7,8,16,17],
        "ALG Algeria": [1,2,4,9,10,12,14,15,19],
        "AUT Austria": [4,5,6,7,8,9,11,15,16,19,20],
        "JOR Jordan": [2,4,5,10,11,12,17,18,19],
        "POR Portugal": [3,4,6,11,16],
        "COD Congo DR": [3,5,6,9,11,12,13,16,18,19],
        "UZB Uzbekistan": [7,10,12,13,14,15,17,18],
        "COL Colombia": [1,2,3,4,12,13,14,15,20],
        "ENG England": [1,2,4,7,8,10,12,19],
        "CRO Croatia": [1,2,3,4,6,8,11,14,18],
        "GHA Ghana": [2,3,10,17],
        "PAN Panama": [1,2,4,7,10,11,15,17],
        "UFW": [2,7,9,13,17,19],
        "COCA-COLA": [1,4,5,7,8,10,11]
      };

      const progressRef = doc(db, 'album_progress', userProfile.userId);
      const progressSnap = await getDocs(query(collection(db, 'album_progress'), where('userId', '==', userProfile.userId)));
      
      let currentStickers: Record<string, number> = {};
      if (!progressSnap.empty) {
        currentStickers = progressSnap.docs[0].data().stickers || {};
      } else {
        // Create if doesn't exist
        await setDoc(progressRef, {
          userId: userProfile.userId,
          stickers: {},
          updatedAt: serverTimestamp()
        });
      }

      const updatedStickers = { ...currentStickers };
      
      Object.entries(stickersToImport).forEach(([team, nums]) => {
        nums.forEach(num => {
          const stickerId = `${team}-${num}`;
          // Set as owned (1) if it wasn't already or wasn't a duplicate
          if (!updatedStickers[stickerId]) {
            updatedStickers[stickerId] = 1;
          }
        });
      });

      await updateDoc(progressRef, {
        stickers: updatedStickers,
        updatedAt: serverTimestamp()
      });

      alert('¡Importación completada con éxito!');
    } catch (error) {
      console.error(error);
      alert('Error durante la importación: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsImporting(false);
    }
  };

  const cleanupOrphans = async () => {
    if (!confirm('Esto borrará todos los datos de progreso de usuarios que ya no existen en el sistema. ¿Continuar?')) return;
    setIsCleaning(true);
    try {
      const progressSnap = await getDocs(collection(db, 'album_progress'));
      const activeUserIds = new Set(users.map(u => u.userId));
      
      let count = 0;
      for (const d of progressSnap.docs) {
        if (!activeUserIds.has(d.id)) {
          await deleteDoc(doc(db, 'album_progress', d.id));
          count++;
        }
      }
      alert(`Limpieza completada. Se eliminaron ${count} registros huérfanos.`);
    } catch (error) {
      console.error(error);
      alert('Error durante la limpieza');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-colors shadow-lg"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">Panel de Control</h2>
            <p className="text-zinc-500 font-medium">Administra accesos, identidades y roles.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={importSamuelStickers}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-[10px] font-black transition-all shadow-lg active:scale-95 disabled:opacity-50 border border-zinc-700"
          >
            <Database className="w-4 h-4 text-blue-500" />
            <span>{isImporting ? 'IMPORTANDO...' : 'IMPORTAR SOLICITUD'}</span>
          </button>
          <button 
            onClick={cleanupOrphans}
            disabled={isCleaning}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-[10px] font-black transition-all shadow-lg active:scale-95 disabled:opacity-50 border border-zinc-700"
          >
            <Shield className="w-4 h-4 text-purple-500" />
            <span>{isCleaning ? 'LIMPIANDO...' : 'LIMPIAR HUÉRFANOS'}</span>
          </button>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-black transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>NUEVO</span>
          </button>
        </div>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/20">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Buscar por nombre, email o usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all text-white"
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-widest">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-950/50 rounded-xl border border-zinc-800">
               <Shield className="w-4 h-4 text-purple-500" />
               <span>{users.filter(u => u.role === 'admin').length} Admins</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-950/50 rounded-xl border border-zinc-800">
               <CheckCircle className="w-4 h-4 text-green-500" />
               <span>{users.filter(u => u.status === 'approved').length} Activos</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-950/50">
                <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Perfil</th>
                <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Seguridad</th>
                <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Estado</th>
                <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredUsers.map((user, idx) => (
                <motion.tr 
                  key={user.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="hover:bg-zinc-800/10 transition-all group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex-shrink-0 flex items-center justify-center border border-zinc-700/50 overflow-hidden shadow-inner">
                        {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="text-zinc-500 w-6 h-6" />}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white group-hover:text-green-500 transition-colors">{user.displayName}</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1.5">
                      <div className="px-2 py-1 bg-black rounded border border-zinc-800 text-[10px] font-black text-green-500 tracking-wider w-fit">
                        {user.password || '••••••••'}
                      </div>
                      <div className="text-[10px] text-zinc-600 font-mono italic">{user.email}</div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                      user.status === 'approved' && "bg-green-500/10 text-green-500 border-green-500/20",
                      user.status === 'pending' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                      user.status === 'rejected' && "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      {user.status}
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                       <button 
                        onClick={() => setStatus(user.userId, 'approved')}
                        className="p-2.5 text-green-500 hover:bg-green-500/10 rounded-xl transition-all"
                        title="Aprobar"
                       >
                         <CheckCircle className="w-5 h-5" />
                       </button>
                       <button 
                        onClick={() => setStatus(user.userId, 'rejected')}
                        className="p-2.5 text-amber-500 hover:bg-amber-500/10 rounded-xl transition-all"
                        title="Bloquear"
                       >
                         <XCircle className="w-5 h-5" />
                       </button>
                       <button 
                        onClick={() => openEditModal(user)}
                        className="p-2.5 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                        title="Editar"
                       >
                         <Edit2 className="w-5 h-5" />
                       </button>
                       <button 
                        onClick={() => setConfirmDelete(user.userId)}
                        className="p-2.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        title="Eliminar"
                       >
                         <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear/Editar */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {editingUser ? 'Editar Datos' : 'Nuevo Coleccionista'}
                </h3>
                <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-zinc-500" /></button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nombre</label>
                    <input 
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white"
                      value={formData.displayName}
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Usuario</label>
                    <input 
                      required
                      disabled={!!editingUser}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white disabled:opacity-50"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contraseña</label>
                    <input 
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-mono"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Rol</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white appearance-none"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value as any})}
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Acceso</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white appearance-none"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="approved">Aprobado</option>
                      <option value="pending">Pendiente</option>
                      <option value="rejected">Denegado</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-4 bg-zinc-800 text-white rounded-2xl font-bold">CANCELAR</button>
                  <button type="submit" className="flex-1 p-4 bg-green-600 text-white rounded-2xl font-black">GUARDAR</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Deletar */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-red-500/20 rounded-[2.5rem] p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-white">¿Borrar usuario?</h3>
              <p className="text-zinc-500 mt-2 text-sm">Esta acción es permanente y borrara todos sus datos de cromos.</p>
              <div className="mt-8 flex flex-col gap-3">
                <button onClick={() => deleteUser(confirmDelete)} className="w-full p-4 bg-red-600 text-white rounded-2xl font-black">BORRAR AHORA</button>
                <button onClick={() => setConfirmDelete(null)} className="w-full p-4 bg-zinc-800 text-white rounded-2xl font-semibold">ME ARREPENTÍ</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
