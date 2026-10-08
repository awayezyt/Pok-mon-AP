import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowUpRight, BookMarked, BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText, Menu, Search, ShieldCheck, X } from 'lucide-react';
import systemData from '../data/pokemonSystem.json';

type RichRun = [string, unknown[]?];
type SystemBlock = {
  id: string;
  type: string;
  text: string;
  properties?: Record<string, unknown>;
  format?: Record<string, unknown>;
  richText?: RichRun[] | null;
  children?: SystemBlock[];
};
type SystemDocument = {
  id: string;
  title: string;
  navTitle: string;
  section: string;
  subsection: string | null;
  kind: string;
  sourceUrl?: string;
  references: { section: string; label: string; subsection: string | null; icon?: string | null }[];
  blocks: SystemBlock[];
};

type SystemGroup = {
  title: string | null;
  documentIds?: string[];
  groups?: SystemGroup[];
};

const sourceData = systemData as {
  root: { title: string };
  sections: { id: string; title: string; groups: SystemGroup[] }[];
  documents: Omit<SystemDocument, 'blocks'>[];
  idAliases?: Record<string, string>;
};
const blockFiles = import.meta.glob('../data/pokemonSystemBlocks/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, SystemBlock[]>;
const blocksById = new Map(Object.entries(blockFiles).map(([path, blocks]) => [
  path.split('/').pop()?.replace(/\.json$/, '') || '',
  blocks,
]));
const data = {
  ...sourceData,
  documents: sourceData.documents.map(document => ({
    ...document,
    blocks: blocksById.get(document.id) || [],
  })),
};
const documentById = new Map(data.documents.map(document => [document.id, document]));

function plainRuns(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map(part => Array.isArray(part) ? String(part[0] ?? '') : '').join('');
}

function blockSearchText(blocks: SystemBlock[]): string {
  return blocks.map(block => `${block.text || ''} ${blockSearchText(block.children || [])}`).join(' ');
}

function richValue(block: SystemBlock): unknown {
  return block.properties?.title ?? block.richText ?? (block.text ? [[block.text]] : []);
}

function documentIdsIn(groups: SystemGroup[]): string[] {
  return groups.flatMap(group => [
    ...(group.documentIds || []),
    ...documentIdsIn(group.groups || []),
  ]);
}

function RichText({ value, onInternal }: { value: unknown; onInternal: (url: string) => string | undefined }) {
  if (!Array.isArray(value)) return <>{typeof value === 'string' ? value : ''}</>;
  return <>{value.map((part, index) => {
    if (!Array.isArray(part)) return null;
    const text = String(part[0] ?? '');
    const annotations = Array.isArray(part[1]) ? part[1] as unknown[][] : [];
    const styles = new Set(annotations.map(annotation => String(annotation[0])));
    const link = annotations.find(annotation => annotation[0] === 'a')?.[1];
    let child: ReactNode = text;
    if (styles.has('b')) child = <strong>{child}</strong>;
    if (styles.has('i')) child = <em>{child}</em>;
    if (styles.has('s')) child = <s>{child}</s>;
    if (styles.has('c')) child = <code className="system-inline-code">{child}</code>;
    if (styles.has('u')) child = <span className="underline underline-offset-2">{child}</span>;
    if (link) {
      const href = String(link);
      const internalId = onInternal(href);
      child = internalId
        ? <button type="button" className="system-text-link" onClick={() => window.dispatchEvent(new CustomEvent('system-open-document', { detail: internalId }))} data-testid={`button-system-inline-link-${index}`}>{child}</button>
        : href.startsWith('/')
          ? <span>{child}</span>
          : /(^|\.)notion\.so\/|app\.notion\.com\//i.test(href)
            ? <span>{child}</span>
            : <a className="system-text-link" href={href} target="_blank" rel="noreferrer" aria-label={text}>{child}<ExternalLink className="ml-1 inline" size={12} /></a>;
    }
    return <span key={index}>{child}</span>;
  })}</>;
}

function RenderBlocks({ blocks, onInternal }: { blocks: SystemBlock[]; onInternal: (url: string) => string | undefined }) {
  const rendered: ReactNode[] = [];
  for (let index = 0; index < blocks.length;) {
    const first = blocks[index];
    if (first.type === 'bulleted_list_item' || first.type === 'numbered_list_item') {
      const listType = first.type;
      const items: SystemBlock[] = [];
      while (index < blocks.length && blocks[index].type === listType) {
        items.push(blocks[index]);
        index += 1;
      }
      const List = listType === 'numbered_list_item' ? 'ol' : 'ul';
      rendered.push(<List key={`${first.id}-list`} className={`system-list ${listType === 'numbered_list_item' ? 'system-ordered' : ''}`} data-testid={`system-list-${first.id}`}>
        {items.map(item => <li key={item.id}>
          <RichText value={richValue(item)} onInternal={onInternal} />
          {item.children?.length ? <div className="system-list-nested"><RenderBlocks blocks={item.children} onInternal={onInternal} /></div> : null}
        </li>)}
      </List>);
      continue;
    }
    rendered.push(<BlockRenderer key={first.id} block={first} onInternal={onInternal} />);
    index += 1;
  }
  return <>{rendered}</>;
}

function BlockRenderer({ block, onInternal }: { block: SystemBlock; onInternal: (url: string) => string | undefined }) {
  const children = block.children || [];
  const body = <RichText value={richValue(block)} onInternal={onInternal} />;
  const renderChildren = () => <RenderBlocks blocks={children} onInternal={onInternal} />;
  switch (block.type) {
    case 'text':
    case 'paragraph':
      return <div className={`system-paragraph ${block.text ? '' : 'system-blank-line'}`} data-testid={`system-block-${block.id}`}>{body}{children.length > 0 && renderChildren()}</div>;
    case 'heading_1':
      return <h2 className="system-heading system-heading-one" id={`heading-${block.id}`} data-testid={`system-heading-${block.id}`}>{body}</h2>;
    case 'heading_2':
    case 'sub_header':
      return <h2 className="system-heading system-heading-two" id={`heading-${block.id}`} data-testid={`system-heading-${block.id}`}>{body}</h2>;
    case 'heading_3':
    case 'sub_sub_header':
      return <h3 className="system-heading system-heading-three" id={`heading-${block.id}`} data-testid={`system-heading-${block.id}`}>{body}</h3>;
    case 'bulleted_list':
    case 'numbered_list': {
      const List = block.type === 'numbered_list' ? 'ol' : 'ul';
      return <List className={`system-list ${block.type === 'numbered_list' ? 'system-ordered' : ''}`} data-testid={`system-block-${block.id}`}>
        <li><div>{body}</div>{children.length > 0 && <div className="system-list-nested">{renderChildren()}</div>}</li>
      </List>;
    }
    case 'to_do':
      return <label className="system-todo" data-testid={`system-block-${block.id}`}><input type="checkbox" checked={Boolean(block.properties?.checked)} disabled /><span>{body}</span></label>;
    case 'callout': {
      const icon = block.format?.icon as { type?: string; emoji?: string; custom_emoji?: { url?: string; name?: string }; external?: { url?: string } } | undefined;
      const iconUrl = icon?.custom_emoji?.url || icon?.external?.url;
      return <aside className="system-callout" data-testid={`system-block-${block.id}`}>
        <div className="system-callout-mark">{iconUrl ? <img src={iconUrl} alt={icon?.custom_emoji?.name || ''} loading="lazy" /> : icon?.emoji ? <span>{icon.emoji}</span> : <BookOpen size={16} />}</div>
        <div className="min-w-0 flex-1">{block.text && <p>{body}</p>}{renderChildren()}</div>
      </aside>;
    }
    case 'toggle':
      return <details className="system-toggle" data-testid={`system-toggle-${block.id}`}><summary>{body}<ChevronDown size={16} /></summary><div className="system-toggle-content">{renderChildren()}</div></details>;
    case 'divider':
      return <hr className="system-divider" data-testid={`system-block-${block.id}`} />;
    case 'quote':
      return <blockquote className="system-quote" data-testid={`system-block-${block.id}`}>{body}{renderChildren()}</blockquote>;
    case 'table': {
      const rows = children.filter(child => child.type === 'table_row');
      const order = (block.format?.table_block_column_order as string[] | undefined) || Object.keys(rows[0]?.properties || {});
      const headers = Boolean(block.format?.table_block_column_header);
      const rowHeaders = Boolean(block.format?.table_block_row_header);
      const columnWidths = block.format?.table_block_column_format as Record<string, { width?: number }> | undefined;
      return <div className="system-table-wrap" data-testid={`system-table-${block.id}`}><table className="system-table"><tbody>{rows.map((row, rowIndex) => <tr key={row.id}>{order.map((column, colIndex) => {
        const cell = row.properties?.[column];
        const value = Array.isArray(cell) ? cell : typeof cell === 'string' ? [[cell]] : [];
        const isColumnHeader = headers && rowIndex === 0;
        const isRowHeader = rowHeaders && colIndex === 0 && rowIndex > 0;
        const Cell = isColumnHeader || isRowHeader ? 'th' : 'td';
        const width = columnWidths?.[column]?.width;
        return <Cell key={`${row.id}-${column}`} scope={isColumnHeader ? 'col' : isRowHeader ? 'row' : undefined} style={width ? { width: `${width}px` } : undefined} data-label={plainRuns(value) || `Coluna ${colIndex + 1}`}><RichText value={value} onInternal={onInternal} /></Cell>;
      })}</tr>)}</tbody></table></div>;
    }
    case 'table_row':
    case 'unsupported':
    case 'child_database':
      return null;
    case 'image': {
      const url = String(block.properties?.mediaUrl || '');
      if (!url) return null;
      const caption = block.properties?.caption;
      return <figure className="system-image" data-testid={`system-image-${block.id}`}>
        <img src={url} alt={plainRuns(caption) || ''} loading="lazy" />
        {Array.isArray(caption) && caption.length > 0 && <figcaption><RichText value={caption} onInternal={onInternal} /></figcaption>}
      </figure>;
    }
    case 'file':
    case 'pdf':
    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url = String(block.properties?.mediaUrl || '');
      if (!url) return block.text ? <p className="system-paragraph">{body}</p> : null;
      const label = String(block.properties?.filename || block.text || url);
      return <a className="system-file-link" href={url} target="_blank" rel="noreferrer"><FileText size={16} /><span>{label}</span><ExternalLink size={13} /></a>;
    }
    case 'audio': {
      const url = String(block.properties?.mediaUrl || '');
      return url ? <audio className="system-audio" controls src={url}>{block.text}</audio> : null;
    }
    case 'video': {
      const url = String(block.properties?.mediaUrl || '');
      return url ? <video className="system-video" controls src={url}>{block.text}</video> : null;
    }
    case 'column_list':
      return <div className="system-columns" data-testid={`system-block-${block.id}`}>{renderChildren()}</div>;
    case 'column':
      return <div className="system-column" data-testid={`system-block-${block.id}`}>{renderChildren()}</div>;
    case 'child_page':
    case 'link_to_page': {
      const id = String(block.properties?.internalId || '');
      const target = id ? onInternal(`https://www.notion.so/${id.replace(/-/g, '')}`) : undefined;
      return target
        ? <button type="button" className="system-page-reference" onClick={() => window.dispatchEvent(new CustomEvent('system-open-document', { detail: target }))}>{body}<ArrowUpRight size={13} /></button>
        : block.text ? <p className="system-paragraph">{body}</p> : null;
    }
    case 'transclusion_container':
    case 'synced_block':
      return children.length ? <div className="system-transclusion" data-testid={`system-block-${block.id}`}>{renderChildren()}</div> : null;
    default:
      return <div className="system-paragraph" data-testid={`system-block-${block.id}`}>{block.text ? body : null}{renderChildren()}</div>;
  }
}

