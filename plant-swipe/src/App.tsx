import PlantSwipe from "@/PlantSwipe"
import { AuthProvider } from '@/context/AuthContext'
export default function App() {
  return (
    <AuthProvider>
      <PlantSwipe />
    </AuthProvider>
  )
}
