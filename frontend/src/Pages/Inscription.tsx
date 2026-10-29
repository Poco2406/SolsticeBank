
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoSolstice from '../assets/SolsticeBank.png'
import './Inscription.css'
import { inscrire, messageErreur } from '../api'
import type { Genre } from '../api'

type FormData = {
  firstName: string
  lastName: string
  username: string
  gender: string
  birthDate: string
  phone: string
  street: string
  complement: string
  postalCode: string
  city: string
  country: string
  email: string
  password: string
  confirmPassword: string
}

const initialForm: FormData = {
  firstName: '',
  lastName: '',
  username: '',
  gender: 'unspecified',
  birthDate: '',
  phone: '',
  street: '',
  complement: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
  password: '',
  confirmPassword: '',
}

// Vérifie que la date est valide et que l'utilisateur a 18 ans
function estMajeur(dateTexte: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTexte)) {
    return false
  }

  const [annee, mois, jour] = dateTexte.split('-').map(Number)
  const naissance = new Date(annee, mois - 1, jour)

  if (
    naissance.getFullYear() !== annee ||
    naissance.getMonth() !== mois - 1 ||
    naissance.getDate() !== jour
  ) {
    return false
  }

  const aujourdHui = new Date()
  let age = aujourdHui.getFullYear() - annee

  if (
    aujourdHui.getMonth() + 1 < mois ||
    (
      aujourdHui.getMonth() + 1 === mois &&
      aujourdHui.getDate() < jour
    )
  ) {
    age--
  }

  return age >= 18
}

