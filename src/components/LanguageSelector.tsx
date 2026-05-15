
import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';
import { Language } from '../translations';

const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 p-2 rounded-xl transition-all",
          isOpen ? "bg-green-600/10 text-green-500" : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
        )}
        title="Idioma / Language / Idioma"
      >
        <Globe className={cn("w-5 h-5 transition-transform duration-500", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Seleccionar Idioma</p>
              </div>
              
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group",
                    language === lang.code ? "bg-green-600/10 text-green-500" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl group-hover:scale-125 transition-transform">{lang.flag}</span>
                    <span className="text-xs font-bold">{lang.name}</span>
                  </div>
                  {language === lang.code && <Check className="w-4 h-4" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
