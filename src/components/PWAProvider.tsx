'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Share, PlusSquare, Bell, X, WifiOff, Sparkles } from 'lucide-react';

interface PWAContextType {
  isOnline: boolean;
  isStandalone: boolean;
  promptNotification: () => void;
}

const PWAContext = createContext<PWAContextType>({
  isOnline: true,
  isStandalone: false,
  promptNotification: () => {}
});

export const usePWA = () => useContext(PWAContext);

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [showChromiumBanner, setShowChromiumBanner] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // 1. Initialize PWA capabilities, register SW, track visits, and detect prompts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
          .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
      });
    }

    // Network Status tracking
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Standalone / Installation detection
    const checkStandalone = 
      (window.navigator as any).standalone === true || 
      window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(checkStandalone);

    // iOS Safari Detection (excluding other iOS browsers like Chrome/CriOS)
    const ua = navigator.userAgent;
    const detectedIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
    setIsIOS(detectedIOS);

    // Increment and track visits in localStorage
    let visits = parseInt(localStorage.getItem('yak_pwa_visits') || '0');
    visits += 1;
    localStorage.setItem('yak_pwa_visits', visits.toString());

    // Check banner cooldown (3 days after dismissal)
    const dismissedTime = localStorage.getItem('yak_pwa_banner_dismissed_time');
    const isCoolingDown = dismissedTime ? (Date.now() - parseInt(dismissedTime)) < (3 * 24 * 60 * 60 * 1000) : false;

    // Defer Chromium Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      const currentVisits = parseInt(localStorage.getItem('yak_pwa_visits') || '0');
      const latestDismissedTime = localStorage.getItem('yak_pwa_banner_dismissed_time');
      const latestCoolingDown = latestDismissedTime ? (Date.now() - parseInt(latestDismissedTime)) < (3 * 24 * 60 * 60 * 1000) : false;

      if (currentVisits >= 2 && !latestCoolingDown && !checkStandalone) {
        setShowChromiumBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show Add to Home Screen walkthrough banner if iOS & not installed & >= 2nd visit & not cooling down
    if (detectedIOS && !checkStandalone && visits >= 2 && !isCoolingDown) {
      // Small timeout to prevent overlaying initial load animation
      setTimeout(() => setShowIOSBanner(true), 2500);
    }

    // Check if notification permission can be prompted (installed standalone only)
    const permissionDismissed = localStorage.getItem('yak_pwa_notifications_dismissed');
    if (
      checkStandalone && 
      'Notification' in window && 
      Notification.permission === 'default' && 
      permissionDismissed !== 'true'
    ) {
      setTimeout(() => setShowNotificationModal(true), 5000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 2. Trigger notification permissions
  const promptNotification = () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.');
      return;
    }
    
    if (Notification.permission === 'granted') {
      alert('Notifications are already enabled!');
      return;
    }

    setShowNotificationModal(true);
  };

  const handleEnableNotifications = async () => {
    setShowNotificationModal(false);
    if (!('Notification' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('[PWA] Notification permission granted.');
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('CampusYak Notifications Active!', {
            body: 'You will now receive alerts for anonymous replies and DMs.',
            icon: '/icons/icon-192.png'
          });
        });
      }
    } catch (err) {
      console.error('[PWA] Notification request failed:', err);
    } finally {
      localStorage.setItem('yak_pwa_notifications_dismissed', 'true');
    }
  };

  const handleDismissNotificationModal = () => {
    setShowNotificationModal(false);
    localStorage.setItem('yak_pwa_notifications_dismissed', 'true');
  };

  // Unified dismissal for PWA Install Banners
  const handleDismissBanner = () => {
    setShowIOSBanner(false);
    setShowChromiumBanner(false);
    localStorage.setItem('yak_pwa_banner_dismissed_time', Date.now().toString());
  };

  // Chromium Install Action
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    setShowChromiumBanner(false);
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    } else {
      localStorage.setItem('yak_pwa_banner_dismissed_time', Date.now().toString());
    }
  };

  return (
    <PWAContext.Provider value={{ isOnline, isStandalone, promptNotification }}>
      {/* Offline Status Top Bar Banner */}
      {!isOnline && (
        <div className="sticky top-[69px] z-30 bg-rose-500 text-white text-xs font-bold py-2.5 px-4 flex items-center justify-center space-x-2 shadow-md animate-slide-in">
          <WifiOff className="w-4 h-4 animate-bounce" />
          <span>You are offline. Posting, voting, and messaging are locked.</span>
        </div>
      )}

      {children}

      {/* iOS Add to Home Screen Walkthrough Banner */}
      {showIOSBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border border-emerald-100 dark:border-emerald-950 rounded-2xl p-4 shadow-2xl flex flex-col space-y-3 animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2.5">
              <span className="text-xl">📲</span>
              <div>
                <h3 className="text-xs font-black text-gray-850 dark:text-gray-150">Install CampusYak</h3>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Add to Home Screen</p>
              </div>
            </div>
            <button 
              onClick={handleDismissBanner}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              id="close-ios-pwa-banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Install this app on your iPhone for the full native experience (removes browser tabs, fullscreen layout, and enables push notifications).
          </p>
          <div className="bg-gray-50 dark:bg-gray-950 p-2.5 rounded-xl border border-gray-100 dark:border-gray-850 flex items-center justify-center space-x-2 text-xs font-bold text-gray-700 dark:text-gray-300">
            <span>Tap the Share icon</span>
            <Share className="w-4.5 h-4.5 text-emerald-500" />
            <span>then select Add to Home Screen</span>
            <PlusSquare className="w-4.5 h-4.5 text-emerald-500" />
          </div>
        </div>
      )}

      {/* Chromium Smart Install Banner */}
      {showChromiumBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border border-emerald-100 dark:border-emerald-950 rounded-2xl p-4 shadow-2xl flex flex-col space-y-3 animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2.5">
              <span className="text-xl">📲</span>
              <div>
                <h3 className="text-xs font-black text-gray-850 dark:text-gray-150">Install CampusYak</h3>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Fast & Offline Ready</p>
              </div>
            </div>
            <button 
              onClick={handleDismissBanner}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              id="close-chromium-pwa-banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Install CampusYak to your device for a fullscreen native experience, faster loading, and notifications support.
          </p>
          <button
            onClick={handleInstallClick}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all duration-200 active:scale-95 shadow-md shadow-emerald-500/10 flex items-center justify-center space-x-2"
            id="pwa-install-action-btn"
          >
            <Sparkles className="w-4 h-4" />
            <span>Install App</span>
          </button>
        </div>
      )}

      {/* Push Notifications Opt-In modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center space-y-4 animate-scale-up">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-full animate-pulse">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-850 dark:text-gray-150">Enable Push Notifications?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                Stay updated anonymously! Get real-time alerts when students reply to your posts or message you in DMs.
              </p>
            </div>
            
            <div className="w-full flex space-x-3 pt-2">
              <button
                onClick={handleDismissNotificationModal}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 transition-all duration-200"
              >
                Not Now
              </button>
              <button
                onClick={handleEnableNotifications}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all duration-200 active:scale-95 shadow-md shadow-emerald-500/10"
                id="enable-notifications-btn"
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}
