import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  TrendingUp, 
  Package, 
  BarChart3, 
  Layout, 
  Globe, 
  CheckCircle2, 
  Moon, 
  Sun,
  Bell,
  UserCircle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const InvestIQLogo = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-2", className)}>
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 bg-primary rounded-xl rotate-6 opacity-20 animate-pulse"></div>
      <div className="absolute inset-0 bg-primary rounded-xl -rotate-3 opacity-20"></div>
      <div className="relative w-full h-full bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
        <Zap size={22} fill="currentColor" />
      </div>
    </div>
    <div className="flex flex-col">
      <span className="text-xl font-bold font-headline tracking-tighter text-on-surface leading-none">InvestIQ</span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Intelligence</span>
    </div>
  </div>
);

export const LandingPage = () => {
  const { theme, setTheme, token } = useStore();
  const navigate = useNavigate();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const features = [
    {
      icon: TrendingUp,
      title: "Neural Forecasting",
      description: "Our deep learning models analyze over 500 variables in real-time to provide demand predictions with 99.2% historical accuracy.",
      color: "bg-blue-500/10 text-blue-500"
    },
    {
      icon: Package,
      title: "Precision Inventory",
      description: "Free up your working capital by only stocking what you need, when you need it. Reduce waste by 40%.",
      color: "bg-emerald-500/10 text-emerald-500",
      stats: [
        { label: "Waste Reduction", value: "-40%" },
        { label: "Capital Liquidity", value: "+15%" }
      ]
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Live streaming data feeds from every warehouse location globally. Instant insights at your fingertips.",
      color: "bg-amber-500/10 text-amber-500"
    },
    {
      icon: Layout,
      title: "Smart Workspaces",
      description: "Customizable analyst dashboards designed for rapid decision making. Tailored to your workflow.",
      color: "bg-indigo-500/10 text-indigo-500"
    },
    {
      icon: Zap,
      title: "Seamless Integration",
      description: "Connects with your existing ERP and CRM in less than 48 hours. No complex migrations required.",
      color: "bg-rose-500/10 text-rose-500",
      badge: "CORE"
    }
  ];

  return (
    <div className="min-h-screen bg-surface transition-colors duration-500">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-header px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-12">
          <button onClick={scrollToTop} className="hover:scale-105 transition-transform active:scale-95">
            <InvestIQLogo />
          </button>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-outline">
            <Link to="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
            <Link to="/dashboard/predictions" className="hover:text-primary transition-colors">Predictions</Link>
            <Link to="/dashboard/inventory" className="hover:text-primary transition-colors">Inventory</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-2 hover:bg-surface-container rounded-full transition-all text-outline hover:text-on-surface"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button onClick={() => navigate(token ? '/dashboard' : '/auth/login')} className="flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-surface-container transition-all">
            <UserCircle size={28} className="text-outline" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
            <Zap size={12} fill="currentColor" />
            Next-Gen Forecasting
          </div>
          <h1 className="text-5xl md:text-7xl font-black font-headline tracking-tighter text-on-surface leading-[0.9]">
            Inventory <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-container to-secondary animate-gradient">
              InventIQ
            </span>
          </h1>
          <p className="text-xl text-outline max-w-lg leading-relaxed">
            Harness the power of precision intelligence to eliminate stockouts and minimize overhead. Our AI-driven engine turns market volatility into your competitive advantage.
          </p>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/auth/signup')}
              className="px-8 py-4 bg-primary text-white rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              Get Started
            </button>
            <button 
              onClick={() => navigate('/auth/login')}
              className="px-8 py-4 bg-surface-container text-on-surface rounded-xl font-bold border border-outline-variant/20 hover:bg-surface-container-high transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
        <div className="flex-1 relative">
          <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-50"></div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-surface-container-lowest border border-outline-variant/20 rounded-3xl shadow-2xl overflow-hidden"
          >
            <img 
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=2000" 
              alt="Modern Warehouse Logistics" 
              className="w-full h-auto object-cover max-h-[500px]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-6 left-6 right-6 p-6 bg-surface/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-primary uppercase tracking-widest">AI Forecast</span>
                <span className="text-emerald-500 font-bold">+24.8% Yield</span>
              </div>
              <p className="text-sm text-outline">Optimal stock levels achieved for Q2 based on kinetic market shifts.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-surface-container-low/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl font-bold font-headline text-on-surface">The Kinetic Advantage</h2>
            <p className="text-outline max-w-2xl mx-auto">Sophisticated tools for modern logistics. Move beyond static spreadsheets.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -5 }}
                className={cn(
                  "p-8 rounded-3xl border border-outline-variant/10 transition-all",
                  feature.stats ? "bg-primary text-white lg:col-span-1" : "bg-surface-container-lowest"
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6", feature.color)}>
                  <feature.icon size={24} />
                </div>
                <h3 className={cn("text-xl font-bold mb-4", feature.stats ? "text-white" : "text-on-surface")}>
                  <span className="text-xl font-bold text-primary tracking-tighter">InventIQ</span>
                  {feature.title}
                  {feature.badge && <span className="ml-2 text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full uppercase">{feature.badge}</span>}
                </h3>
                <p className={cn("text-sm leading-relaxed mb-6", feature.stats ? "text-white/80" : "text-outline")}>
                  {feature.description}
                </p>
                {feature.stats && (
                  <div className="space-y-3 pt-6 border-t border-white/10">
                    {feature.stats.map((stat, sidx) => (
                      <div key={sidx} className="flex justify-between items-center">
                        <span className="text-xs opacity-70">{stat.label}</span>
                        <span className="font-bold">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Data in Motion Section */}
      <section className="py-24 max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 space-y-8">
          <h2 className="text-4xl font-bold font-headline text-on-surface leading-tight">Data in Motion</h2>
          <p className="text-lg text-outline leading-relaxed">
            Static reports are a relic of the past. Our "Kinetic Architect" engine visualizes supply chains as living organisms, highlighting bottlenecks before they disrupt your flow.
          </p>
          <ul className="space-y-4">
            {[
              "Multi-channel demand sensing",
              "Automated reordering triggers",
              "Seasonal trend decomposition"
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-3 text-on-surface font-medium">
                <CheckCircle2 size={20} className="text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 bg-on-surface rounded-3xl p-0 relative overflow-hidden aspect-square flex items-center justify-center shadow-2xl group">
          <img 
            src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=2000" 
            alt="Detailed Global Logistics Map" 
            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-on-surface via-on-surface/20 to-transparent"></div>
          <div className="relative z-10 text-center p-12 space-y-6">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-primary/20 backdrop-blur-md rounded-full border border-primary/30 mb-4 animate-bounce">
              <Globe size={20} className="text-primary" />
              <span className="text-primary text-xs font-bold uppercase tracking-[0.3em]">Live Global Pulse</span>
            </div>
            <h3 className="text-white text-3xl font-bold mb-4 font-headline">Real-time Supply Chain Visibility</h3>
            <p className="text-white/70 text-base max-w-sm mx-auto leading-relaxed">
              Monitoring 1.2M+ shipments across 120+ countries. Our kinetic engine predicts regional disruptions before they impact your bottom line.
            </p>
            <div className="pt-8 flex justify-center gap-8">
              <div className="text-center">
                <p className="text-primary text-2xl font-bold">120+</p>
                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Countries</p>
              </div>
              <div className="h-10 w-px bg-white/10"></div>
              <div className="text-center">
                <p className="text-primary text-2xl font-bold">99.9%</p>
                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Uptime</p>
              </div>
              <div className="h-10 w-px bg-white/10"></div>
              <div className="text-center">
                <p className="text-primary text-2xl font-bold">24/7</p>
                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto bg-primary rounded-[40px] p-12 lg:p-20 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent"></div>
          <div className="relative z-10 space-y-8">
            <h2 className="text-5xl lg:text-6xl font-bold font-headline">Ready to master <br /> your demand?</h2>
            <p className="text-xl opacity-80 max-w-xl mx-auto">Join the high-performing teams using InvestIQ to redefine the standard of retail intelligence.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button onClick={() => navigate('/auth/signup')} className="px-10 py-4 bg-white text-primary rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl">
                Get Started Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-outline-variant/10 bg-surface-container-low">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12">
          <div className="col-span-2 space-y-6">
            <button onClick={scrollToTop} className="text-left hover:scale-105 transition-transform active:scale-95">
              <InvestIQLogo />
            </button>
            <p className="text-sm text-outline max-w-xs leading-relaxed">
              Precision intelligence for the modern supply chain. Architecture for the kinetic future.
            </p>
            <div className="flex gap-4 text-outline">
              <Globe size={20} onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors" />
              <Zap size={20} onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors" />
              <TrendingUp size={20} onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors" />
            </div>
          </div>
          <div>
            <h4 className="font-bold text-on-surface mb-6 uppercase text-xs tracking-widest">Platform</h4>
            <ul className="space-y-4 text-sm text-outline">
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Predictions</li>
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Inventory</li>
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Integrations</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-on-surface mb-6 uppercase text-xs tracking-widest">Resources</h4>
            <ul className="space-y-4 text-sm text-outline">
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Documentation</li>
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Intelligence Reports</li>
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">API Reference</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-on-surface mb-6 uppercase text-xs tracking-widest">Company</h4>
            <ul className="space-y-4 text-sm text-outline">
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Our Vision</li>
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Careers</li>
              <li onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Contact</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-outline">
          <p>© 2026 InvestIQ Inc. All rights reserved.</p>
          <div className="flex gap-8">
            <span onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Privacy Policy</span>
            <span onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Terms of Service</span>
            <span onClick={scrollToTop} className="hover:text-primary cursor-pointer transition-colors">Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
