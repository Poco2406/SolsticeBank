import { Link } from 'react-router-dom'
import logoSolstice from '../assets/SolsticeBank.png'
import './Entete.css'

// En-tête commun à toutes les pages après connexion
function Entete() {
  return (
    <header className="entete">
      <Link to="/accueil" className="logo" aria-label="Retour à l'accueil">
        <img src={logoSolstice} alt="Solstice Bank" className="logo-image" />
      </Link>
      <Link to="/" className="bouton bouton-secondaire">
        Se déconnecter
      </Link>
    </header>
  )
}

export default Entete
