import React from 'react'

type AuthActionsContextValue = {
  openLogin: () => void
  openSignup: () => void
}

const AuthActionsContext = React.createContext<AuthActionsContextValue | undefined>(undefined)

export const AuthActionsProvider: React.FC<{ children: React.ReactNode; openLogin: () => void; openSignup: () => void }> = ({ children, openLogin, openSignup }) => {
  return (
    <AuthActionsContext.Provider value={{ openLogin, openSignup }}>
      {children}
    </AuthActionsContext.Provider>
  )
}

export function useAuthActions() {
  const ctx = React.useContext(AuthActionsContext)
  if (!ctx) throw new Error('useAuthActions must be used within AuthActionsProvider')
  return ctx
}
