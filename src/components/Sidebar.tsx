import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  BarChart3, 
  History,
  Settings, 
  Zap,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

const InventIQLogo = ({ collapsed }: { collapsed: boolean }) => (
  <div className={cn("flex items-center gap-3", collapsed ? "justify-center w-full" : "")}>
    <div className="relative w-10 h-10 shrink-0">
      <div className="absolute inset-0 bg-primary rounded-xl rotate-6 opacity-20 animate-pulse"></div>
      <div className="relative w-full h-full bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
        <Zap size={20} fill="currentColor" />
      </div>
    </div>
    <AnimatePresence>
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="flex flex-col"
        >
          <span className="text-lg font-bold text-primary leading-none tracking-tighter">InventIQ</span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-outline font-bold mt-0.5">Inventory Intelligence</span>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export const Sidebar = () => {
  const { isSidebarOpen, toggleSidebar } = useStore();
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && isSidebarOpen) {
        toggleSidebar();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen, toggleSidebar]);

  const handleGenerateForecast = () => {
    navigate('/dashboard/predictions');
    toast.success('AI Engine ready for forecasting');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Package, label: 'Inventory', path: '/dashboard/inventory' },
    { icon: BarChart3, label: 'Analytics', path: '/dashboard/analytics' },
    { icon: TrendingUp, label: 'Predictions', path: '/dashboard/predictions' },
    { icon: History, label: 'History', path: '/dashboard/history' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
  ];

  const effectiveOpen = isSidebarOpen || isHovered;

  return (
    <motion.aside 
      initial={false}
      animate={{ width: effectiveOpen ? 256 : 80 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed left-0 top-0 z-50 h-screen bg-surface flex flex-col py-6 font-headline border-r border-outline-variant/10 overflow-hidden",
      )}
    >
      <div className="px-5 mb-10 flex items-center justify-between min-h-[40px]">
        <Link to="/dashboard" className="hover:scale-105 transition-transform active:scale-95">
          <InventIQLogo collapsed={!effectiveOpen} />
        </Link>
        
        {effectiveOpen && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebar();
            }}
            className="p-1.5 hover:bg-surface-container rounded-lg transition-colors text-outline hover:text-on-surface shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 py-3 px-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-primary text-white shadow-lg shadow-primary/20 font-semibold" 
                : "text-outline hover:text-on-surface hover:bg-surface-container/50"
            )}
          >
            <item.icon size={22} className="shrink-0" />
            <AnimatePresence>
              {effectiveOpen && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {!effectiveOpen && (
              <div className="absolute left-full ml-4 px-2 py-1 bg-on-surface text-surface text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 mt-auto">
        <button 
          onClick={handleGenerateForecast}
          className={cn(
            "w-full bg-gradient-to-r from-primary to-primary-container text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-primary/20 hover:brightness-110 overflow-hidden",
          )}
        >
          <Zap size={20} fill="currentColor" className="shrink-0" />
          <AnimatePresence>
            {effectiveOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="tracking-tight whitespace-nowrap"
              >
                Generate Forecast
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {!effectiveOpen && !isSidebarOpen && (
        <button 
          onClick={toggleSidebar}
          className="absolute top-20 -right-3 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-lg z-50 hover:scale-110 transition-transform"
        >
          <ChevronRight size={14} />
        </button>
      )}
    </motion.aside>
  );
};
