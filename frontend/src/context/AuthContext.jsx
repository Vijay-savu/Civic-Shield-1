import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY = "civicshield_token";
const USER_KEY = "civicshield_user";
const DOC_KEY = "civicshield_last_document_id";

function readSessionUser() {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(sessionStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(readSessionUser());
  const [lastDocumentId, setLastDocumentIdState] = useState(localStorage.getItem(DOC_KEY) || "");

  const setSession = ({ token: nextToken, user: nextUser }) => {
    setToken(nextToken);
    setUser(nextUser);

    sessionStorage.setItem(TOKEN_KEY, nextToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser));

    // Cleanup any legacy persisted auth from older builds.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const clearSession = () => {
    setToken("");
    setUser(null);

    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const setLastDocumentId = (documentId) => {
    setLastDocumentIdState(documentId || "");
    if (documentId) {
      localStorage.setItem(DOC_KEY, documentId);
    } else {
      localStorage.removeItem(DOC_KEY);
    }
  };

  const value = useMemo(
    () => ({
      token,
      user,
      setSession,
      clearSession,
      lastDocumentId,
      setLastDocumentId,
      isAuthenticated: Boolean(token),
      isAdmin: String(user?.role || "").toLowerCase() === "admin",
    }),
    [token, user, lastDocumentId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
