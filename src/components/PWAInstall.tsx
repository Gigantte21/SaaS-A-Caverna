import { useEffect, useState } from "react";

let deferredPrompt: any;

export default function PWAInstall() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e: any) => {
      e.preventDefault();
      deferredPrompt = e;
      setShow(true);
    });
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShow(false);
    }

    deferredPrompt = null;
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      left: 20,
      right: 20,
      background: "#000",
      color: "#fff",
      padding: 15,
      borderRadius: 10,
      zIndex: 9999
    }}>
      <p>Instalar app no seu celular?</p>
      <button onClick={install}>Instalar</button>
    </div>
  );
}