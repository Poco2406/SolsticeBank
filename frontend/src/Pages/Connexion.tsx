import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

function Connexion() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // TODO : vérifier les identifiants auprès du backend
    navigate('/accueil')
  }

  return (
    <main className="page">
      <h1>Connexion</h1>
      <form onSubmit={handleSubmit} className="formulaire">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
        </label>
        <button type="submit">Se connecter</button>
      </form>
    </main>
  )
}

export default Connexion
