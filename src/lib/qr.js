// QR code rendering and pairing-code formatting for auth events.
// qrcode-terminal renders the QR to a string for terminal display.

import qrcode from "qrcode-terminal";

export const formatPairingCode = (code) => code.match(/.{1,4}/g)?.join("-") ?? code;

export const renderQr = (qr) =>
  new Promise((resolve) => {
    qrcode.generate(qr, { small: true }, resolve);
  });
