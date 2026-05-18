import React, { useState, useEffect } from 'react';
import { translateText } from '../services/translationService';
import { useLanguage } from '../contexts/LanguageContext';
import { Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface TranslatedMessageProps {
  text: string;
  senderId: string;
  currentUserId?: string;
  className?: string;
}

export const TranslatedMessage = ({ text, senderId, currentUserId, className }: TranslatedMessageProps) => {
  const { language } = useLanguage();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    // Only translate messages from others
    if (senderId === currentUserId) {
      setTranslatedText(null);
      return;
    }

    const performTranslation = async () => {
      setIsTranslating(true);
      
      // Target language name for Gemini
      const languageMap: Record<string, string> = {
        es: 'Spanish',
        en: 'English',
        pt: 'Portuguese'
      };

      const result = await translateText(text, languageMap[language] || 'English');
      
      // Only set if different from original (ignoring case/punc maybe, but Gemini is smart)
      if (result.trim().toLowerCase() !== text.trim().toLowerCase()) {
        setTranslatedText(result);
      } else {
        setTranslatedText(null);
      }
      setIsTranslating(false);
    };

    performTranslation();
  }, [text, senderId, currentUserId, language]);

  if (senderId === currentUserId) {
    return <p className={cn("whitespace-pre-wrap leading-relaxed", className)}>{text}</p>;
  }

  return (
    <div className="space-y-2">
      <p className={cn("whitespace-pre-wrap leading-relaxed", className)}>
        {translatedText || text}
      </p>
      
      {translatedText && (
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/20 w-fit">
          <Sparkles className="w-2.5 h-2.5" />
          Auto-translated
        </div>
      )}
      
      {isTranslating && !translatedText && (
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
          Translating...
        </div>
      )}

      {translatedText && (
        <details className="mt-2 group">
          <summary className="text-[8px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors uppercase font-bold list-none flex items-center gap-1">
            Show Original
          </summary>
          <p className="mt-1 text-[10px] text-zinc-500 italic border-l-2 border-zinc-700 pl-2 py-0.5">
            {text}
          </p>
        </details>
      )}
    </div>
  );
};
