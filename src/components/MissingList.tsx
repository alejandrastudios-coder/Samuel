import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Search } from 'lucide-react';
import { TEAMS, FLAGS, STICKERS_PER_TEAM, FWC_COUNT, COCA_COLA_COUNT, normalizeStickerId, getStickerNumbers } from '../constants';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

interface MissingListProps {
  isOpen: boolean;
  onClose: () => void;
  stickers: Record<string, number>;
  onFindWhoHasIt?: (stickerId: string) => void;
}

export function MissingList({ isOpen, onClose, stickers, onFindWhoHasIt }: MissingListProps) {
  const { t } = useLanguage();

  const missingByTeam = useMemo(() => {
    const result: { team: string; stickers: { id: string; num: string }[] }[] = [];

    // Aggregate counts of owned stickers
    const counts: Record<string, number> = {};
    Object.entries(stickers).forEach(([id, s]) => {
      const norm = normalizeStickerId(id);
      counts[norm] = (counts[norm] || 0) + s;
    });

    // Group by standard teams
    TEAMS.forEach((teamName) => {
      const teamMissing: { id: string; num: string }[] = [];
      const nums = getStickerNumbers(teamName);
      
      nums.forEach((numStr) => {
        const id = `${teamName}-${numStr}`;
        const norm = normalizeStickerId(id);
        const count = counts[norm] || 0;
        if (count === 0) {
          teamMissing.push({ 
            id, 
            num: numStr
          });
        }
      });

      if (teamMissing.length > 0) {
        result.push({ team: teamName, stickers: teamMissing });
      }
    });

    // Special: FWC
    const fwc: { id: string; num: string }[] = [];
    const fwcNums = getStickerNumbers('FWC');
    fwcNums.forEach((numStr) => {
      const id = `FWC-${numStr}`;
      const norm = normalizeStickerId(id);
      const count = counts[norm] || 0;
      if (count === 0) {
        fwc.push({ id, num: numStr });
      }
    });
    if (fwc.length > 0) result.push({ team: 'FWC', stickers: fwc });

    // Special: Coca-Cola
    const cocacola: { id: string; num: string }[] = [];
    const ccNums = getStickerNumbers('CC');
    ccNums.forEach((numStr) => {
      const id = `CC-${numStr}`;
      const norm = normalizeStickerId(id);
      const count = counts[norm] || 0;
      if (count === 0) {
        cocacola.push({ id, num: numStr });
      }
    });
    const ccLabel = t('album.coca_cola') || 'Coca-Cola';
    if (cocacola.length > 0) result.push({ team: ccLabel, stickers: cocacola });

    return result;
  }, [stickers, t]);

  const totalMissingCount = useMemo(() => {
    return missingByTeam.reduce((acc, team) => acc + team.stickers.length, 0);
  }, [missingByTeam]);

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
                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                  {t('missing.title')}
                </h3>
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                  {t('missing.inventory')} • <span className="text-worldcup-red">{totalMissingCount} {t('dash.figures')}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                id="close-missing-list-btn"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-0 custom-scrollbar">
              {missingByTeam.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 flex items-center justify-center border border-zinc-800">
                    <Clock className="w-10 h-10 text-worldcup-green" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white italic uppercase">{t('missing.no_missing_yet')}</h4>
                    <p className="text-zinc-500 max-w-xs mx-auto mt-2">{t('missing.keep_collecting')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 font-sans">
                  {missingByTeam.map((group, idx) => (
                    <motion.div
                      key={group.team}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group bg-zinc-900/50 border border-zinc-800 p-4 sm:p-6 rounded-[2rem] hover:border-zinc-700 transition-all shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          {FLAGS[group.team] && (
                            <img src={FLAGS[group.team]} alt={group.team} className="w-8 h-8 rounded-lg object-cover shadow-lg border border-white/10" />
                          )}
                          <div>
                            <h4 className="text-lg font-black text-white italic tracking-tighter uppercase">{group.team}</h4>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                              {group.stickers.length} {group.stickers.length === 1 ? t('missing.sticker_left') : t('missing.stickers_left')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {group.stickers.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 bg-black/40 border border-zinc-800/80 px-4 py-2.5 rounded-xl group/item hover:border-worldcup-red/50 transition-colors"
                          >
                            <span className="text-xs font-black text-zinc-400">#{s.num}</span>
                            {onFindWhoHasIt && (
                              <>
                                <div className="w-[1px] h-3 bg-zinc-800" />
                                <button
                                  onClick={() => {
                                    onClose();
                                    onFindWhoHasIt(s.id);
                                  }}
                                  className="text-[10px] font-black text-zinc-500 hover:text-worldcup-green tracking-wider uppercase flex items-center gap-1 transition-colors"
                                  title={t('album.who_has_it') || '¿Quién la tiene?'}
                                >
                                  <Search className="w-3 h-3 text-zinc-500 hover:text-worldcup-green" />
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
