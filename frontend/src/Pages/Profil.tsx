import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Entete from '../components/Entete'
import {
  lireCompte,
  lireProfil,
  messageErreur,
  modifierProfil,
  type Genre,
  type Profil as ProfilApi,
  type ProfilSaisi,
} from '../api'
import './Inscription.css'
import './Profil.css'

/*
 * Mon profil : consultation (GET /api/me) et modification (PATCH /api/me).
 *  - Seuls les champs modifiés sont envoyés (PATCH partiel, jamais vide).
 *  - La date de naissance n'est plus modifiable une fois renseignée.
 *  - L'email ne se change pas ici (route dédiée à venir).
 * Un compte créé avec l'inscription minimale n'a pas de profil : cette page
 * sert alors à le compléter pour débloquer les fonctions bancaires.
 */

type Formulaire = {
  firstName: string
  lastName: string
  username: string
  gender: Genre
  birthDate: string
  phone: string
  street: string
  complement: string
  postalCode: string
  city: string
  country: string
}

// Profil de l'API → valeurs du formulaire (chaînes vides si non renseigné)
function versFormulaire(p: ProfilApi): Formulaire {
  return {
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    username: p.username ?? '',
    gender: p.gender,
    birthDate: p.birthDate ?? '',
    phone: p.phone ?? '',
    street: p.address?.street ?? '',
    complement: p.address?.complement ?? '',
    postalCode: p.address?.postalCode ?? '',
    city: p.address?.city ?? '',
    country: p.address?.country ?? '',
  }
}

const CHAMPS_SIMPLES = ['firstName', 'lastName', 'username', 'gender', 'phone'] as const
const CHAMPS_ADRESSE = ['street', 'complement', 'postalCode', 'city', 'country'] as const

// Corps du PATCH : uniquement ce qui a changé. L'adresse est envoyée en entier
// dès qu'une de ses parties change (le back attend l'objet complet).
function champsModifies(avant: Formulaire, apres: Formulaire, naissanceFigee: boolean) {
  const corps: Partial<ProfilSaisi> = {}
  for (const champ of CHAMPS_SIMPLES) {
    if (apres[champ].trim() !== avant[champ].trim()) {
      Object.assign(corps, { [champ]: apres[champ].trim() })
    }
  }
  if (!naissanceFigee && apres.birthDate !== avant.birthDate && apres.birthDate) {
    corps.birthDate = apres.birthDate
  }
  if (CHAMPS_ADRESSE.some((champ) => apres[champ].trim() !== avant[champ].trim())) {
    corps.address = {
      street: apres.street.trim(),
      complement: apres.complement.trim() || null,
      postalCode: apres.postalCode.trim(),
      city: apres.city.trim(),
      country: apres.country.trim(),
    }
  }
  return corps
}

// Mêmes règles que le back : on prévient avant l'envoi.
function verifier(corps: Partial<ProfilSaisi>): string | null {
  if (corps.firstName !== undefined && !corps.firstName) return 'Le prénom ne peut pas être vide.'
  if (corps.lastName !== undefined && !corps.lastName) return 'Le nom ne peut pas être vide.'
  if (corps.username !== undefined && !/^[a-zA-Z0-9._-]{3,30}$/.test(corps.username)) {
    return 'Le pseudo doit contenir 3 à 30 caractères : lettres, chiffres, . _ -'
  }
  if (corps.phone !== undefined && !/^\+[1-9]\d{6,14}$/.test(corps.phone)) {
    return 'Utilisez un numéro international, ex. +33612345678.'
  }
  if (corps.address) {
    const { street, postalCode, city, country } = corps.address
    if (!street || !postalCode || !city || !country) {
      return "L'adresse doit être complète : rue, code postal, ville et pays."
    }
  }
  return null
}

