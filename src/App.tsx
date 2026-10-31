import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { bootSession, startAutosave } from '@/store/session';
import { AppShell } from '@/ui/layout/AppShell';
import { MainMenu } from '@/ui/screens/MainMenu';
import { NewGameScreen } from '@/ui/screens/NewGameScreen';

export function App() {
  const screen = useAppStore((s) => s.screen);

  useEffect(() => {
    const stop = startAutosave();
    void bootSession();
    return stop;
  }, []);

  switch (screen) {
    case 'boot':
      return null;
    case 'menu':
      return <MainMenu />;
    case 'setup':
      return <NewGameScreen />;
    case 'game':
      return <AppShell />;
  }
}
