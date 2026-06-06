import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Share2, Send } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfile } from '../types';
import { TEAMS, getStickerNumbers, normalizeStickerId, getValidStickerIds } from '../constants';
import { cn } from '../lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  stickers: Record<string, number>;
  userProfile: UserProfile | null;
}

export function ShareModal({ isOpen, onClose, stickers, userProfile }: ShareModalProps) {
  const { t } = useLanguage();
  const [copiedType, setCopiedType] = useState<'all' | 'missing' | 'repeated' | null>(null);

  // Parse missing and repeated lists grouped by team
  const shareData = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.entries(stickers).forEach(([id, s]) => {
      const norm = normalizeStickerId(id);
      counts[norm] = (counts[norm] || 0) + s;
    });

    const missingGrouped: Record<string, string[]> = {};
    const repeatedGrouped: Record<string, string[]> = {};
    let totalMissing = 0;
    let totalRepeated = 0;

    const processTeam = (teamName: string, prefixId: string) => {
      const nums = getStickerNumbers(teamName);
      const cleanTeamName = teamName.replace(/^[A-Z]{3}\s+/, ""); // e.g. "ARG Argentina" -> "Argentina"
      
      nums.forEach(num => {
        const id = `${prefixId}-${num}`;
        const norm = normalizeStickerId(id);
        const qty = counts[norm] || 0;
        
        if (qty === 0) {
          if (!missingGrouped[cleanTeamName]) missingGrouped[cleanTeamName] = [];
          missingGrouped[cleanTeamName].push(num);
          totalMissing++;
        } else if (qty > 1) {
          if (!repeatedGrouped[cleanTeamName]) repeatedGrouped[cleanTeamName] = [];
          repeatedGrouped[cleanTeamName].push(`${num}${qty > 2 ? ` (x${qty - 1})` : ''}`);
          totalRepeated += (qty - 1);
        }
      });
    };

    // Standard Teams
    TEAMS.forEach(team => {
      processTeam(team, team);
    });

    // FWC Special
    processTeam('FWC', 'FWC');

    // Coca Cola Special
    const ccLabel = t('album.coca_cola') || 'Coca-Cola';
    const ccNums = getStickerNumbers('CC');
    ccNums.forEach(num => {
      const id = `CC-${num}`;
      const norm = normalizeStickerId(id);
      const qty = counts[norm] || 0;
      
      if (qty === 0) {
        if (!missingGrouped[ccLabel]) missingGrouped[ccLabel] = [];
        missingGrouped[ccLabel].push(num);
        totalMissing++;
      } else if (qty > 1) {
        if (!repeatedGrouped[ccLabel]) repeatedGrouped[ccLabel] = [];
        repeatedGrouped[ccLabel].push(`${num}${qty > 2 ? ` (x${qty - 1})` : ''}`);
        totalRepeated += (qty - 1);
      }
    });

    return {
      missingGrouped,
      repeatedGrouped,
      totalMissing,
      totalRepeated,
    };
  }, [stickers, t]);

  // Generate perfect formatted text for copying or sharing
  const generateText = useCallback((type: 'all' | 'missing' | 'repeated') => {
    let output = '';
    const name = userProfile?.displayName || '';
    
    if (type === 'all') {
      output += `📋 *ÁLBUM DE ESTAMPAS*\n👤 *Usuario*: ${name}\n\n`;
    }

    if (type === 'all' || type === 'missing') {
      output += `🔴 *MIS FALTANTES (${shareData.totalMissing})*:\n`;
      const entries = Object.entries(shareData.missingGrouped);
      if (entries.length === 0) {
        output += `_¡Ninguno! Álbum completado 🎉_\n`;
      } else {
        entries.forEach(([team, nums]) => {
          output += `• *${team}*: ${nums.join(', ')}\n`;
        });
      }
    }

    if (type === 'all') {
      output += `\n`;
    }

    if (type === 'all' || type === 'repeated') {
      output += `🟢 *MIS REPETIDAS (${shareData.totalRepeated})*:\n`;
      const entries = Object.entries(shareData.repeatedGrouped);
      if (entries.length === 0) {
        output += `_Sin repetidas aún_\n`;
      } else {
        entries.forEach(([team, items]) => {
          output += `• *${team}*: ${items.join(', ')}\n`;
        });
      }
    }

    if (type === 'all') {
      output += `\n💬 _¡Intercambia conmigo en la App!_`;
    }

    return output;
  }, [shareData, userProfile]);

  const handleCopy = async (type: 'all' | 'missing' | 'repeated') => {
    const text = generateText(type);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleWhatsApp = () => {
    const text = generateText('all');
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleTelegram = () => {
    const text = generateText('all');
    const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    const text = generateText('all');
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('share.modal_title'),
          text: text,
        });
      } catch (err) {
        console.log('Error native sharing:', err);
      }
    } else {
      // Fallback
      handleCopy('all');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[150]"
          />
          
          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-x-4 bottom-4 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-xl w-full max-h-[85vh] md:max-h-[80vh] bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-[2.5rem] z-[151] flex flex-col shadow-3xl text-zinc-300 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
                  <Share2 className="w-5 h-5 text-green-500 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tight">{t('share.modal_title')}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{userProfile?.displayName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-6 space-y-6">
              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-center">
                  <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Faltantes</span>
                  <p className="text-2xl font-black text-white italic mt-1">{shareData.totalMissing}</p>
                </div>
                <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/10 text-center">
                  <span className="text-[10px] font-black uppercase text-green-400 tracking-wider">Repetidas</span>
                  <p className="text-2xl font-black text-white italic mt-1">{shareData.totalRepeated}</p>
                </div>
              </div>

              {/* Text Preview container */}
              <div className="relative p-5 bg-zinc-950 rounded-2xl border border-zinc-800 max-h-[25vh] overflow-y-auto no-scrollbar">
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="text-[8px] font-black text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md uppercase tracking-widest">Vista Previa</span>
                </div>
                <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed select-all">
                  {generateText('all')}
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="space-y-3">
                {/* Multi-platform Copy Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCopy('all')}
                    className="p-4 bg-zinc-800/80 hover:bg-zinc-800 rounded-2xl border border-zinc-700/50 flex items-center justify-between transition-all group active:scale-95"
                  >
                    <div className="flex items-center gap-3">
                      {copiedType === 'all' ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                      )}
                      <span className="text-xs font-bold text-zinc-300 group-hover:text-white">Copiar Todo</span>
                    </div>
                    {copiedType === 'all' && (
                      <span className="text-[9px] text-green-500 font-black uppercase italic">¡Listo!</span>
                    )}
                  </button>

                  <button
                    onClick={() => handleCopy('missing')}
                    className="p-4 bg-zinc-800/80 hover:bg-zinc-800 rounded-2xl border border-zinc-700/50 flex items-center justify-between transition-all group active:scale-95"
                  >
                    <div className="flex items-center gap-3">
                      {copiedType === 'missing' ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                      )}
                      <span className="text-xs font-bold text-zinc-300 group-hover:text-white">Solo Faltantes</span>
                    </div>
                    {copiedType === 'missing' && (
                      <span className="text-[9px] text-green-500 font-black uppercase italic">¡Listo!</span>
                    )}
                  </button>
                </div>

                {/* Social Share actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleWhatsApp}
                    className="p-4 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 font-black rounded-2xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Send className="w-4 h-4 text-[#25D366]" />
                    WhatsApp
                  </button>

                  <button
                    onClick={handleTelegram}
                    className="p-4 bg-[#20A0E1]/10 border border-[#20A0E1]/20 text-[#20A0E1] hover:bg-[#20A0E1]/20 font-black rounded-2xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Send className="w-4 h-4 text-[#20A0E1] -rotate-45" />
                    Telegram
                  </button>
                </div>
              </div>
            </div>

            {/* Sticky bottom system modal */}
            <div className="mt-auto pt-6 border-t border-zinc-800 flex gap-3">
              <button
                onClick={handleNativeShare}
                className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                {t('share.share_native') || 'COMPARTIR'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-4 bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 font-bold text-xs uppercase tracking-wider rounded-full transition-all active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
