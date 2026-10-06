import React, { useState } from 'react';
import { 
  User, 
  Palette, 
  LogOut, 
  Moon,
  Sun,
  Loader2
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export const SettingsPage = () => {
  const { user, theme, setTheme, updateUser, logout } = useStore();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      await updateUser({ name, email });
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="space-y-1">
        <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">InventIQ Settings</h2>
        <p className="text-sm text-outline">Manage your InventIQ preferences and profile configuration.</p>
      </header>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold font-headline flex items-center gap-2">
            <User size={20} className="text-primary" />
            Profile Information
          </h3>
          <Card className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-4 border-surface-container shadow-lg overflow-hidden bg-surface-container flex items-center justify-center">
                  <img 
                    src={user?.avatar} 
                    alt={user?.name} 
                    className="w-full h-full object-cover" 
                  />
                </div>
              </div>
              <div className="flex-1 space-y-4 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-outline uppercase">Full Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-outline uppercase">Email Address</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" 
                    />
                  </div>
                </div>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleUpdateProfile}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  Update Profile
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* Preferences Section */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold font-headline flex items-center gap-2">
            <Palette size={20} className="text-secondary" />
            System Preferences
          </h3>
          <Card className="p-0 overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-bold text-on-surface">Appearance</p>
                <p className="text-xs text-outline">Toggle between light and dark mode</p>
              </div>
              <div className="flex bg-surface-container-low p-1 rounded-xl">
                <button 
                  onClick={() => setTheme('light')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    theme === 'light' ? "bg-white text-primary shadow-sm" : "text-outline"
                  )}
                >
                  <Sun size={20} />
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    theme === 'dark' ? "bg-slate-900 text-blue-400 shadow-sm" : "text-outline"
                  )}
                >
                  <Moon size={20} />
                </button>
              </div>
            </div>
          </Card>
        </section>

        <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <Button variant="ghost" className="text-error hover:bg-error/5" onClick={logout}>
            <LogOut size={20} />
            Sign Out
          </Button>
          <div className="flex items-center gap-4 hidden empty:block"></div>
        </div>
      </div>
    </div>
  );
};
