export const senderJids = ({ isGroup, participant, participantAlt, remoteJid, remoteJidAlt }) =>
  isGroup ? [participant, participantAlt] : [remoteJid, remoteJidAlt];
