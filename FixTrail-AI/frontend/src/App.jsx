
import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { apiRequest, logout } from './services/api'

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('fixtrail_token')

      if (!token) {
        setChecking(false)
        return
      }

      try {
        const currentUser = await apiRequest('/api/auth/me')
        setUser(currentUser)
      } catch {
        logout()
      } finally {
        setChecking(false)
      }
    }

    restoreSession()
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading FixTrail AI...
      </div>
    )
  }

  return user ? (
    <Dashboard
      user={user}
      onLogout={() => setUser(null)}
    />
  ) : (
    <Login onLogin={setUser} />
  )
}

export default App
