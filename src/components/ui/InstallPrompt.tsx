import React, { useEffect, useState } from 'react';
import { Download, Share, X, Plus } from 'lucide-react';
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
              {window.self !== window.top ? (
                <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl text-center">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <X className="w-6 h-6 text-amber-500" />
                  </div>
                  <p className="text-amber-200 text-xs font-black uppercase tracking-widest leading-relaxed">
                    BLOQUEADO EN VISTA PREVIA
                  </p>
                  <p className="text-zinc-400 text-[11px] mt-2 font-medium">
                    Apple no permite la instalación dentro de marcos. Debes pulsar el icono de <b>"Abrir en pestaña nueva"</b> (flecha hacia afuera) arriba a la derecha para continuar.
                  </p>
                </div>
              ) : (
                <p className="text-zinc-300 text-sm font-medium leading-relaxed">
                  {isIOS 
                    ? 'Para instalar: pulsa el icono de "Compartir" y selecciona "Añadir a la pantalla de inicio".' 
                    : 'Accede más rápido instalando la app en tu pantalla de inicio.'}
                </p>
              )}
              
              {!isIOS ? (
                <button 
                  onClick={handleInstallClick}
                  className="w-full py-4 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/10"
                >
                  Instalar Ahora
                </button>
              ) : (
                <div className="space-y-6">
                  <div className="relative p-6 bg-blue-600/10 rounded-3xl border border-blue-500/20 overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 rounded-full" />
                    <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-white rounded-2xl mb-4 flex items-center justify-center shadow-2xl animate-bounce">
                        <Share className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="text-white font-black text-sm uppercase tracking-widest leading-relaxed">
                        1. TOCA EL BOTÓN <span className="text-blue-400">COMPARTIR</span>
                      </p>
                      <p className="text-zinc-400 text-[10px] font-bold mt-1">EN LA BARRA DE TU NAVEGADOR</p>
                    </div>
                  </div>

                  <div className="relative p-6 bg-zinc-800/50 rounded-3xl border border-zinc-700/50">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-zinc-700 rounded-xl mb-4 flex items-center justify-center shadow-xl">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-zinc-200 font-bold text-xs uppercase tracking-[0.1em]">
                        2. LUEGO SELECCIONA:
                      </p>
                      <p className="text-white font-black text-sm uppercase tracking-widest mt-1 bg-white/5 px-4 py-2 rounded-xl border border-white/5 mt-2">
                        "AÑADIR A INICIO"
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={async () => {
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: 'Stickers 2026',
                              text: '¡Entra a stickers2026.app para coleccionar tus estampas!',
                              url: window.location.origin,
                            });
                          } catch (err) {
                            console.log('Error sharing:', err);
                          }
                        }
                      }}
                      className="w-full py-5 bg-worldcup-blue text-white rounded-3xl font-black text-[12px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-worldcup-blue/30 border border-worldcup-blue/50 flex items-center justify-center gap-3"
                    >
                      <Share className="w-5 h-5" />
                      ABRIR MENÚ DE INSTALACIÓN
                    </button>
                    <p className="text-[9px] text-zinc-500 text-center font-bold uppercase tracking-widest italic mt-4 px-4">
                      * El sitio web se descargará como una aplicación real en tu pantalla de inicio.
                    </p>
                  </div>

                  <button 
                    onClick={closePrompt}
                    className="w-full py-4 bg-zinc-900/50 text-zinc-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-white transition-all border border-zinc-800"
                  >
                    Entendido, cerrar
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
