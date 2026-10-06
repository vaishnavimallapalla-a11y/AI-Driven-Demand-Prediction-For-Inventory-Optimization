import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { InventAI } from '../components/InventAI';

export const DashboardLayout = () => {
  const { isSidebarOpen } = useStore();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <Navbar />
      <main 
        className={cn(
          "transition-all duration-300 pt-20 min-h-screen",
          isSidebarOpen ? "pl-64" : "pl-20"
        )}
      >
        <div className="max-w-[1400px] mx-auto p-8 text-on-surface">
          <Outlet />
        </div>
      </main>
      <InventAI />
    </div>
  );
};
