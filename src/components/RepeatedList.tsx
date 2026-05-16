import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Repeat, ChevronRight } from 'lucide-react';
import { TEAMS, FLAGS, STICKERS_PER_TEAM, FWC_COUNT, COCA_COLA_COUNT, normalizeStickerId } from '../constants';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

interface RepeatedListProps {
  isOpen: boolean;
  onClose: () => void;
  stickers: Record<string, number>;
}

export function RepeatedList({ isOpen, onClose, stickers }: RepeatedListProps) {
  const { t } = useLanguage();
  const repeatedByTeam = useMemo(() => {
    const result: { team: string; stickers: { id: string; num: number; count: number }[] }[] = [];

    // Aggregate counts first
    const counts: Record<string, number> = {};
    Object.entries(stickers).forEach(([id, s]) => {
      const norm = normalizeStickerId(id);
      counts[norm] = (counts[norm] || 0) + s;
    });

    // Group by standard teams
    TEAMS.forEach((teamName) => {
      const teamRepeated: { id: string; num: number; count: number }[] = [];
      
      for (let i = 1; i <= STICKERS_PER_TEAM; i++) {
        const id = `${teamName}-${i}`;
        const count = counts[id] || 0;
        if (count > 1) {
          teamRepeated.push({ 
            id, 
            num: i, 
            count: count - 1 
          });
        }
      }

      if (teamRepeated.length > 0) {
        result.push({ team: teamName, stickers: teamRepeated });
      }
    });

    // Special: FWC
    const fwc: { id: string; num: number; count: number }[] = [];
    for (let i = 1; i <= FWC_COUNT; i++) {
      const id = `UFW-${i}`;
      const count = counts[id] || 0;
      if (count > 1) {
        fwc.push({ id, num: i, count: count - 1 });
      }
    }
    if (fwc.length > 0) result.push({ team: 'FWC', stickers: fwc });

    // Special: Coca-Cola
    const cocacola: { id: string; num: number; count: number }[] = [];
    for (let i = 1; i <= COCA_COLA_COUNT; i++) {
      const id = `extra-${i}`;
      const count = counts[id] || 0;
      if (count > 1) {
        cocacola.push({ id, num: i, count: count - 1 });
      }
    }
    if (cocacola.length > 0) result.push({ team: 'Coca-Cola', stickers: cocacola });

    return result;
  }, [stickers]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-zinc-950 border-t border-zinc-800 rounded-t-[3rem] z-[101] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-8 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">{t('repeated.title')}</h3>
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mt-1">{t('repeated.inventory')}</p>
              </div>
              <button
                onClick={onClose}
                className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-0 custom-scrollbar">
              {repeatedByTeam.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 flex items-center justify-center border border-zinc-800">
                    <Repeat className="w-10 h-10 text-zinc-700" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white italic uppercase">{t('repeated.no_repeats_yet')}</h4>
                    <p className="text-zinc-500 max-w-xs mx-auto mt-2">{t('repeated.keep_collecting')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {repeatedByTeam.map((group, idx) => (
                    <motion.div
                      key={group.team}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group bg-zinc-900/50 border border-zinc-800 p-4 sm:p-6 rounded-[2rem] hover:border-zinc-700 transition-all shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          {FLAGS[group.team] && (
                            <img src={FLAGS[group.team]} alt={group.team} className="w-8 h-8 rounded-lg object-cover shadow-lg border border-white/10" />
                          )}
                          <div>
                            <h4 className="text-lg font-black text-white italic tracking-tighter uppercase">{group.team}</h4>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{group.stickers.length} {group.stickers.length === 1 ? t('repeated.model') : t('repeated.models')}</p>
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-tighter px-1 rounded",
                                (() => {
                                  let teamOwned = 0;
                                  for (let i = 1; i <= (group.team === 'FWC' || group.team === 'FWC' ? FWC_COUNT : group.team === 'Coca-Cola' || group.team === t('album.coca_cola') ? COCA_COLA_COUNT : STICKERS_PER_TEAM); i++) {
                                    const id = group.team === 'FWC' ? `UFW-${i}` : (group.team === 'Coca-Cola' || group.team === t('album.coca_cola')) ? `extra-${i}` : `${group.team}-${i}`;
                                    if ((stickers[id] || 0) >= 1) teamOwned++;
                                  }
                                  const total = group.team === 'FWC' ? FWC_COUNT : (group.team === 'Coca-Cola' || group.team === t('album.coca_cola')) ? COCA_COLA_COUNT : STICKERS_PER_TEAM;
                                  return teamOwned === total ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500";
                                })()
                              )}>
                                {(() => {
                                  let teamOwned = 0;
                                  for (let i = 1; i <= (group.team === 'FWC' ? FWC_COUNT : (group.team === 'Coca-Cola' || group.team === t('album.coca_cola')) ? COCA_COLA_COUNT : STICKERS_PER_TEAM); i++) {
                                    const id = (group.team === 'FWC') ? `UFW-${i}` : (group.team === 'Coca-Cola' || group.team === t('album.coca_cola')) ? `extra-${i}` : `${group.team}-${i}`;
                                    if ((stickers[id] || 0) >= 1) teamOwned++;
                                  }
                                  const total = group.team === 'FWC' ? FWC_COUNT : (group.team === 'Coca-Cola' || group.team === t('album.coca_cola')) ? COCA_COLA_COUNT : STICKERS_PER_TEAM;
                                  return teamOwned === total ? t('repeated.complete') : t('repeated.incomplete');
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                          Total: {group.stickers.reduce((acc, s) => acc + s.count, 0)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {group.stickers.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 bg-black/40 border border-zinc-800 px-4 py-2 rounded-xl group/item hover:border-amber-500/50 transition-colors"
                          >
                            <span className="text-xs font-black text-zinc-500 group-hover/item:text-white transition-colors">#{s.num}</span>
                            <div className="w-[1px] h-3 bg-zinc-800" />
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-black text-amber-500 italic">x{s.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-8 pt-0">
              <div className="bg-gradient-to-r from-worldcup-red/10 via-worldcup-green/10 to-worldcup-blue/10 p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center font-black italic shadow-xl">
                    !
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">{t('repeated.ready_to_trade')}</p>
                    <p className="text-xs text-zinc-400 font-medium">{t('repeated.go_to_market')}</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-zinc-600" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
