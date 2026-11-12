import { useCallback, useEffect, useRef } from "react";

export default function useAccessibleDialog(isOpen, onClose) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  const openDialog = useCallback((trigger) => { triggerRef.current = trigger; }, []);
  const closeDialog = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const animationFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeDialog(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { window.cancelAnimationFrame(animationFrame); document.removeEventListener("keydown", handleKeyDown); };
  }, [closeDialog, isOpen]);

  return { closeButtonRef, closeDialog, dialogRef, openDialog };
}
