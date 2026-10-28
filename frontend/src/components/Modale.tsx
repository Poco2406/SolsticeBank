import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import './Modale.css'

type Props = {
  ouverte: boolean
  onFermer: () => void
  titre: string
  children: ReactNode
}

// Fenêtre modale : se ferme avec Échap ou en cliquant à côté
function Modale({ ouverte, onFermer, titre, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (ouverte && !dialog.open) dialog.showModal()
    if (!ouverte && dialog.open) dialog.close()
  }, [ouverte])

  return (
    <dialog
      ref={ref}
      className="modale"
      aria-labelledby="modale-titre"
      onClose={onFermer}
      onClick={(e) => {
        // clic sur le fond assombri (en dehors du contenu)
        if (e.target === e.currentTarget) onFermer()
      }}
    >
      <div className="modale-contenu">
        <h2 id="modale-titre">{titre}</h2>
        {children}
      </div>
    </dialog>
  )
}

export default Modale
