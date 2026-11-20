import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from './Button';
import { ErrorNotice } from './Feedback';
import { Field, Textarea } from './Form';
import { useAction } from '@/hooks/useAction';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/** Only the top-most dialog reacts to Escape / Tab, so a confirm on top of a drawer closes alone. */
const stack: symbol[] = [];

function useDialog(open: boolean, onClose: () => void, dismissible: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = useRef(dismissible);
  dismissRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const id = Symbol('dialog');
    stack.push(id);
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const items = () => Array.from(el?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (items()[0] ?? el)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape' && dismissRef.current) { e.preventDefault(); closeRef.current(); }
      if (e.key === 'Tab') {
        const f = items();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);
  return ref;
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Set false while a request is in flight so the dialog can't be dismissed mid-write. */
  dismissible?: boolean;
}

const modalWidth = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' };

export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: OverlayProps & { size?: keyof typeof modalWidth }) {
  const ref = useDialog(open, onClose, dismissible);
  const titleId = useId();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-road-700/50" onClick={dismissible ? onClose : undefined} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={clsx('relative flex max-h-[92vh] w-full animate-fade flex-col rounded-t-xl bg-white shadow-pop sm:rounded-panel', modalWidth[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} disabled={!dismissible} className="-mr-1 rounded p-1 text-ink-muted hover:bg-black/5 disabled:opacity-40"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3 sm:rounded-b-panel">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, description, children, footer, actions, dismissible = true, wide }: OverlayProps & { actions?: ReactNode; wide?: boolean }) {
  const ref = useDialog(open, onClose, dismissible);
  const titleId = useId();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 animate-fade bg-road-700/40" onClick={dismissible ? onClose : undefined} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={clsx('absolute inset-y-0 right-0 flex w-full animate-drawer flex-col bg-white shadow-pop', wide ? 'sm:max-w-[860px]' : 'sm:max-w-[640px]')}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold">{title}</h2>
            {description && <div className="mt-0.5 text-sm text-ink-muted">{description}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button type="button" aria-label="Close panel" onClick={onClose} className="rounded p-1.5 text-ink-muted hover:bg-black/5"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** Ask for a written reason (sent to the API and kept in the audit trail). */
  reason?: { label?: string; min?: number; max?: number; placeholder?: string };
  /** Extra controls rendered between the description and the reason. */
  children?: ReactNode;
  disabled?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
}

/** Destructive and money-moving actions go through this. API errors (409/422...) stay visible inside the dialog. */
export function ConfirmDialog({ open, title, description, confirmLabel, tone = 'primary', reason, children, disabled, onConfirm, onClose }: ConfirmProps) {
  const { run, busy, error, reset } = useAction();
  const [text, setText] = useState('');
  useEffect(() => { if (open) { setText(''); reset(); } }, [open, reset]);
  const min = reason?.min ?? 1;
  const tooShort = !!reason && text.trim().length < min;

  const submit = async () => {
    const r = await run(() => onConfirm(text.trim()));
    if (r.ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title={title} description={description} dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'dangerSolid' : 'primary'} loading={busy} disabled={tooShort || disabled} onClick={submit}>{confirmLabel}</Button>
        </>
      }>
      <div className="space-y-3">
        {children}
        {reason && (
          <Field label={reason.label ?? 'Reason'} required hint={`Recorded in the audit log. At least ${min} characters.`}>
            <Textarea value={text} maxLength={reason.max ?? 1000} placeholder={reason.placeholder} onChange={(e) => setText(e.target.value)} />
          </Field>
        )}
        <ErrorNotice error={error} />
      </div>
    </Modal>
  );
}
