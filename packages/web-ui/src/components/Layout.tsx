import { Outlet, Link, useLocation } from 'react-router-dom'
import { Bot, LayoutDashboard, Plus, Settings } from 'lucide-react'

export default function Layout() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/new', label: 'Neue Diskussion', icon: Plus },
    { path: '/settings', label: 'Einstellungen', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">OpenBotMan</span>
            </Link>
            
            <nav className="flex items-center gap-6">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
