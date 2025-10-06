import PlantSwipe from "@/PlantSwipe"
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { BrowserRouter } from 'react-router-dom'

function AppShell() {
  const { loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-stone-50 to-stone-100 p-4 md:p-8" aria-busy="true" aria-live="polite" />
    )
  }
  return (
    <BrowserRouter>
      <PlantSwipe />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