function Profil() {
  const [profil, setProfil] = useState<ProfilApi | null>(null)
  const [form, setForm] = useState<Formulaire | null>(null)
  const [iban, setIban] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')

  // Date maximale pour avoir au moins 18 ans (si la date reste à renseigner)
  const aujourdHui = new Date()
  const dateMax = `${aujourdHui.getFullYear() - 18}-${String(aujourdHui.getMonth() + 1).padStart(2, '0')}-${String(aujourdHui.getDate()).padStart(2, '0')}`

  useEffect(() => {
    lireProfil()
      .then((p) => {
        setProfil(p)
        setForm(versFormulaire(p))
      })
      .catch((err) => setErreur(messageErreur(err)))
      .finally(() => setChargement(false))

    // Le compte bancaire est facultatif pour cette page
    lireCompte()
      .then((compte) => setIban(compte.iban))
      .catch(() => {})
  }, [])

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((ancien) => (ancien ? { ...ancien, [name]: value } : ancien))
    setErreur('')
    setSucces('')
  }

  function annuler() {
    if (profil) setForm(versFormulaire(profil))
    setErreur('')
    setSucces('')
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profil || !form) return

    setErreur('')
    setSucces('')

    const corps = champsModifies(versFormulaire(profil), form, profil.birthDate !== null)
    if (Object.keys(corps).length === 0) {
      setSucces('Aucune modification à enregistrer.')
      return
    }

    const probleme = verifier(corps)
    if (probleme) {
      setErreur(probleme)
      return
    }

    setEnvoi(true)
    try {
      const misAJour = await modifierProfil(corps)
      setProfil(misAJour)
      setForm(versFormulaire(misAJour))
      setSucces(
        misAJour.profileComplete && !profil.profileComplete
          ? 'Profil complété : les fonctions bancaires sont débloquées.'
          : 'Vos informations ont été mises à jour.',
      )
    } catch (err) {
      // ex. « Ce pseudo est déjà utilisé. », date de naissance mineure…
      setErreur(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  const modifie =
    profil && form
      ? Object.keys(champsModifies(versFormulaire(profil), form, profil.birthDate !== null)).length > 0
      : false

  return (
    <div className="page-app">
      <Entete />

      <main className="contenu profil">
        <div className="profil-titre apparition">
          <h1>Mon profil</h1>
          <p>Consultez et modifiez vos informations personnelles.</p>
        </div>

        {chargement && <p className="profil-message" role="status">Chargement de votre profil…</p>}

        {!chargement && !form && erreur && (
          <p className="inscription-error" role="alert">{erreur}</p>
        )}

        {profil && form && (
          <section className="inscription-card apparition">
            {!profil.profileComplete && (
              <p className="profil-incomplet" role="status">
                Votre profil est incomplet. Renseignez toutes les informations
                marquées d'un * pour accéder aux dépôts, retraits, virements et à
                l'historique.
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <fieldset className="inscription-section">
                <legend>01 — Compte</legend>

                <div className="inscription-grid">
                  <div className="inscription-field">
                    <label htmlFor="email">Adresse e-mail</label>
                    <input id="email" value={profil.email} readOnly aria-describedby="email-aide" />
                    <small id="email-aide">L'adresse e-mail ne se modifie pas depuis cette page.</small>
                  </div>

                  {iban && (
                    <div className="inscription-field">
                      <label htmlFor="iban">IBAN</label>
                      <input id="iban" value={iban.replace(/(.{4})/g, '$1 ').trim()} readOnly />
                      <small>À transmettre pour recevoir un virement.</small>
                    </div>
                  )}
                </div>
              </fieldset>

              <fieldset className="inscription-section">
                <legend>02 — Informations personnelles</legend>

                <div className="inscription-grid">
                  <div className="inscription-field">
                    <label htmlFor="firstName">Prénom *</label>
                    <input
                      id="firstName"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      maxLength={60}
                      autoComplete="given-name"
                    />
                  </div>

                  <div className="inscription-field">
                    <label htmlFor="lastName">Nom *</label>
                    <input
                      id="lastName"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      maxLength={60}
                      autoComplete="family-name"
                    />
                  </div>

                  <div className="inscription-field">
                    <label htmlFor="username">Pseudo *</label>
                    <input
                      id="username"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      maxLength={30}
                      autoComplete="username"
                    />
                    <small>Visible dans l'annuaire. Lettres, chiffres, . _ -</small>
                  </div>

                  <div className="inscription-field">
                    <label htmlFor="gender">Genre</label>
                    <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
                      <option value="unspecified">Non précisé</option>
                      <option value="female">Femme</option>
                      <option value="male">Homme</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>

                  <div className="inscription-field">
                    <label htmlFor="birthDate">Date de naissance *</label>
                    {profil.birthDate ? (
                      <>
                        <input
                          id="birthDate"
                          value={new Date(`${profil.birthDate}T00:00:00`).toLocaleDateString('fr-FR')}
                          readOnly
                        />
                        <small>Non modifiable une fois renseignée.</small>
                      </>
                    ) : (
                      <>
                        <input
                          id="birthDate"
                          name="birthDate"
                          type="date"
                          value={form.birthDate}
                          onChange={handleChange}
                          max={dateMax}
                        />
                        <small>Vous devez avoir au moins 18 ans. Elle ne pourra plus être modifiée.</small>
                      </>
                    )}
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
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="inscription-section">
                <legend>03 — Adresse postale</legend>

                <div className="inscription-field">
                  <label htmlFor="street">Numéro et rue *</label>
                  <input
                    id="street"
                    name="street"
                    value={form.street}
                    onChange={handleChange}
                    maxLength={120}
                    autoComplete="street-address"
                  />
                </div>

                <div className="inscription-field">
                  <label htmlFor="complement">Complément d'adresse</label>
                  <input
                    id="complement"
                    name="complement"
                    value={form.complement}
                    onChange={handleChange}
                    maxLength={120}
                    placeholder="Bâtiment, appartement… (facultatif)"
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
                      maxLength={12}
                      autoComplete="postal-code"
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
                    maxLength={80}
                    autoComplete="country-name"
                  />
                </div>
              </fieldset>

              {erreur && (
                <p className="inscription-error" role="alert">{erreur}</p>
              )}
              {succes && (
                <p className="inscription-success" role="status">{succes}</p>
              )}

              <div className="profil-actions">
                <button
                  type="button"
                  className="bouton bouton-secondaire"
                  onClick={annuler}
                  disabled={!modifie || envoi}
                >
                  Annuler les modifications
                </button>
                <button className="inscription-submit" type="submit" disabled={envoi}>
                  {envoi ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </section>
        )}

        <Link to="/accueil" className="lien-retour apparition">
          ← Retour à l'accueil
        </Link>
      </main>
    </div>
  )
}

export default Profil
