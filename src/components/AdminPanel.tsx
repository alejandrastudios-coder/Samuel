import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, serverTimestamp, getDocs, where, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserGroup } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, CheckCircle, XCircle, Trash2, Shield, User, Search, Filter, ArrowLeft, LogOut, Plus, Edit2, X, AlertTriangle, Save, Database, LayoutGrid, MapPin, Tag, Layers, Palette } from 'lucide-react';
import { cn } from '../lib/utils';
import { normalizeStickerId, ALL_COUNTRIES, FLAGS } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

export default function AdminPanel({ userProfile }: { userProfile: UserProfile | null }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [allProgress, setAllProgress] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    password: '',
    role: 'user' as 'user' | 'admin',
    status: 'approved' as 'approved' | 'pending' | 'rejected',
    residingCountry: '',
    groupIds: [] as string[]
  });

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    color: '#10b981'
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile?.role !== 'admin') {
      navigate('/');
      return;
    }
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const usersUnsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
    });

    const groupsUnsub = onSnapshot(query(collection(db, 'groups'), orderBy('createdAt', 'desc')), (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserGroup)));
    });

    const progressUnsub = onSnapshot(collection(db, 'album_progress'), (snap) => {
      setAllProgress(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      usersUnsub();
      groupsUnsub();
      progressUnsub();
    };
  }, []);

  const resetForm = () => {
    setFormData({
      displayName: '',
      username: '',
      password: '',
      role: 'user',
      status: 'approved',
      residingCountry: '',
      groupIds: []
    });
    setEditingUser(null);
  };

  const resetGroupForm = () => {
    setGroupFormData({
      name: '',
      color: '#10b981'
    });
    setEditingGroup(null);
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
          residingCountry: formData.residingCountry,
          groupIds: formData.groupIds,
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
          residingCountry: formData.residingCountry,
          groupIds: formData.groupIds,
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

  const handleCreateOrUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await updateDoc(doc(db, 'groups', editingGroup.id), {
          ...groupFormData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'groups'), {
          ...groupFormData,
          createdAt: serverTimestamp()
        });
      }
      setIsGroupModalOpen(false);
      resetGroupForm();
    } catch (error) {
      console.error('Error saving group:', error);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      // Optionally update all users to remove this groupId
      const usersToUpdate = users.filter(u => u.groupIds?.includes(groupId));
      for (const u of usersToUpdate) {
        await updateDoc(doc(db, 'users', u.userId), {
          groupIds: u.groupIds?.filter(id => id !== groupId)
        });
      }
      setConfirmDeleteGroup(null);
    } catch (error) {
       console.error('Error deleting group:', error);
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
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert('Error al eliminar el usuario y sus datos: ' + errorMessage);
    }
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      displayName: user.displayName,
      username: user.username,
      password: user.password || '',
      role: user.role,
      status: user.status,
      residingCountry: user.residingCountry || '',
      groupIds: user.groupIds || []
    });
    setIsModalOpen(true);
  };

  const openGroupEditModal = (group: UserGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      color: group.color
    });
    setIsGroupModalOpen(true);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(search.toLowerCase()) || 
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase());
    
    const matchesCountry = !countryFilter || u.residingCountry === countryFilter;
    
    return matchesSearch && matchesCountry;
  });

  const [isCleaning, setIsCleaning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const importSamuelStickers = async () => {
    if (!userProfile) return;
    if (!confirm('¿Deseas registrar las figuritas solicitadas para tu perfil?')) return;
    
    setIsImporting(true);
    try {
      // Precise mapping to system keys
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
        "FWC": [2,7,9,13,17,19],
        "CC": [1,4,5,7,8,10,11]
      };

      // Ensure we target the document ID that Album.tsx expects (the userId)
      const progressRef = doc(db, 'album_progress', userProfile.userId);
      const progressDoc = await getDoc(progressRef);
      
      let currentStickers: Record<string, number> = {};
      if (progressDoc.exists()) {
        currentStickers = progressDoc.data().stickers || {};
      } else {
        // If it doesn't exist by ID, search by userId field just in case
        const progressSnap = await getDocs(query(collection(db, 'album_progress'), where('userId', '==', userProfile.userId)));
        if (!progressSnap.empty) {
          currentStickers = progressSnap.docs[0].data().stickers || {};
          // Optional: we could delete the old doc if its ID isn't the userId, 
          // but for now let's just make sure we establish the primary one.
        }
      }

      const updatedStickers = { ...currentStickers };
      let newCount = 0;
      
      Object.entries(stickersToImport).forEach(([team, nums]) => {
        nums.forEach(num => {
          const stickerId = `${team}-${num}`;
          // Set as owned (1) if it wasn't already owned
          if (!updatedStickers[stickerId] || updatedStickers[stickerId] === 0) {
            updatedStickers[stickerId] = 1;
            newCount++;
          }
        });
      });

      await setDoc(progressRef, {
        userId: userProfile.userId,
        stickers: updatedStickers,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert(`¡Importación completada! Se marcaron ${newCount} nuevas figuritas.`);
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
          <div className="flex-1">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase italic">{t('admin.title')}</h2>
            <p className="text-zinc-500 font-medium tracking-tight">Administra accesos, grupos y sectores.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-zinc-900/50 p-1 border border-zinc-800 rounded-2xl mr-2">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
                activeTab === 'users' ? "bg-green-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              USUARIOS
            </button>
            <button 
              onClick={() => setActiveTab('groups')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
                activeTab === 'groups' ? "bg-green-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              SECTORES
            </button>
          </div>

          {activeTab === 'groups' ? (
            <button 
              onClick={() => { resetGroupForm(); setIsGroupModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-black transition-all shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>NUEVO SECTOR</span>
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {activeTab === 'users' ? (
          <>
            <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/20">
              <div className="flex flex-col md:flex-row gap-4 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Buscar por nombre, email o usuario..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all text-white"
                  />
                </div>
                <div className="relative min-w-[200px]">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all text-white appearance-none"
                  >
                    <option value="">Todos los países</option>
                    {Array.from(new Set(users.map(u => u.residingCountry).filter(Boolean))).sort().map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
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
                    <th className="p-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 text-center">Ubicación / Sector</th>
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
                          <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex-shrink-0 flex items-center justify-center border border-zinc-700/50 overflow-hidden shadow-inner font-black text-zinc-600">
                            {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-black text-white group-hover:text-green-500 transition-colors uppercase italic">{user.displayName}</div>
                              <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">@{user.username}</div>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              {(() => {
                                const progress = allProgress.find(p => p.id === user.userId || p.userId === user.userId);
                                const stickers = progress?.stickers || {};
                                
                                const uniqueFWC = new Set<string>();
                                const uniqueCC = new Set<string>();
                                const uniqueStandard = new Set<string>();

                                Object.entries(stickers).forEach(([id, qty]) => {
                                  if ((qty as number) <= 0) return;
                                  const norm = normalizeStickerId(id);
                                  if (norm.startsWith('FWC') || norm.startsWith('UFW')) {
                                    uniqueFWC.add(norm);
                                  } else if (norm.startsWith('CC') || norm.startsWith('COCA-COLA')) {
                                    uniqueCC.add(norm);
                                  } else {
                                    uniqueStandard.add(norm);
                                  }
                                });

                                const total = uniqueFWC.size + uniqueCC.size + uniqueStandard.size;

                                return (
                                  <>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-950/50 rounded-lg border border-zinc-800/80" title="Total Figuras">
                                      <LayoutGrid className="w-2.5 h-2.5 text-white/40" />
                                      <span className="text-[9px] font-black text-white italic">{total}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-950/50 rounded-lg border border-zinc-800/80" title="Figuras FWC">
                                      <span className="text-[9px] font-black text-green-500 italic">FWC:</span>
                                      <span className="text-[9px] font-black text-white italic">{uniqueFWC.size}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-950/50 rounded-lg border border-zinc-800/80" title="Figuras Coca Cola">
                                      <span className="text-[9px] font-black text-red-500 italic">CC:</span>
                                      <span className="text-[9px] font-black text-white italic">{uniqueCC.size}</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-2 items-center">
                          {user.residingCountry ? (() => {
                            const countryName = user.residingCountry;
                            const flagEntry = Object.entries(FLAGS).find(([key]) => key.includes(countryName));
                            const flagUrl = flagEntry ? flagEntry[1] : null;

                            return (
                              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950/50 rounded-full border border-zinc-800" title={countryName}>
                                 {flagUrl ? (
                                   <img src={flagUrl} alt="" className="w-4 h-3 object-cover rounded-sm" referrerPolicy="no-referrer" />
                                 ) : (
                                   <MapPin className="w-3 h-3 text-worldcup-red" />
                                 )}
                                 <span className="text-[10px] font-black text-zinc-300 uppercase italic">{countryName}</span>
                              </div>
                            );
                          })() : (
                            <span className="text-[9px] text-zinc-700 font-bold uppercase italic">Sin Ubicación</span>
                          )}

                          <div className="flex flex-wrap justify-center gap-1">
                            {user.groupIds?.map(gid => {
                              const group = groups.find(g => g.id === gid);
                              if (!group) return null;
                              return (
                                <div 
                                  key={gid}
                                  className="px-2 py-0.5 rounded text-[8px] font-black uppercase italic"
                                  style={{ backgroundColor: `${group.color}20`, color: group.color, border: `1px solid ${group.color}30` }}
                                >
                                  {group.name}
                                </div>
                              );
                            })}
                            {(!user.groupIds || user.groupIds.length === 0) && (
                              <span className="text-[8px] text-zinc-800 font-bold">SIN SECTOR</span>
                            )}
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
          </>
        ) : (
          <div className="p-8">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {groups.map(group => (
                 <motion.div 
                   key={group.id}
                   layout
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="bg-zinc-950/50 border border-zinc-800 p-6 rounded-[2rem] relative group/group-card overflow-hidden"
                 >
                   <div 
                     className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-10 rounded-full blur-2xl transition-all group-hover/group-card:opacity-20"
                     style={{ backgroundColor: group.color }}
                   />

                   <div className="flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-3">
                       <div 
                         className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                         style={{ backgroundColor: group.color }}
                       >
                         <Tag className="w-5 h-5" />
                       </div>
                       <div>
                         <h4 className="text-xl font-black text-white italic uppercase tracking-tight">{group.name}</h4>
                         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                           {users.filter(u => u.groupIds?.includes(group.id)).length} Miembros
                         </p>
                       </div>
                     </div>
                     <div className="flex items-center gap-1 opacity-0 group-hover/group-card:opacity-100 transition-all">
                       <button 
                         onClick={() => openGroupEditModal(group)}
                         className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                       >
                         <Edit2 className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => setConfirmDeleteGroup(group.id)}
                         className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   </div>
                 </motion.div>
               ))}
               
               {groups.length === 0 && (
                 <div className="col-span-full py-20 text-center">
                    <Layers className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-zinc-500 uppercase tracking-tight italic">No hay sectores creados</h3>
                    <p className="text-zinc-600 text-sm mt-2">Usa el botón "Nuevo Sector" para comenzar a organizar a tus coleccionistas.</p>
                 </div>
               )}
             </div>
          </div>
        )}
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

              <form onSubmit={handleCreateOrUpdate} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
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
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contraseña</label>
                      <input 
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-white font-mono"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">País Residencia</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <select 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 pl-12 text-white appearance-none"
                        value={formData.residingCountry}
                        onChange={e => setFormData({...formData, residingCountry: e.target.value})}
                      >
                        <option value="">Seleccionar País</option>
                        {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sectores / Grupos</label>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {groups.map(group => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => {
                            const newIds = formData.groupIds.includes(group.id)
                              ? formData.groupIds.filter(id => id !== group.id)
                              : [...formData.groupIds, group.id];
                            setFormData({...formData, groupIds: newIds});
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[10px] font-black uppercase italic",
                            formData.groupIds.includes(group.id) 
                              ? "bg-zinc-800 border-zinc-600 text-white" 
                              : "bg-transparent border-zinc-800/50 text-zinc-600 grayscale opacity-50"
                          )}
                          style={formData.groupIds.includes(group.id) ? { borderColor: group.color + '40', backgroundColor: group.color + '10', color: group.color } : {}}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                          {group.name}
                        </button>
                      ))}
                      {groups.length === 0 && (
                        <p className="col-span-2 text-[10px] text-zinc-700 italic text-center py-2">No hay sectores creados aún.</p>
                      )}
                    </div>
                  </div>
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
                <div className="flex gap-3 pt-4 sticky bottom-0 bg-zinc-900 pb-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-4 bg-zinc-800 text-white rounded-2xl font-bold">CANCELAR</button>
                  <button type="submit" className="flex-1 p-4 bg-green-600 text-white rounded-2xl font-black">GUARDAR</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Sector */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGroupModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-black text-white tracking-tight uppercase italic">
                  {editingGroup ? 'Editar Sector' : 'Nuevo Sector'}
                </h3>
                <button onClick={() => setIsGroupModalOpen(false)}><X className="w-6 h-6 text-zinc-500" /></button>
              </div>

              <form onSubmit={handleCreateOrUpdateGroup} className="p-8 space-y-6">
                <div className="space-y-4">
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nombre del Sector</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input 
                        required
                        placeholder="Ej: Staff, VIP, Zona Norte..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 pl-12 text-white"
                        value={groupFormData.name}
                        onChange={e => setGroupFormData({...groupFormData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Color de Identidad</label>
                    <div className="grid grid-cols-5 gap-2 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                      {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#14b8a6', '#facc15'].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setGroupFormData({...groupFormData, color})}
                          className={cn(
                            "w-full aspect-square rounded-lg border-2 transition-all scale-90 hover:scale-100",
                            groupFormData.color === color ? "border-white ring-2 ring-white/20" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsGroupModalOpen(false)} className="flex-1 p-4 bg-zinc-800 text-white rounded-2xl font-bold">CANCELAR</button>
                  <button type="submit" className="flex-1 p-4 bg-green-600 text-white rounded-2xl font-black">GUARDAR</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Deletar Grupo */}
      <AnimatePresence>
        {confirmDeleteGroup && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteGroup(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-amber-500/20 rounded-[2.5rem] p-8 text-center"
            >
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-white italic uppercase">¿Eliminar sector?</h3>
              <p className="text-zinc-500 mt-2 text-sm font-medium">Los usuarios asignados a este sector dejarán de pertenecer a él.</p>
              <div className="mt-8 flex flex-col gap-3">
                <button onClick={() => deleteGroup(confirmDeleteGroup)} className="w-full p-4 bg-amber-600 text-white rounded-2xl font-black">ELIMINAR SECTOR</button>
                <button onClick={() => setConfirmDeleteGroup(null)} className="w-full p-4 bg-zinc-800 text-white rounded-2xl font-semibold">CANCELAR</button>
              </div>
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
