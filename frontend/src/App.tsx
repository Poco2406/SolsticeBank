import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Connexion from './Pages/Connexion'
import Accueil from './Pages/Accueil'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Connexion />} />
        <Route path="/accueil" element={<Accueil />} />
        <Route path="*" element={<h1>Page introuvable</h1>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
