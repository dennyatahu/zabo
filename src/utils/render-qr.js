import qrcode from "qrcode-terminal";

export const renderQr = (qr) =>
  new Promise((resolve) => {
    qrcode.generate(qr, { small: true }, resolve);
  });
