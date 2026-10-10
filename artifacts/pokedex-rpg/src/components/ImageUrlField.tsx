import { useEffect, useState, type MouseEvent, type PointerEvent } from 'react';
import { Camera, ImagePlus, Link2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Props = {
  value?: string | null;
  onChange: (value: string) => void;
  label: string;
  className: string;
  imageClassName?: string;
  disabled?: boolean;
  compact?: boolean;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function isExternalImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.startsWith('data:')) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function ImageUrlField({
  value,
  onChange,
  label,
  className,
  imageClassName = 'h-full w-full object-contain',
  disabled = false,
  compact = false,
  onPointerDown,
  onClick,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const currentUrl = isExternalImageUrl(value) ? value : '';
  const draftIsValid = isExternalImageUrl(draft.trim());

  useEffect(() => {
    setLoadFailed(false);
  }, [currentUrl]);

  const changeOpen = (next: boolean) => {
    if (next) setDraft(currentUrl);
    setOpen(next);
  };

  const save = () => {
    const next = draft.trim();
    if (next && !isExternalImageUrl(next)) return;
    onChange(next);
    setOpen(false);
  };

  return <>
    <button
      type="button"
      disabled={disabled}
      onPointerDown={event => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
      onClick={event => {
        event.stopPropagation();
        onClick?.(event);
        if (!disabled) changeOpen(true);
      }}
      aria-label={currentUrl ? `Trocar imagem: ${label}` : `Adicionar link de imagem: ${label}`}
      title={currentUrl ? 'Clique para trocar o link da imagem' : 'Clique para adicionar um link de imagem'}
      className={`group relative overflow-hidden ${className} ${disabled ? 'cursor-default' : 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'}`}
      data-testid={`image-url-field-${label.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-')}`}
    >
      {currentUrl && !loadFailed
        ? <img src={currentUrl} alt={label} loading="lazy" className={imageClassName} onError={() => setLoadFailed(true)} />
        : <span className={`flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground ${compact ? '' : 'p-3'}`}>
          {compact ? <ImagePlus size={20} aria-hidden="true" /> : <Camera size={compact ? 17 : 28} aria-hidden="true" />}
          {!compact && <span className="text-center text-xs">{loadFailed ? 'Link indisponível' : currentUrl ? 'Não foi possível carregar' : 'Imagem sem link'}</span>}
        </span>}
      {!disabled && <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100">
        <Link2 size={compact ? 15 : 20} aria-hidden="true" />
      </span>}
    </button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{currentUrl ? 'Trocar imagem' : 'Adicionar imagem'}</DialogTitle>
          <DialogDescription>{label}. Cole o link HTTPS direto da imagem do Postimages, sem enviar o arquivo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            type="url"
            inputMode="url"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && (!draft.trim() || draftIsValid)) save(); }}
            placeholder="https://i.postimg.cc/.../imagem.jpg"
            aria-label="Link direto da imagem"
            data-testid="input-image-url"
          />
          {draft.trim() !== '' && !draftIsValid && <p className="text-xs text-destructive">Informe um link HTTPS válido. Use o link direto da imagem no Postimages.</p>}
          {draftIsValid && <div className="flex max-h-36 justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-2"><img src={draft.trim()} alt="Prévia do link" className="max-h-32 max-w-full object-contain" /></div>}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {currentUrl && <Button type="button" variant="ghost" onClick={() => { onChange(''); setOpen(false); }} className="mr-auto text-destructive"><X size={15} className="mr-1" /> Remover link</Button>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={save} disabled={Boolean(draft.trim()) && !draftIsValid}>Usar link</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
