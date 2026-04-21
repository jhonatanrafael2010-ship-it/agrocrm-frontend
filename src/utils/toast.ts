import { toast } from "sonner";

export const notify = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
  info: (msg: string) => toast.info(msg),
  warning: (msg: string) => toast.warning(msg),
  loading: (msg: string) => toast.loading(msg),
  promise: toast.promise,
};

export function confirm(
  message: string,
  onConfirm: () => void | Promise<void>,
  opts?: { confirmLabel?: string; cancelLabel?: string }
) {
  toast(message, {
    action: {
      label: opts?.confirmLabel ?? "Confirmar",
      onClick: () => onConfirm(),
    },
    cancel: {
      label: opts?.cancelLabel ?? "Cancelar",
      onClick: () => {},
    },
    duration: 8000,
  });
}
