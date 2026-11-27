/**
 * publish-trip/_layout.tsx — la pile du tunnel de publication.
 * ========================================================
 * Sept écrans poussés l'un après l'autre, par-dessus les onglets : on termine
 * ou on quitte, ce n'est pas une destination où l'on navigue (même parti pris
 * que `booking/`). Pas d'en-tête natif : chaque écran porte le sien, avec sa
 * jauge et ses trois phases.
 */
import { Stack } from 'expo-router';

export default function PublishLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
