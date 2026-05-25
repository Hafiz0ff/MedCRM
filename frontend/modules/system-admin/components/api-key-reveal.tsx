'use client';

import { Check, Copy, KeyRound, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type ApiKeyRevealPayload = {
  providerName: string;
  apiKey: string;
  apiKeyPrefix: string;
  reason: 'created' | 'rotated';
};

interface Props {
  payload: ApiKeyRevealPayload | null;
  onClose: () => void;
}

/**
 * One-time-display modal for newly generated API keys. The plaintext key
 * cannot be retrieved again after the modal closes, so the UI strongly
 * emphasises copying and warns about the irreversible exposure window.
 */
export function ApiKeyRevealDialog({ payload, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (payload && !dialog.open) dialog.showModal();
    else if (!payload && dialog.open) dialog.close();
    if (!payload) setCopied(false);
  }, [payload]);

  if (!payload) {
    return <dialog ref={dialogRef} className="confirm-dialog" onClose={onClose} />;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload.apiKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="confirm-dialog" onClose={onClose}>
      <div className="confirm-dialog-content api-key-reveal">
        <div className="confirm-icon confirm-icon-warning">
          <KeyRound size={24} />
        </div>
        <h3>
          {payload.reason === 'rotated' ? 'Ключ обновлён' : 'Ключ выдан'}: {payload.providerName}
        </h3>
        <p>
          <strong>Сохраните ключ сейчас.</strong> После закрытия этого окна полное значение больше
          нигде не отображается — бэкенд хранит только argon2-хэш и sha256-fingerprint.
        </p>

        <div className="api-key-reveal-box">
          <code>{payload.apiKey}</code>
          <button
            type="button"
            className="secondary-button"
            onClick={handleCopy}
            aria-label="Скопировать ключ"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Скопировано' : 'Скопировать'}
          </button>
        </div>

        <div className="api-key-reveal-meta">
          <span>
            <strong>Префикс</strong>
            <code>{payload.apiKeyPrefix}</code>
          </span>
          <span className="muted">Используется в логах и аудите для идентификации ключа</span>
        </div>

        <div className="settings-callout">
          <ShieldAlert size={14} /> Передавайте ключ только по защищённому каналу. Никогда не
          пересылайте по email или мессенджерам.
        </div>

        <div className="confirm-actions">
          <button type="button" className="button" onClick={onClose}>
            Я сохранил ключ
          </button>
        </div>
      </div>
    </dialog>
  );
}
