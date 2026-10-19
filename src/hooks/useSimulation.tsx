import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { simulationEngine } from '@/lib/simulation'
import type { AttackClass } from '@/types'

interface SimulationContextType {
  isRunning: boolean
  speedMultiplier: number
  toggleRunning: () => void
  setSpeed: (multiplier: number) => void
  triggerAttackBurst: (attack?: AttackClass) => void
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

export const SimulationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRunning, setIsRunning] = useState<boolean>(() => simulationEngine.getStatus().isRunning)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(() => simulationEngine.getStatus().speedMultiplier)

  useEffect(() => {
    // Keep state synchronized if changed externally
    const checkStatus = () => {
      const status = simulationEngine.getStatus()
      setIsRunning(status.isRunning)
      setSpeedMultiplier(status.speedMultiplier)
    }
    const interval = setInterval(checkStatus, 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleRunning = () => {
    const running = simulationEngine.toggle()
    setIsRunning(running)
  }

  const setSpeed = (multiplier: number) => {
    simulationEngine.setSpeed(multiplier)
    setSpeedMultiplier(multiplier)
  }

  const triggerAttackBurst = (attack?: AttackClass) => {
    simulationEngine.triggerAttackBurst(attack)
  }

  return (
    <SimulationContext.Provider
      value={{
        isRunning,
        speedMultiplier,
        toggleRunning,
        setSpeed,
        triggerAttackBurst,
      }}
    >
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation(): SimulationContextType {
  const context = useContext(SimulationContext)
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider')
  }
  return context
}
