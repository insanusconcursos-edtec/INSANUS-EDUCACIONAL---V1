
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User,
  UserCredential 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  userRole: 'ADMIN' | 'STUDENT' | 'COLLABORATOR' | null;
  userData: any | null; // Stores full firestore document data (permissions, etc)
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  seedInitialUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'STUDENT' | 'COLLABORATOR' | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Hardcoded admin email for this phase
  const ADMIN_EMAIL = 'insanusconcursos@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
            // Fetch User Data from Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                setUserData(data);
                
                // Determine Role from Firestore Data
                if (data.role === 'collaborator') {
                    setUserRole('COLLABORATOR');
                } else if (data.role === 'student') {
                    setUserRole('STUDENT');
                } else if (data.role === 'admin' || user.email === ADMIN_EMAIL) {
                    setUserRole('ADMIN');
                } else {
                    setUserRole('STUDENT'); // Fallback
                }
            } else {
                // Fallback for Seeded/Hardcoded Admin without Firestore Doc
                if (user.email === ADMIN_EMAIL) {
                    setUserRole('ADMIN');
                    setUserData({ role: 'admin', name: 'Super Admin' });
                } else {
                    // Default fallback for users without doc (likely students created via auth directly)
                    setUserRole('STUDENT');
                    setUserData(null);
                }
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
            // Default safe fallback
            setUserRole('STUDENT'); 
        }
      } else {
        setUserRole(null);
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<UserCredential> => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const seedInitialUsers = async () => {
    const users = [
      { email: 'insanusconcursos@gmail.com', pass: '123456' },
      { email: 'kelsen.pantoja.prof@gmail.com', pass: '123456' }
    ];

    console.log("Starting seed process...");
    
    for (const u of users) {
      try {
        await createUserWithEmailAndPassword(auth, u.email, u.pass);
        console.log(`User created: ${u.email}`);
        await signOut(auth); 
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`User already exists: ${u.email}`);
        } else {
          console.error(`Error creating user ${u.email}:`, error);
        }
      }
    }
    console.log("Seed process finished.");
  };

  const value = {
    currentUser,
    userRole,
    userData,
    loading,
    login,
    logout,
    seedInitialUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
