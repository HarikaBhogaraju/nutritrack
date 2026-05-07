import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LogFood from './pages/LogFood.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Chat from './pages/Chat.jsx'
import Recipes from './pages/Recipes.jsx'
import Lookup from './pages/Lookup.jsx'
import Goals from './pages/Goals.jsx'

function NavBar() {
  const { user, logout } = useAuth()
  const loc = useLocation()
  if (!user) return null

  const link = (to, label) => (
    <Link
      to={to}
      className={loc.pathname === to ? 'nav-link active' : 'nav-link'}
    >
      {label}
    </Link>
  )

  return (
    <nav className="nav">
      <div className="nav-brand">NutriTrack</div>
      <div className="nav-links">
        {link('/', 'Dashboard')}
        {link('/log', 'Log food')}
        {link('/chat', 'Ask Claude')}
        {link('/recipes', 'Recipes')}
        {link('/lookup', 'Barcode + Photo')}
        {link('/goals', 'Goals')}
      </div>
      <div className="nav-user">
        <span>{user.display_name}</span>
        <button className="link-btn" onClick={logout}>Sign out</button>
      </div>
    </nav>
  )
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="container"><p>Loading…</p></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/log" element={<RequireAuth><LogFood /></RequireAuth>} />
          <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
          <Route path="/recipes" element={<RequireAuth><Recipes /></RequireAuth>} />
          <Route path="/lookup" element={<RequireAuth><Lookup /></RequireAuth>} />
          <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
