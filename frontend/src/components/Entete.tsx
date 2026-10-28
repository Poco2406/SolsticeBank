import { Link } from 'react-router-dom'
import './Entete.css'

// En-tête commun à toutes les pages après connexion
function Entete() {
  return (
    <header className="entete">
      <Link to="/accueil" className="logo">
        SolsticeBank
      </Link>
      <Link to="/" className="bouton bouton-secondaire">
        Se déconnecter
      </Link>
    </header>
  )
}

export default Entete
