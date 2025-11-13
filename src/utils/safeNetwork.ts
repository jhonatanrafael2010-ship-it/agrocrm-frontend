export async function getNetworkStatus() {
  try {
    const mod = await import("@capacitor/network");
    return await mod.Network.getStatus();
  } catch {
    return { connected: navigator.onLine };
  }
}

export function listenNetworkStatus(callback: (connected: boolean) => void) {
  try {
    import("@capacitor/network").then((mod) => {
      mod.Network.addListener("networkStatusChange", (status: any) => {
        callback(status.connected);
      });
    });
  } catch {
    window.addEventListener("online", () => callback(true));
    window.addEventListener("offline", () => callback(false));
  }
}
