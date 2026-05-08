import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for custom trigger
    const triggerHandler = () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      // Get the prompt directly from window to be safer
      const prompt = deferredPrompt || (window as any).deferredPrompt;
      
      if (ios) {
        setIsVisible(true);
      } else if (prompt) {
        handleInstallClick();
      } else {
        setIsVisible(true);
      }
    };

    window.addEventListener('trigger-install-prompt', triggerHandler);

    // Initial check for deferredPrompt on window
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      setIsVisible(true);
    }

    // If it's iOS and not already in standalone mode, show instructions
    const isInIframe = window.self !== window.top;
    if ((ios && !(window.navigator as any).standalone) || isInIframe) {
      // We check if we've already shown it this session to not be annoying
      const hasShown = sessionStorage.getItem('ios-install-prompt-shown');
      if (!hasShown) {
        setIsVisible(true);
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    const prompt = deferredPrompt || (window as any).deferredPrompt;
    if (!prompt) {
      // If we still don't have it, we show instructions anyway (fallback)
      if (!isIOS) {
        alert('Para instalar manualmente: Pulsa los tres puntos (⋮) del navegador y selecciona "Instalar aplicación" o "Añadir a pantalla de inicio".');
      }
      return;
    }

    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
    }
    
    setIsVisible(false);
  };

  const closePrompt = () => {
    setIsVisible(false);
    if (isIOS) {
      sessionStorage.setItem('ios-install-prompt-shown', 'true');
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-8 md:bottom-8 md:w-80"
      >
        <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <button 
            onClick={closePrompt}
            className="absolute top-4 right-4 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-all active:scale-90 z-20"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-zinc-300" />
          </button>

          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center flex-shrink-0 border border-green-500/20">
                <Download className="w-7 h-7 text-green-500" />
              </div>
              
              <div className="flex-1">
                <h3 className="text-white font-black text-lg uppercase italic tracking-tight">Instalar Aplicación</h3>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-zinc-300 text-sm font-medium leading-relaxed">
                {window.self !== window.top 
                  ? 'Para poder instalar la aplicación, debes abrirla en una pestaña nueva.'
                  : isIOS 
                    ? 'Para instalar: pulsa el icono de "Compartir" y selecciona "Añadir a la pantalla de inicio".' 
                    : 'Accede más rápido instalando la app en tu pantalla de inicio.'}
              </p>
              
              {!isIOS ? (
                <button 
                  onClick={handleInstallClick}
                  className="w-full py-4 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/10"
                >
                  Instalar Ahora
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-zinc-400 text-[10px] uppercase font-black tracking-[0.2em] bg-white/5 py-4 px-5 rounded-2xl border border-white/5">
                    <Share className="w-4 h-4 text-worldcup-blue" />
                    <span>Compartir {'>'} Añadir a inicio</span>
                  </div>
                  <button 
                    onClick={closePrompt}
                    className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-zinc-700 active:scale-95 transition-all"
                  >
                    Entendido
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
