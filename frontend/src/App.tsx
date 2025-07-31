import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { CategoryDetail } from './pages/CategoryDetail';
import { EnergyOptimizationDashboard } from './pages/EnergyOptimizationDashboard';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-text transition-colors duration-300">
          <Header />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route index element={<Home />} />
              <Route path="category/:categoryName" element={<CategoryDetail />} />
              <Route path="energy-optimization" element={<EnergyOptimizationDashboard />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;