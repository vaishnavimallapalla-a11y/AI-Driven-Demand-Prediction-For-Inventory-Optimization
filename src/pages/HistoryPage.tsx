import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Layers,
  Trash2,
  CheckSquare,
  Square,
  X,
  Trash
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, query, where, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

export const HistoryPage = () => {
  const { activities, user } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Memory-Safe Real-time Search
  const filteredActivities = useMemo(() => {
    if (!searchTerm.trim()) return activities;
    const term = searchTerm.toLowerCase();
    return activities.filter(activity => 
      activity.title.toLowerCase().includes(term) ||
      activity.description.toLowerCase().includes(term) ||
      activity.type.toLowerCase().includes(term)
    );
  }, [activities, searchTerm]);

  // 2. Group Activities for UI Timeline
  const groupedActivities = useMemo(() => {
    return filteredActivities.reduce((acc, activity) => {
      const date = new Date(activity.timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {} as Record<string, typeof activities>);
  }, [filteredActivities]);

  // 3. Helper: Chunk array for Firestore Batch (Limit 400 for safety)
  const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  // 4. Delete Single Item
  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'history', id));
      toast.success('Record deleted');
      setSelectedIds(prev => prev.filter(item => item !== id));
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  // 5. Delete Selected Items (Batch Chunked)
  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} records?`)) return;
    setIsDeleting(true);
    try {
      const chunks = chunkArray(selectedIds, 400);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'history', id));
        });
        await batch.commit();
      }
      toast.success(`${selectedIds.length} records deleted`);
      setSelectedIds([]);
    } catch (error) {
      toast.error('Failed to delete some records');
    } finally {
      setIsDeleting(false);
    }
  };

  // 6. Clear All History (User Scoped + Batch Chunked)
  const handleClearAll = async () => {
    if (!user) return;
    if (!window.confirm('This will permanently delete ALL your history. Continue?')) return;
    
    setIsDeleting(true);
    try {
      const q = query(collection(db, 'history'), where('userId', '==', user.id));
      const snapshot = await getDocs(q);
      const docIds = snapshot.docs.map(d => d.id);
      
      if (docIds.length === 0) {
        toast.error('No history to clear');
        return;
      }

      const chunks = chunkArray(docIds, 400);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'history', id));
        });
        await batch.commit();
      }
      toast.success('All history cleared');
      setSelectedIds([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to clear history');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredActivities.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredActivities.map(a => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">Activity History</h2>
          <p className="text-sm text-outline">Audit log of all inventory changes and AI insights.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input 
              type="text" 
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-2.5 bg-surface-container-low border-none rounded-xl w-full focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={toggleSelectAll} className="hidden sm:flex">
              {selectedIds.length === filteredActivities.length && filteredActivities.length > 0 ? (
                <CheckSquare size={18} className="text-primary" />
              ) : (
                <Square size={18} />
              )}
              {selectedIds.length === filteredActivities.length && filteredActivities.length > 0 ? 'Deselect All' : 'Select All'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-error hover:bg-error/5"
              onClick={handleClearAll}
              disabled={isDeleting || activities.length === 0}
            >
              <Trash size={18} />
              Clear All
            </Button>
          </div>
        </div>
      </header>

      {/* Timeline View */}
      <div className="space-y-12">
        {activities.length === 0 ? (
          <Card className="p-20 flex flex-col items-center justify-center gap-4 text-outline border-dashed border-2">
            <div className="p-4 bg-surface-container rounded-full">
              <History size={48} />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-on-surface">No activity history found</p>
              <p className="text-sm">Your inventory actions and AI insights will appear here.</p>
            </div>
          </Card>
        ) : (
          Object.entries(groupedActivities).map(([date, items]) => (
            <div key={date} className="space-y-6">
              <div className="flex items-center gap-4 text-xs font-bold text-outline uppercase tracking-widest">
                <div className="h-px bg-surface-container flex-1"></div>
                {date}
                <div className="h-px bg-surface-container flex-1"></div>
              </div>

              <div className="space-y-4">
                {items.map((activity) => (
                  <div key={activity.id} className="relative group/item">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                      <button
                        onClick={() => toggleSelect(activity.id)}
                        className="p-2 transition-all"
                      >
                        {selectedIds.includes(activity.id) ? (
                          <CheckSquare size={20} className="text-primary" />
                        ) : (
                          <Square size={20} className="text-outline group-hover/item:text-primary transition-colors" />
                        )}
                      </button>
                    </div>
                    
                    <Card className={cn(
                      "p-0 pl-12 overflow-hidden hover:translate-x-1 transition-all duration-300 border-l-4 border-l-transparent bg-surface-container-low/40 shadow-sm",
                      selectedIds.includes(activity.id) ? "bg-primary/5 border-l-primary" : "hover:border-l-primary"
                    )}>
                      <div className="p-6 flex items-start gap-6">
                        <div className={cn(
                          "p-3 rounded-xl shrink-0",
                          activity.severity === 'warning' ? "bg-amber-500/10 text-amber-500" : 
                          activity.severity === 'success' ? "bg-emerald-500/10 text-emerald-500" : 
                          activity.severity === 'error' ? "bg-rose-500/10 text-rose-500" : 
                          activity.severity === 'info' ? "bg-secondary/10 text-secondary" : "bg-surface-container text-outline"
                        )}>
                          {activity.type === 'stock_alert' ? <AlertTriangle size={24} /> : 
                           activity.type === 'inventory_change' ? <Layers size={24} /> : 
                           activity.type === 'forecast_update' ? <CheckCircle2 size={24} /> : <Info size={24} />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-on-surface">{activity.title}</h4>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-outline flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button 
                                onClick={() => handleDeleteSingle(activity.id)}
                                className="p-1.5 text-outline hover:text-error hover:bg-error/5 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all shadow-sm"
                                title="Delete record"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl">
                            {activity.description}
                          </p>
                          <div className="pt-3 flex items-center gap-4">
                            <Badge variant={activity.severity === 'warning' ? 'warning' : activity.severity === 'success' ? 'success' : activity.severity === 'error' ? 'error' : 'secondary'}>
                              {activity.type.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300 w-[90%] max-w-2xl">
          <div className="bg-surface-container border border-outline-variant/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl">
            <div className="flex items-center gap-3 sm:pr-8 sm:border-r border-outline-variant/20">
              <div className="w-8 h-8 bg-primary/20 text-primary rounded-full flex items-center justify-center font-black text-sm">
                {selectedIds.length}
              </div>
              <p className="text-sm font-black text-on-surface whitespace-nowrap uppercase tracking-tighter">Records Selected</p>
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/10"
                onClick={() => setSelectedIds([])}
              >
                <X size={18} />
                Cancel
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                className="bg-error hover:bg-error/90 text-white border-none shadow-lg shadow-error/20"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={18} />
                )}
                Delete Selected
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
