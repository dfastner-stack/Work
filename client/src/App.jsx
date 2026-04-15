import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import { refreshTasks } from './api/asana.js';

import TeamOverview from './pages/TeamOverview.jsx';
import PersonDashboard from './pages/PersonDashboard.jsx';
import BandwidthCalculator from './pages/BandwidthCalculator.jsx';
import CampaignTracker from './pages/CampaignTracker.jsx';
import PipelineKanban from './pages/PipelineKanban.jsx';
import SprintPlanner from './pages/SprintPlanner.jsx';
import ContentTypes from './pages/ContentTypes.jsx';
import OverdueStalled from './pages/OverdueStalled.jsx';
import QuarterPlanning from './pages/QuarterPlanning.jsx';

export default function App() {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshTasks();
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onRefresh={handleRefresh} refreshing={refreshing} />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<TeamOverview />} />
          <Route path="/person/:slug" element={<PersonDashboard />} />
          <Route path="/bandwidth" element={<BandwidthCalculator />} />
          <Route path="/quarter" element={<QuarterPlanning />} />
          <Route path="/campaigns" element={<CampaignTracker />} />
          <Route path="/pipeline" element={<PipelineKanban />} />
          <Route path="/sprint" element={<SprintPlanner />} />
          <Route path="/content-types" element={<ContentTypes />} />
          <Route path="/overdue" element={<OverdueStalled />} />
          <Route path="*" element={<TeamOverview />} />
        </Routes>
      </main>
    </div>
  );
}
