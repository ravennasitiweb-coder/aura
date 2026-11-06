// Messaggi per i codici di errore SBxxx delle funzioni pubbliche del database
export const PUBLIC_ERRORS: Record<string, string> = {
  SB001: "Questo servizio non è più prenotabile. Ricarica la pagina.",
  SB002: "Questo operatore non è più disponibile. Scegli un altro orario.",
  SB010: "Devi accettare l'informativa sulla privacy.",
  SB011: "Scrivi il tuo nome (almeno 2 caratteri).",
  SB012: "Controlla il numero di telefono.",
  SB013: "Controlla l'indirizzo email.",
  SB020: "Questa attività non esiste più.",
  SB021: "L'orario scelto è troppo vicino o già passato. Scegline un altro.",
  SB022: "Si può prenotare al massimo 90 giorni in anticipo.",
  SB023: "L'orario scelto non è più disponibile. Scegline un altro.",
  SB024: "Hai già 3 prenotazioni o iscrizioni in arrivo qui. Per altre, contatta direttamente l'attività.",
  SB025: "In quell'orario l'operatore è assente. Scegline un altro.",
  SB030: "Indica quante persone siete.",
  SB031: "Nessun tavolo libero per questo numero di persone a quell'ora. Prova un altro orario o chiama il locale.",
  SB026: "Non è più possibile modificare questo appuntamento online. Contatta direttamente l'attività.",
};
