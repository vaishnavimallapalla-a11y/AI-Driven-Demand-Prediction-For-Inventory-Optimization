import React from 'react';
import { Search, UserCircle, LogOut, Moon, Sun } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export const Navbar = () => {
  const { isSidebarOpen, user, logout, theme, setTheme } = useStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <header 
      className={cn(
        "fixed top-0 right-0 z-40 glass-header transition-all duration-300 flex justify-between items-center px-8 py-3",
        isSidebarOpen ? "left-64" : "left-20"
      )}
    >
      <div className="flex items-center gap-6 flex-1">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={18} />
          <input 
            type="text" 
            placeholder="Search insights..."
            className="w-full bg-surface-container-low border-none rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary/20 transition-all text-sm text-on-surface"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={toggleTheme}
          className="p-2 text-outline hover:bg-primary/5 transition-all rounded-full active:scale-95"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard/settings')}
            className="flex items-center gap-3 p-1 pr-3 rounded-full hover:bg-primary/5 transition-all active:scale-95"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border-2 border-surface-container shadow-sm" />
            ) : (
              <UserCircle size={32} className="text-outline" />
            )}
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-on-surface leading-none">{user?.name || 'Guest'}</p>
              <p className="text-[10px] text-outline font-medium mt-1">{user?.role || 'Member'}</p>
            </div>
          </button>
          
          <button 
            onClick={handleLogout}
            className="p-2 text-outline hover:text-error hover:bg-error/5 transition-all rounded-full active:scale-95"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};
