export const formatPairingCode = (code) => code.match(/.{1,4}/g)?.join("-") ?? code;
