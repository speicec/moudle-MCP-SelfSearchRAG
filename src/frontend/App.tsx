import React from 'react';
import ClinicalApp from './components/ClinicalApp';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Main App component
 * Renders the ClinicalApp with medical workstation-style interface
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
        <ClinicalApp />
      </React.Suspense>
    </ErrorBoundary>
  );
};

export default App;