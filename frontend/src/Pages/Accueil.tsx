import { Link } from 'react-router-dom'
import './Accueil.css'

// TODO : remplacer par les données du client récupérées depuis le backend
const client = {
  prenom: 'Client',
  solde: 0,
}

function Accueil() {
  return (
    <div className="accueil">
      <header className="entete">
        <span className="logo">SolsticeBank</span>
        <Link to="/" className="bouton bouton-secondaire">
          Se déconnecter
        </Link>
      </header>

      <main className="accueil-contenu">
        <h1>Bonjour {client.prenom}</h1>

        <section className="carte-solde">
          <p className="carte-solde-titre">Solde du compte</p>
          <p className="carte-solde-montant">
            {client.solde.toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            })}
          </p>
        </section>

        <section className="actions">
          <Link to="/transfert" className="bouton">
            Faire un transfert
          </Link>
          <Link to="/historique" className="bouton bouton-secondaire">
            Voir l'historique
          </Link>
        </section>

        <section className="encadre">
          <h2>Dernières opérations</h2>
          {/* TODO : afficher les dernières opérations depuis le backend */}
          <p className="vide">Aucune opération pour le moment.</p>
        </section>
      </main>
    </div>
  )
}

export default Accueil