export default function System() {
  const firstDocumentId = data.sections.flatMap(section => documentIdsIn(section.groups))[0];
  const [selectedId, setSelectedId] = useState(firstDocumentId);
  const [search, setSearch] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeDocument = documentById.get(selectedId) || data.documents[0];
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const matches = useMemo(() => term ? data.documents.filter(document =>
    `${document.title} ${document.navTitle} ${document.section} ${document.subsection || ''} ${blockSearchText(document.blocks)}`
      .toLocaleLowerCase('pt-BR').includes(term),
  ) : [], [term]);

  const openDocument = (id: string) => {
    if (!documentById.has(id)) return;
    setSelectedId(id);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const resolveInternal = (url: string) => {
    const normalized = url.match(/[a-f0-9]{32}/i)?.[0]?.toLowerCase();
    if (!normalized) return undefined;
    return data.documents.find(document => document.id.replace(/-/g, '').toLowerCase() === normalized)?.id
      || data.idAliases?.[normalized]
      || data.idAliases?.[`${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`];
  };
  const navigateInternal = (event: Event) => openDocument((event as CustomEvent<string>).detail);
  const renderGroup = (group: SystemGroup, sectionId: string, key: string, nested = false): ReactNode => (
    <div className={`system-index-group ${nested ? 'system-index-subgroup' : ''}`} key={key}>
      {group.title && <p className="system-group-title">{group.title}</p>}
      {(group.documentIds || []).map(id => {
        const document = documentById.get(id);
        if (!document) return null;
        return <button type="button" key={`${sectionId}-${id}`} onClick={() => openDocument(id)} className={`system-index-link ${activeDocument.id === id ? 'active' : ''}`} data-testid={`button-system-doc-${sectionId}-${id}`}>
          <span className="system-index-dot" /><span>{document.navTitle}</span>{document.kind === 'inline' && <span className="system-inline-tag">página</span>}
        </button>;
      })}
      {(group.groups || []).map((child, index) => renderGroup(child, sectionId, `${key}-${index}`, true))}
    </div>
  );
  useEffect(() => {
    window.addEventListener('system-open-document', navigateInternal);
    return () => window.removeEventListener('system-open-document', navigateInternal);
  }, []);

  return <main className="system-page">
    <header className="system-topbar">
      <div className="system-topbar-inner">
        <Link href="/" className="system-brand" data-testid="link-system-access"><span className="system-brand-mark"><BookMarked size={17} /></span><span><b>Ascensão e Presságio</b><small>O sistema</small></span></Link>
        <div className="system-topbar-actions">
          <span className="system-public-label"><ShieldCheck size={14} /> Consulta pública</span>
          <Link href="/publico" className="system-archive-link" data-testid="link-system-archive"><BookOpen size={15} /> Arquivo</Link>
          <Link href="/" className="system-back-link" data-testid="link-system-back"><ArrowLeft size={15} /><span>Acesso</span></Link>
        </div>
      </div>
    </header>
    <div className="system-layout">
      <aside className={`system-sidebar ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Navegação do sistema">
        <div className="system-sidebar-head">
          <div><p className="eyebrow">Índice do sistema</p><p className="system-index-count">{data.documents.length} documentos <span>·</span> {data.sections.length} capítulos</p></div>
          <button type="button" className="system-close-nav" aria-label="Fechar índice" onClick={() => setMobileNavOpen(false)} data-testid="button-system-close-nav"><X size={18} /></button>
        </div>
        <label className="system-search">
          <Search size={17} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar regra ou termo..." aria-label="Buscar no sistema" data-testid="input-system-search" />
          {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')} data-testid="button-system-clear-search"><X size={15} /></button>}
          <kbd>/</kbd>
        </label>
        {term ? <div className="system-results" aria-live="polite">
          <p className="system-result-caption">{matches.length} {matches.length === 1 ? 'documento encontrado' : 'documentos encontrados'}</p>
          {matches.map(document => <button key={document.id} type="button" onClick={() => openDocument(document.id)} className={`system-result ${activeDocument.id === document.id ? 'active' : ''}`} data-testid={`button-system-result-${document.id}`}>
            <FileText size={15} /><span><strong>{document.navTitle}</strong><small>{document.section}{document.subsection ? ` / ${document.subsection}` : ''}</small></span><ChevronRight size={14} />
          </button>)}
          {matches.length === 0 && <div className="system-no-results"><Search size={20} /><b>Nenhuma regra localizada</b><span>Experimente outro termo.</span></div>}
        </div> : <nav className="system-index">
          {data.sections.map((section, sectionIndex) => <section className="system-index-section" key={section.id} aria-label={section.title}>
            <div className="system-section-title"><span className="system-section-number">{String(sectionIndex + 1).padStart(2, '0')}</span>{section.title}</div>
            {section.groups.map((group, groupIndex) => renderGroup(group, section.id, `${section.id}-${groupIndex}`))}
          </section>)}
        </nav>}
        <div className="system-sidebar-foot"><span className="system-status-dot" /> Conteúdo local · ramo do sistema</div>
      </aside>
      {mobileNavOpen && <button aria-label="Fechar navegação" className="system-nav-scrim" onClick={() => setMobileNavOpen(false)} data-testid="button-system-nav-scrim" />}
      <section className="system-reader" aria-label="Documento de regras">
        <div className="system-reader-toolbar">
          <button type="button" className="system-mobile-menu" onClick={() => setMobileNavOpen(true)} data-testid="button-system-open-nav"><Menu size={17} /> Índice</button>
          <div className="system-breadcrumb"><span>Regras</span><ChevronRight size={13} /><span>{activeDocument.section}</span>{activeDocument.subsection && <><ChevronRight size={13} /><span>{activeDocument.subsection}</span></>}</div>
          <span className="system-doc-position">{activeDocument.kind === 'inline' ? 'SUBPÁGINA' : 'DOCUMENTO'}</span>
        </div>
        <article className="system-document" key={activeDocument.id} data-testid={`system-document-${activeDocument.id}`}>
          <div className="system-document-kicker"><span className="system-doc-icon"><FileText size={16} /></span>{activeDocument.section}{activeDocument.subsection && <><span className="system-kicker-slash">/</span>{activeDocument.subsection}</>}</div>
          <h1 data-testid="system-document-title">{activeDocument.title}</h1>
          <div className="system-document-meta"><span><BookOpen size={14} /> {activeDocument.kind === 'inline' ? 'Conteúdo complementar' : 'Regra do sistema'}</span><span className="system-meta-separator" /><span>{activeDocument.blocks.length} blocos</span></div>
          {activeDocument.sourceUrl && <a className="system-source-link" href={activeDocument.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-system-source">Fonte original <ArrowUpRight size={14} /></a>}
          <div className="system-rule-content"><RenderBlocks blocks={activeDocument.blocks} onInternal={resolveInternal} /></div>
          {activeDocument.references?.length > 0 && <footer className="system-references" data-testid="system-references">
            <h2><BookMarked size={16} /> Referências deste documento</h2>
            <div>{activeDocument.references.map((reference, index) => {
              const referencedDocument = data.documents.find(document =>
                document.section === reference.section && (document.subsection || null) === (reference.subsection || null) &&
                (document.title === reference.label || document.navTitle.toLocaleLowerCase('pt-BR') === reference.label.toLocaleLowerCase('pt-BR')),
              ) || data.documents.find(document => document.title === reference.label || document.navTitle.toLocaleLowerCase('pt-BR') === reference.label.toLocaleLowerCase('pt-BR'));
              return referencedDocument && referencedDocument.id !== activeDocument.id
                ? <button key={`${reference.label}-${index}`} type="button" onClick={() => openDocument(referencedDocument.id)} className="system-reference-link" data-testid={`button-system-reference-${index}`}><span>{reference.label}</span><ArrowUpRight size={13} /></button>
                : <span key={`${reference.label}-${index}`} className="system-reference-static">{reference.label}</span>;
            })}</div>
          </footer>}
          <div className="system-document-end"><span /> Fim de {activeDocument.navTitle} <span /></div>
        </article>
        <footer className="system-reader-footer"><span>{data.root.title}</span><Link href="/" data-testid="link-system-footer-access">Voltar ao acesso <ArrowLeft size={13} /></Link></footer>
      </section>
    </div>
  </main>;
}
