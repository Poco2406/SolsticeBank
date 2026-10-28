import { Link } from 'react-router-dom'

type Operation = {
  id: number
  date: string
  libelle: string
  montant: number
}

// TODO : remplacer par les opérations récupérées depuis le backend
const operations: Operation[] = []

function Historique() {
  return (
    <main className="page">
      <h1>Historique</h1>
      {operations.length === 0 ? (
        <p>Aucune opération pour le moment.</p>
      ) : (
        <table className="tableau">
          <thead>
            <tr>
              <th>Date</th>
              <th>Libellé</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op) => (
              <tr key={op.id}>
                <td>{op.date}</td>
                <td>{op.libelle}</td>
                <td>{op.montant.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Link to="/accueil">Retour à l'accueil</Link>
    </main>
  )
}

export default Historique
