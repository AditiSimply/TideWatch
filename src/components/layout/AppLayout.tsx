import React from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { BackgroundWaves } from './BackgroundWaves'

export const AppLayout: React.FC = () => {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#FAFBF8] text-[#0F3D2E] antialiased">
      {/* Background Animated SVG Waves */}
      <BackgroundWaves />

      {/* Sticky Navigation Bar */}
      <Navbar />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Editorial Footer */}
      <Footer />
    </div>
  )
}
