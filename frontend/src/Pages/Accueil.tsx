import { Link } from 'react-router-dom'

function Accueil() {
  return (
    <main className="page">
      <h1>Accueil</h1>
      <p>Bienvenue sur SolsticeBank.</p>
      <Link to="/">Se déconnecter</Link>
    </main>
  )
}

export default Accueil
