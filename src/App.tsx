import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SimulationProvider } from '@/hooks/useSimulation'
import { AppLayout } from '@/components/layout/AppLayout'

import { LandingPage } from '@/pages/LandingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AnalyzePage } from '@/pages/AnalyzePage'
import { AlertsPage } from '@/pages/AlertsPage'
import { AssistantPage } from '@/pages/AssistantPage'
import { ModelPage } from '@/pages/ModelPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SimulationProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="analyze" element={<AnalyzePage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="model" element={<ModelPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SimulationProvider>
    </QueryClientProvider>
  )
}

export default App
