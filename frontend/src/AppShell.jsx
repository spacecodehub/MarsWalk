import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MarsBackground from './components/MarsBackground';
import AIChat from './components/AIChat';
import Dashboard from './pages/Dashboard';
import Explore from './pages/Explore';
import Navigation from './pages/Navigation';
import Science from './pages/Science';
import Reports from './pages/Reports';
import { MarsWalkAPI } from './services/api';

const PAGE_META = {
  dashboard: {
    title: 'Mission Control Dashboard',
    subtitle: 'JEZERO CRATER • EXPEDITION OVERVIEW & TELEMETRY',
  },
  explore: {
    title: 'Interactive Jezero GIS Map',
    subtitle: 'IAU2000:49900 PLANETARY PROJECTION • LAYER & HAZARD ANALYSIS',
  },
  navigation: {
    title: 'Surface Route & EVA Navigation',
    subtitle: 'BACKEND PATHFINDING & ASTRONAUT WAYPOINT GUIDANCE',
  },
  science: {
    title: 'Science & Environmental Telemetry',
    subtitle: 'MEDA ATMOSPHERIC CHARTS, RIMFAX RADAR & ROVER OBSERVATIONS',
  },
  reports: {
    title: 'Expedition Reports',
    subtitle: 'AUTOMATED MISSION LOGS & DATA EXPORT',
  },
};

export default function AppShell() {
  const [activePage, setActivePage] = useState('dashboard');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    MarsWalkAPI.getHealth().then(({ data, offline, error }) => {
      if (offline || error) {
        setBackendStatus('offline');
        setGlobalError(error || 'FastAPI backend offline');
      } else {
        setBackendStatus('online');
        setGlobalError(null);
      }
    });
  }, []);

  const meta = PAGE_META[activePage];

  return (
    <div className="min-h-screen flex bg-space-950 text-slate-200 overflow-hidden">
      {/* Photorealistic Slowly Revolving Mars (Full prominence on Dashboard, subtle on GIS/Science views) */}
      <MarsBackground subtle={activePage !== 'dashboard'} />

      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        backendStatus={backendStatus}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          assistantOpen={assistantOpen}
          onToggleAssistant={() => setAssistantOpen((o) => !o)}
          error={globalError}
        />

        <main className="flex-1 overflow-y-auto">
          {activePage === 'dashboard' && <Dashboard onNavigate={setActivePage} />}
          {activePage === 'explore' && <Explore />}
          {activePage === 'navigation' && <Navigation />}
          {activePage === 'science' && <Science />}
          {activePage === 'reports' && <Reports />}
        </main>
      </div>

      <AIChat open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
