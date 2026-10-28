import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

function Transfert() {
  const [destinataire, setDestinataire] = useState('')
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // TODO : envoyer le transfert au backend
  }

  return (
    <main className="page">
      <h1>Transfert d'argent</h1>
      <form onSubmit={handleSubmit} className="formulaire">
        <label>
          Destinataire (IBAN)
          <input
            type="text"
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value)}
            required
          />
        </label>
        <label>
          Montant (€)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
          />
        </label>
        <label>
          Motif
          <input
            type="text"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </label>
        <button type="submit">Envoyer</button>
      </form>
      <Link to="/accueil">Retour à l'accueil</Link>
    </main>
  )
}

export default Transfert
