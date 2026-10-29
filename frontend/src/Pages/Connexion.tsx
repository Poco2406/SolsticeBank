
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logoSolstice from '../assets/SolsticeBank.png'
import './Connexion.css'
import { Link } from 'react-router-dom'
import { connecter, messageErreur } from '../api'

function Connexion() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      await connecter(email, motDePasse) // le jeton est enregistré par api.ts
      navigate('/accueil')
    } catch (err) {
      setErreur(messageErreur(err)) // ex. « Email ou mot de passe incorrect. »
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className="connexion-page">
      <div className="connexion-container">

        <div className="connexion-logo">
          <img
            src={logoSolstice}
            alt="Solstice Bank"
            className="connexion-logo-image"
          />
        </div>

        <p className="connexion-slogan">
          Votre banque, en toute simplicité.
        </p>

        <section className="connexion-card">
          <h2>Connexion</h2>
          <p className="connexion-subtitle">
            Accédez à votre espace personnel
          </p>

          <form onSubmit={handleSubmit}>
            <div className="connexion-field">
              <label htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                type="email"
                placeholder="exemple@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="connexion-field">
              <label htmlFor="password">Mot de passe</label>

              <div className="connexion-password">
                <input
                  id="password"
                  type={afficherMotDePasse ? 'text' : 'password'}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />

                <button
                  type="button"
                  className="connexion-eye"
                  onClick={() => setAfficherMotDePasse(!afficherMotDePasse)}
                  aria-label={
                    afficherMotDePasse
                      ? 'Masquer le mot de passe'
                      : 'Afficher le mot de passe'
                  }
                >
                  {afficherMotDePasse ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            <div className="connexion-forgot">
              <Link to="/mot-de-passe-oublie">
                Mot de passe oublié ?
              </Link>
            </div>

            {erreur && (
              <p className="connexion-error" role="alert">
                {erreur}
              </p>
            )}

            <button type="submit" className="connexion-submit" disabled={envoi}>
              {envoi ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="connexion-register">
            Vous n'avez pas de compte ?{' '}
            <Link to="/inscription">S'inscrire</Link>
          </p>
        </section>

        <footer className="connexion-footer">
          © 2026 Solstice Bank
        </footer>

      </div>
    </main>
  )
}

export default Connexion
