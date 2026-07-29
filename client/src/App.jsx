import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CampaignLayout from './pages/CampaignLayout';
import CampaignOverview from './pages/CampaignOverview';
import MobilizationPage from './pages/MobilizationPage';
import CoordinatorsPage from './pages/CoordinatorsPage';
import ReportPage from './pages/ReportPage';
import UnderConstruction from './pages/UnderConstruction';
import LeaderProfilePage from './pages/LeaderProfilePage';
import EventRegistrationPage from './pages/EventRegistrationPage';
import ReferralCapturePage from './pages/ReferralCapturePage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/evento/:eventSlug" element={<EventRegistrationPage />} />
      <Route path="/r/:slug/:code" element={<ReferralCapturePage />} />
      <Route path="/campanha/:slug/lideranca/:leaderId" element={<LeaderProfilePage />} />
      <Route path="/campanha/:slug" element={<CampaignLayout />}>
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
