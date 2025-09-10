import PlantSwipe from "@/PlantSwipe"
import { AuthProvider } from '@/context/AuthContext'
import { BrowserRouter } from 'react-router-dom'
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PlantSwipe />
      </BrowserRouter>
    </AuthProvider>
  )
}
