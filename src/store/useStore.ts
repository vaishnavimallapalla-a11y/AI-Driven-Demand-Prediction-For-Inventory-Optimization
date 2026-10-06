import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, ActivityLog, User, SalesData, PredictionRecord } from '../types';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { onSnapshot, collection, query, where, orderBy, doc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AppState {
  user: User | null;
  token: string | null;
  products: Product[];
  activities: ActivityLog[];
  salesData: SalesData[];
  predictionRecords: PredictionRecord[];
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  authReady: boolean;
  
  setAuth: (user: User | null, token: string | null) => void;
  setProducts: (products: Product[]) => void;
  setActivities: (activities: ActivityLog[]) => void;
  setSalesData: (sales: SalesData[]) => void;
  setPredictionRecords: (records: PredictionRecord[]) => void;
  addActivity: (activity: Omit<ActivityLog, 'id' | 'userId' | 'timestamp'>) => Promise<void>;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateUser: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      products: [],
      activities: [],
      salesData: [],
      predictionRecords: [],
      isSidebarOpen: true,
      theme: 'dark',
      authReady: false,
      
      setAuth: (user, token) => set({ user, token }),
      setProducts: (products) => set({ products }),
      setActivities: (activities) => set({ activities }),
      setSalesData: (salesData) => set({ salesData }),
      setPredictionRecords: (predictionRecords) => set({ predictionRecords }),
      
      addActivity: async (activity) => {
        const { user } = get();
        if (!user) return;
        
        const activityDoc = doc(collection(db, 'history'));
        await setDoc(activityDoc, {
          ...activity,
          id: activityDoc.id,
          userId: user.id,
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      },
      
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setTheme: (theme) => set({ theme }),
      
      updateUser: async (data) => {
        const { user } = get();
        if (!user) return;
        const updatedUser = { ...user, ...data };
        await setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });
        set({ user: updatedUser });
      },
      
      logout: async () => {
        await signOut(auth);
        set({ user: null, token: null, products: [], activities: [], salesData: [], predictionRecords: [] });
      },
      
      initializeAuth: () => {
        onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
          if (firebaseUser) {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            let userData: User;
            
            if (userDoc.exists()) {
              userData = userDoc.data() as User;
            } else {
              userData = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'New User',
                email: firebaseUser.email || '',
                role: 'Member',
                avatar: firebaseUser.photoURL || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            }
            
            const token = await firebaseUser.getIdToken();
            set({ user: userData, token, authReady: true });
            
            // Sync Inventory
            const productsQuery = query(
              collection(db, 'inventory'),
              where('userId', '==', firebaseUser.uid),
              orderBy('createdAt', 'desc')
            );
            onSnapshot(productsQuery, (snapshot) => {
              const products = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
              set({ products });
            });
            
            // Sync Activities
            const activitiesQuery = query(
              collection(db, 'history'),
              where('userId', '==', firebaseUser.uid),
              orderBy('createdAt', 'desc')
            );
            onSnapshot(activitiesQuery, (snapshot) => {
              const activities = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ActivityLog));
              set({ activities });
            });

            // Sync Sales Data (Mock for now but synced)
            const salesQuery = query(
              collection(db, 'sales'),
              where('userId', '==', firebaseUser.uid),
              orderBy('date', 'asc')
            );
            onSnapshot(salesQuery, (snapshot) => {
              const sales = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SalesData));
              set({ salesData: sales });
            });

            // Sync Prediction Records
            const predictionsQuery = query(
              collection(db, 'predictions'),
              where('userId', '==', firebaseUser.uid),
              orderBy('createdAt', 'desc')
            );
            onSnapshot(predictionsQuery, (snapshot) => {
              const predictions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PredictionRecord));
              set({ predictionRecords: predictions });
            });
            
          } else {
            set({ user: null, token: null, authReady: true });
          }
        });
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({ theme: state.theme, isSidebarOpen: state.isSidebarOpen }),
    }
  )
);