function Inscription() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const navigate = useNavigate()
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false)

  // Date maximale pour avoir au moins 18 ans
  const aujourdHui = new Date()
  const anneeLimite = aujourdHui.getFullYear() - 18
  const moisLimite = String(aujourdHui.getMonth() + 1).padStart(2, '0')
  const jourLimite = String(aujourdHui.getDate()).padStart(2, '0')
  const dateMax = `${anneeLimite}-${moisLimite}-${jourLimite}`

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target

    setForm((ancien) => ({
      ...ancien,
      [name]: value,
    }))

    setErreur('')
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur('')

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErreur('Veuillez renseigner votre prénom et votre nom.')
      return
    }

    // Même règle que le backend
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim())) {
      setErreur(
        'Le pseudo doit contenir entre 3 et 30 caractères : lettres, chiffres, . _ -',
      )
      return
    }

    if (!estMajeur(form.birthDate)) {
      setErreur('Vous devez avoir au moins 18 ans pour vous inscrire.')
      return
    }

    if (!/^\+[1-9]\d{6,14}$/.test(form.phone.trim())) {
      setErreur('Utilisez un numéro international, ex. +33612345678.')
      return
    }

    if (!form.street.trim() || form.street.trim().length > 120) {
      setErreur('La rue est obligatoire (120 caractères maximum).')
      return
    }

    if (form.complement.length > 120) {
      setErreur('Le complément ne doit pas dépasser 120 caractères.')
      return
    }

    if (
      form.postalCode.trim().length < 2 ||
      form.postalCode.trim().length > 12
    ) {
      setErreur('Le code postal doit contenir entre 2 et 12 caractères.')
      return
    }

    if (
      form.city.trim().length < 1 ||
      form.city.trim().length > 80
    ) {
      setErreur('La ville doit contenir entre 1 et 80 caractères.')
      return
    }

    if (
      form.country.trim().length < 2 ||
      form.country.trim().length > 80
    ) {
      setErreur('Le pays doit contenir entre 2 et 80 caractères.')
      return
    }

    if (form.password.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setErreur('Les mots de passe ne correspondent pas.')
      return
    }

    setEnvoi(true)
    try {
      // Le jeton est enregistré par api.ts : l'utilisateur est connecté
      await inscrire(form.email.trim(), form.password, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        gender: form.gender as Genre,
        birthDate: form.birthDate,
        phone: form.phone.trim(),
        address: {
          street: form.street.trim(),
          complement: form.complement.trim() || null,
          postalCode: form.postalCode.trim(),
          city: form.city.trim(),
          country: form.country.trim(),
        },
      })
      navigate('/accueil')
    } catch (err) {
      setErreur(messageErreur(err)) // ex. « Cet email est déjà utilisé. »
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className="inscription-page">
      <div className="inscription-container">

        <header className="inscription-header">
          <img
            src={logoSolstice}
            alt="Solstice Bank"
            className="inscription-logo"
          />
          <h1>Créer un compte</h1>
          <p>Rejoignez Solstice Bank en quelques étapes.</p>
        </header>

        <section className="inscription-card">
          <form onSubmit={handleSubmit}>

            <fieldset className="inscription-section">
              <legend>01 — Informations personnelles</legend>

              <div className="inscription-grid">
                <div className="inscription-field">
                  <label htmlFor="firstName">Prénom *</label>
                  <input
                    id="firstName"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Votre prénom"
                    autoComplete="given-name"
                    required
                  />
                </div>

                <div className="inscription-field">
                  <label htmlFor="lastName">Nom *</label>
                  <input
                    id="lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Votre nom"
                    autoComplete="family-name"
                    required
                  />
                </div>

                <div className="inscription-field">
                  <label htmlFor="username">Pseudo *</label>
                  <input
                    id="username"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9._\-]{3,30}"
                    placeholder="3 à 30 caractères"
                    autoComplete="username"
                    required
                  />
                  <small>Lettres, chiffres, point, tiret et tiret bas. Visible dans l'annuaire.</small>
                </div>

                <div className="inscription-field">
                  <label htmlFor="gender">Genre</label>
                  <select
                    id="gender"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                  >
                    <option value="unspecified">Non précisé</option>
                    <option value="female">Femme</option>
                    <option value="male">Homme</option>
                    <option value="other">Autre</option>
                  </select>
                </div>

                <div className="inscription-field">
                  <label htmlFor="birthDate">Date de naissance *</label>
                  <input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    value={form.birthDate}
                    onChange={handleChange}
                    max={dateMax}
                    required
                  />
                  <small>Vous devez avoir au moins 18 ans.</small>
                </div>

                <div className="inscription-field">
                  <label htmlFor="phone">Téléphone *</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+33612345678"
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="inscription-section">
              <legend>02 — Adresse postale</legend>

              <div className="inscription-field">
                <label htmlFor="street">Numéro et rue *</label>
                <input
                  id="street"
                  name="street"
                  value={form.street}
                  onChange={handleChange}
                  maxLength={120}
                  placeholder="12 rue des Lilas"
                  autoComplete="street-address"
                  required
                />
              </div>

              <div className="inscription-field">
                <label htmlFor="complement">
                  Complément d'adresse
                </label>
                <input
                  id="complement"
                  name="complement"
                  value={form.complement}
                  onChange={handleChange}
                  maxLength={120}
                  placeholder="Bâtiment, appartement... (facultatif)"
                />
              </div>

              <div className="inscription-grid">
                <div className="inscription-field">
                  <label htmlFor="postalCode">Code postal *</label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    value={form.postalCode}
                    onChange={handleChange}
                    minLength={2}
                    maxLength={12}
                    autoComplete="postal-code"
                    required
                  />
                </div>

                <div className="inscription-field">
                  <label htmlFor="city">Ville *</label>
                  <input
                    id="city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    maxLength={80}
                    autoComplete="address-level2"
                    required
                  />
                </div>
              </div>

              <div className="inscription-field">
                <label htmlFor="country">Pays *</label>
                <input
                  id="country"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  minLength={2}
                  maxLength={80}
                  autoComplete="country-name"
                  required
                />
              </div>
            </fieldset>

            <fieldset className="inscription-section">
              <legend>03 — Sécurité du compte</legend>

              <div className="inscription-field">
                <label htmlFor="email">Adresse e-mail *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="exemple@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="inscription-grid">
                <div className="inscription-field">
                  <label htmlFor="password">Mot de passe *</label>
                  <input
                    id="password"
                    name="password"
                    type={afficherMotDePasse ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="8 caractères minimum"
                    required
                  />
                </div>

                <div className="inscription-field">
                  <label htmlFor="confirmPassword">
                    Confirmer le mot de passe *
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={afficherMotDePasse ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <label className="inscription-checkbox">
                <input
                  type="checkbox"
                  checked={afficherMotDePasse}
                  onChange={(e) =>
                    setAfficherMotDePasse(e.target.checked)
                  }
                />
                Afficher les mots de passe
              </label>
            </fieldset>

            {erreur && (
              <p className="inscription-error" role="alert">
                {erreur}
              </p>
            )}

            <button className="inscription-submit" type="submit" disabled={envoi}>
              {envoi ? 'Création du compte…' : 'Créer mon compte'}
            </button>

            <p className="inscription-login">
              Déjà un compte ? <Link to="/">Se connecter</Link>
            </p>
          </form>
        </section>

        <footer className="inscription-footer">
          © 2026 Solstice Bank
        </footer>

      </div>
    </main>
  )
}

export default Inscription
