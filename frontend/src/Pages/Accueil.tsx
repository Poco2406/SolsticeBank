import { Link } from 'react-router-dom'

function Accueil() {
  return (
    <main className="page">
      <h1>Accueil</h1>
      <p>Bienvenue sur SolsticeBank.</p>
      <nav className="menu">
        <Link to="/transfert">Faire un transfert</Link>
        <Link to="/historique">Voir l'historique</Link>
        <Link to="/">Se déconnecter</Link>
      </nav>
    </main>
  )
}

export default Accueil
