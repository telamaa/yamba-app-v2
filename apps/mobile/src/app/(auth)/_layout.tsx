/**
 * (auth)/_layout.tsx — la pile des écrans d'authentification (lot auth mobile).
 * =============================================================================
 * Le groupe entier est présenté en UNE feuille modale (déclaré au layout
 * racine) ; à l'intérieur, sa propre pile native enchaîne les étapes —
 * connexion → inscription → code, ou connexion → oubli → code → nouveau mot
 * de passe — avec le geste de retour de chaque OS. Le motif de la référence :
 * l'auth est une parenthèse au-dessus de l'app, jamais une destination.
 * Les en-têtes sont ceux des écrans (gabarit `AuthScreen`), pas ceux du
 * navigateur. Le groupe ne change pas les chemins : `/login` reste `/login`.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
