import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useStore } from './store/useStore';

const Root = () => {
  const initializeAuth = useStore((state) => state.initializeAuth);
  
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
