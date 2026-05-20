import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, ALLOWED_UID } from '../lib/firebase';

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'not-authorized'; user: User }
  | { status: 'authed'; user: User };

const AuthContext = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState({ status: 'signed-out' });
      } else if (user.uid !== ALLOWED_UID) {
        setState({ status: 'not-authorized', user });
      } else {
        setState({ status: 'authed', user });
      }
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function signOutNow() {
  return signOut(auth);
}
