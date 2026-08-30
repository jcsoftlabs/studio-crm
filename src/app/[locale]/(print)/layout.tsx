import './ticket.css';

/**
 * Le gabarit racine `[locale]/layout.tsx` fournit déjà <html> et <body> :
 * ce groupe ne fait qu'écarter la sidebar et l'en-tête, et charger le CSS papier.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
