import { Link, NavLink, useNavigate } from 'react-router-dom'
import logoSolstice from '../assets/SolsticeBank.png'
import { deconnecter } from '../api'
import './Entete.css'

// En-tête commun à toutes les pages après connexion
function Entete() {
  const navigate = useNavigate()

  // Supprime le jeton : sans lui, l'API refuse toute route protégée.
  function seDeconnecter() {
    deconnecter()
    navigate('/')
  }

  return (
    <header className="entete">
      <Link to="/accueil" className="logo" aria-label="Retour à l'accueil">
        <img src={logoSolstice} alt="Solstice Bank" className="logo-image" />
      </Link>
      <nav className="entete-actions" aria-label="Compte">
        <NavLink to="/carnet" className="lien-profil">
          Carnet
        </NavLink>
        <NavLink to="/profil" className="lien-profil">
          Mon profil
        </NavLink>
        <button type="button" className="bouton bouton-secondaire" onClick={seDeconnecter}>
          Se déconnecter
        </button>
      </nav>
    </header>
  )
}

export default Entete
