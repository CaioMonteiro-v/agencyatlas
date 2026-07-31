import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CampaignLayout from './pages/CampaignLayout';
import CampaignOverview from './pages/CampaignOverview';
import MobilizationPage from './pages/MobilizationPage';
import CoordinatorsPage from './pages/CoordinatorsPage';
import ReportPage from './pages/ReportPage';
import UnderConstruction from './pages/UnderConstruction';
import LeaderProfilePage from './pages/LeaderProfilePage';
import EventRegistrationPage from './pages/EventRegistrationPage';
import ReferralCapturePage from './pages/ReferralCapturePage';
import MobilizerCapturePage from './pages/MobilizerCapturePage';
import EventRadarPage from './pages/EventRadarPage';
import AdminPage from './pages/AdminPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/evento/:eventSlug" element={<EventRegistrationPage />} />
      <Route path="/r/:slug/:code" element={<ReferralCapturePage />} />
      <Route path="/m/:slug/:code" element={<MobilizerCapturePage />} />

      <Route
        path="/admin"
        element={(
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/campanha/:slug/lideranca/:leaderId"
        element={(
          <ProtectedRoute>
            <LeaderProfilePage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/campanha/:slug/eventos/:eventId/radar"
        element={(
          <ProtectedRoute>
            <EventRadarPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/campanha/:slug"
        element={(
          <ProtectedRoute>
            <CampaignLayout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<CampaignOverview />} />
        <Route path="mobilizacao" element={<MobilizationPage />} />
        <Route path="coordenadores" element={<CoordinatorsPage />} />
        <Route path="relatorio" element={<ReportPage />} />
        <Route path="midia" element={<UnderConstruction title="Mídia" />} />
        <Route path="conteudo" element={<UnderConstruction title="Conteúdo" />} />
      </Route>
    </Routes>
  );
}
