import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { cn } from '../lib/utils';

const InventIQLogo = ({ className, light = false }: { className?: string, light?: boolean }) => (
  <div className={cn("flex items-center gap-2", className)}>
    <div className="relative w-10 h-10">
      <div className={cn("absolute inset-0 rounded-xl rotate-6 opacity-20 animate-pulse", light ? "bg-white" : "bg-primary")}></div>
      <div className={cn("absolute inset-0 rounded-xl -rotate-3 opacity-20", light ? "bg-white" : "bg-primary")}></div>
      <div className={cn("relative w-full h-full rounded-xl flex items-center justify-center shadow-lg shadow-primary/30", light ? "bg-white text-primary" : "bg-primary text-white")}>
        <Zap size={22} fill="currentColor" />
      </div>
    </div>
    <div className="flex flex-col text-left">
      <span className={cn("text-xl font-bold font-headline tracking-tighter leading-none", light ? "text-white" : "text-on-surface")}>InventIQ</span>
      <span className={cn("text-[10px] uppercase tracking-[0.2em] font-bold", light ? "text-white/80" : "text-primary")}>Inventory Intelligence</span>
    </div>
  </div>
);

export const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row">
      {/* Left Side: Visual/Hero */}
      <div className="hidden lg:flex lg:w-1/2 hero-gradient p-16 flex-col justify-between text-on-primary relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="mb-12">
            <Link to="/">
              <InventIQLogo light />
            </Link>
          </div>
          
          <div className="space-y-6 max-w-md">
            <h2 className="text-5xl font-bold font-headline leading-tight">Predict Demand. Optimize Inventory.</h2>
            <p className="text-xl opacity-80 leading-relaxed">
              Harness the power of precision intelligence to eliminate stockouts and minimize overhead.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <p className="mt-12 text-sm opacity-60">© 2026 InventIQ (Prediction Intelligence). All rights reserved.</p>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-16">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden mb-12">
            <Link to="/">
              <InventIQLogo />
            </Link>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};
