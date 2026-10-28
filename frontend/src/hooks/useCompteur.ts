import { useEffect, useState } from 'react'

// Fait défiler un nombre de 0 jusqu'à `cible` en `duree` millisecondes
export function useCompteur(cible: number, duree = 1000) {
  const [valeur, setValeur] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => setValeur(cible))
      return () => cancelAnimationFrame(id)
    }

    let id = 0
    const debut = performance.now()

    function etape(maintenant: number) {
      const progression = Math.min((maintenant - debut) / duree, 1)
      // ralentit en fin d'animation
      const adouci = 1 - Math.pow(1 - progression, 3)
      setValeur(cible * adouci)
      if (progression < 1) id = requestAnimationFrame(etape)
    }

    id = requestAnimationFrame(etape)
    return () => cancelAnimationFrame(id)
  }, [cible, duree])

  return valeur
}
