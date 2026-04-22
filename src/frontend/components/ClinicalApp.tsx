import React, { useState, useEffect } from 'react';
import ClinicalSidebar, { type MainTab, type NavItem, type AgentState, navItems } from './ClinicalSidebar';
import ClinicalHeader from './ClinicalHeader';
import ClinicalStatusBar from './ClinicalStatusBar';
import ClinicalContent from './ClinicalContent';
import { useWebSocketConnection } from '../hooks/useWebSocket';

/**
 * ClinicalApp - Medical workstation-style interface
 *
 * Design: Clinical Dashboard aesthetic
 * - Sidebar navigation (workstation style)
 * - Vital signs monitoring for agent state
 * - Status bar with connection/system info
 * - Clean panels with medical-grade typography
 *
 * Architecture: Split into 4 sub-components:
 * - ClinicalSidebar: Navigation panel
 * - ClinicalHeader: Title bar with vital stats
 * - ClinicalContent: Tab-based content routing
 * - ClinicalStatusBar: System status footer
 */
const ClinicalApp: React.FC = () => {
  // Tab state with localStorage persistence
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    const saved = localStorage.getItem('visualApp:activeTab');
    return (saved as MainTab) ?? 'chat';
  });

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Agent state simulation (would be real data from store)
  const [agentState, setAgentState] = useState<AgentState>({
    status: 'idle',
    entities: 0,
    iterations: 0,
    tokens: 0,
    confidence: 0,
  });

  // WebSocket connection hook
  useWebSocketConnection();

  // Persist tab selection
  useEffect(() => {
    localStorage.setItem('visualApp:activeTab', activeTab);
  }, [activeTab]);

  // Simulate agent state changes (connect to real store later)
  useEffect(() => {
    const interval = setInterval(() => {
      // This would be replaced with real agent state from store
      if (Math.random() > 0.95) {
        const states = ['idle', 'thinking', 'retrieving', 'generating'] as const;
        setAgentState(prev => ({
          ...prev,
          status: states[Math.floor(Math.random() * states.length)],
          entities: Math.floor(Math.random() * 5),
          iterations: Math.floor(Math.random() * 3),
          tokens: Math.floor(Math.random() * 1000),
          confidence: Math.random(),
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Current navigation item
  const currentNavItem = navItems.find(item => item.id === activeTab);

  // Navigation handlers
  const handleNavigateToChunks = (docId: string) => setActiveTab('chunks');
  const handleNavigateToDocuments = () => setActiveTab('documents');

  return (
    <div className="clinical-app">
      {/* Body: Sidebar + Main */}
      <div className="clinical-body">
        {/* Sidebar */}
        <ClinicalSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          collapsed={sidebarCollapsed}
          onCollapseChange={setSidebarCollapsed}
          agentState={agentState}
        />

        {/* Main Content */}
        <main className="clinical-main">
          {/* Header */}
          <ClinicalHeader
            activeTab={activeTab}
            currentNavItem={currentNavItem}
            agentState={agentState}
          />

          {/* Content Area */}
          <ClinicalContent
            activeTab={activeTab}
            onNavigateToChunks={handleNavigateToChunks}
            onNavigateToDocuments={handleNavigateToDocuments}
          />
        </main>
      </div>

      {/* Status Bar */}
      <ClinicalStatusBar />
    </div>
  );
};

export default ClinicalApp;