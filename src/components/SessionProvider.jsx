'use client'

import { createContext, useContext } from 'react'

const Ctx = createContext(null)

export function SessionProvider({ user, children }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)
