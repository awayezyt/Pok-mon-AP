import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSystemCatalogQueryKey, getGetSystemDocumentsQueryKey, getGetSystemEditorSessionQueryKey, useCreateSystemEditorSession, useDeleteSystemEditorSession, useGetSystemCatalog, useGetSystemDocuments, useGetSystemEditorSession, useSaveSystemCatalog, useSaveSystemDocument } from '@workspace/api-client-react';
import { ArrowLeft, ArrowUpRight, BookMarked, BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText, FolderTree, LockKeyhole, Menu, Moon, Pencil, Plus, Search, ShieldCheck, Sun, X } from 'lucide-react';
import { useAppTheme } from '../lib/theme';
import { SystemDocumentEditor, type EditableSystemDocument } from '../components/SystemEditor';
import { SystemIndexEditor, type EditableIndexGroup, type EditableIndexSection } from '../components/SystemIndexEditor';
import { RichText as IconRichText } from '../components/RichText';
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

type PersistedSystemGroup = {
  title: string | null;
  documentIds: string[];
  groups: PersistedSystemGroup[];
};
type SystemIndexSection = { id: string; title: string; groups: PersistedSystemGroup[] };
type SystemCatalog = { sections: SystemIndexSection[]; deletedDocumentIds: string[] };

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
const normalizeGroups = (groups: SystemGroup[]): PersistedSystemGroup[] => groups.map(group => ({
  title: group.title,
  documentIds: [...(group.documentIds || [])],
  groups: normalizeGroups(group.groups || []),
}));
function cleanSystemBlocks(blocks: SystemBlock[]): SystemBlock[] {
  return blocks
    .filter(block => block.text.trim().toLocaleLowerCase('pt-BR') !== 'mobile clique aqui!')
    .map(block => ({ ...block, ...(block.children ? { children: cleanSystemBlocks(block.children) } : {}) }));
}
const initialSections: SystemIndexSection[] = sourceData.sections.map(section => ({
  ...section,
  groups: normalizeGroups(section.groups),
}));
const data = {
  ...sourceData,
  documents: sourceData.documents.map(document => ({
    ...document,
    blocks: cleanSystemBlocks(blocksById.get(document.id) || []),
  })),
};

function insertDocumentIntoGroup(
  sections: SystemIndexSection[],
  sectionId: string,
  groupPath: number[],
  documentId: string,
): SystemIndexSection[] {
  return sections.map(section => {
    if (section.id !== sectionId) return section;
    if (groupPath.length === 0) {
      const groups = section.groups.length
        ? [...section.groups]
        : [{ title: null, documentIds: [], groups: [] }];
      const firstGroup = groups[0];
      groups[0] = {
        ...firstGroup,
        documentIds: [...new Set([...(firstGroup.documentIds || []), documentId])],
      };
      return { ...section, groups };
    }
    const addToGroup = (groups: PersistedSystemGroup[], path: number[]): PersistedSystemGroup[] => {
      const [index, ...rest] = path;
      if (index === undefined || !groups[index]) return groups;
      return groups.map((group, current) => {
        if (current !== index) return group;
        if (rest.length) return { ...group, groups: addToGroup(group.groups || [], rest) };
        return { ...group, documentIds: [...new Set([...(group.documentIds || []), documentId])] };
      });
    };
    return { ...section, groups: addToGroup(section.groups, groupPath) };
  });
}

function groupAtPath(groups: PersistedSystemGroup[], path: number[]): PersistedSystemGroup | undefined {
  const [index, ...rest] = path;
  if (index === undefined) return undefined;
  const group = groups[index];
  if (!group || !rest.length) return group;
  return groupAtPath(group.groups || [], rest);
}

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
    let child: ReactNode = <IconRichText text={text} />;
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
        <div className="system-callout-mark">{iconUrl ? <img src={iconUrl} alt={icon?.custom_emoji?.name || ''} loading="lazy" /> : <BookOpen size={16} />}</div>
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
  const queryClient = useQueryClient();
  const documentsQuery = useGetSystemDocuments({ query: { queryKey: getGetSystemDocumentsQueryKey() } });
  const catalogQuery = useGetSystemCatalog({ query: { queryKey: getGetSystemCatalogQueryKey() } });
  const sessionQuery = useGetSystemEditorSession({ query: { queryKey: getGetSystemEditorSessionQueryKey() } });
  const createSession = useCreateSystemEditorSession();
  const deleteSession = useDeleteSystemEditorSession();
  const saveDocument = useSaveSystemDocument();
  const saveCatalog = useSaveSystemCatalog();
  const { theme, toggleTheme } = useAppTheme();
  const firstDocumentId = initialSections.flatMap(section => documentIdsIn(section.groups))[0];
  const [selectedId, setSelectedId] = useState(firstDocumentId);
  const [search, setSearch] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [editorTarget, setEditorTarget] = useState<{
    document: EditableSystemDocument;
    isNew: boolean;
    sectionId: string;
    groupPath: number[];
    locationLabel: string;
  } | null>(null);
  const [indexEditorOpen, setIndexEditorOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const persistedDocuments = (documentsQuery.data?.documents || {}) as Record<string, SystemDocument>;
  const storedCatalog = catalogQuery.data?.catalog as SystemCatalog | undefined;
  const indexSections = storedCatalog?.sections?.length ? storedCatalog.sections : initialSections;
  const deletedIds = storedCatalog?.deletedDocumentIds || [];
  const mergedDocuments = useMemo(() => data.documents.map(document => ({
    ...document,
    ...(persistedDocuments[document.id] || {}),
    id: document.id,
    blocks: cleanSystemBlocks((persistedDocuments[document.id] as SystemDocument | undefined)?.blocks || document.blocks),
  })).filter(document => !deletedIds.includes(document.id)).concat(
    Object.entries(persistedDocuments)
      .filter(([id]) => !data.documents.some(document => document.id === id) && !deletedIds.includes(id))
      .map(([, document]) => ({ ...document, blocks: cleanSystemBlocks(document.blocks || []) })),
  ), [persistedDocuments, deletedIds]);
  const activeDocument = mergedDocuments.find(document => document.id === selectedId) || mergedDocuments[0] || data.documents[0];
  const authorized = Boolean(sessionQuery.data?.authorized);
  const editorBusy = saveDocument.isPending || saveCatalog.isPending;
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const matches = useMemo(() => term ? mergedDocuments.filter(document =>
    `${document.title} ${document.navTitle} ${document.section} ${document.subsection || ''} ${blockSearchText(document.blocks)}`
      .toLocaleLowerCase('pt-BR').includes(term),
  ) : [], [term, mergedDocuments]);

  const openDocument = (id: string) => {
    if (!mergedDocuments.some(document => document.id === id)) return;
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
  const makeEditable = (document: SystemDocument): EditableSystemDocument => structuredClone(document) as EditableSystemDocument;
  const findSectionForDocument = (id: string) => indexSections.find(section => documentIdsIn(section.groups).includes(id));
  const startNewDocument = (sectionId?: string, requestedPath?: number[]) => {
    const section = indexSections.find(item => item.id === sectionId)
      || findSectionForDocument(activeDocument.id)
      || indexSections[0];
    if (!section) return;
    const path = requestedPath ?? (section.groups.length ? [0] : []);
    const group = path.length ? groupAtPath(section.groups, path) : undefined;
    const locationLabel = [section.title, group?.title].filter(Boolean).join(' / ');
    const title = 'Novo documento';
    const fresh: EditableSystemDocument = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      navTitle: title,
      section: section.title,
      subsection: group?.title || null,
      kind: 'page',
      references: [],
      blocks: [],
    };
    setEditorTarget({ document: fresh, isNew: true, sectionId: section.id, groupPath: path, locationLabel });
    setMobileNavOpen(false);
    setSaveMessage('');
  };

  const persistCatalog = (
    sections: EditableIndexSection[] | SystemIndexSection[],
    nextDeletedIds: string[],
    onSuccess: () => void,
    onError: () => void,
  ) => {
    const normalized = sections.map(section => ({
      id: section.id,
      title: section.title,
      groups: normalizeGroups(section.groups),
    }));
    const catalog = { sections: normalized, deletedDocumentIds: [...new Set(nextDeletedIds)] };
    saveCatalog.mutate({ data: { catalog } }, {
      onSuccess: async response => {
        queryClient.setQueryData(getGetSystemCatalogQueryKey(), { catalog: response.catalog });
        await queryClient.invalidateQueries({ queryKey: getGetSystemCatalogQueryKey() });
        onSuccess();
      },
      onError,
    });
  };

  const handleSaveDocument = (document: EditableSystemDocument, selectedIndexSectionId: string) => {
    if (!editorTarget) return;
    setSaveMessage('');
    saveDocument.mutate({ documentId: document.id, data: { document } }, {
      onSuccess: async response => {
        queryClient.setQueryData(getGetSystemDocumentsQueryKey(), (old: { documents: Record<string, SystemDocument> } | undefined) => ({
          documents: { ...(old?.documents || {}), [document.id]: response.document as SystemDocument },
        }));
        if (!editorTarget.isNew) {
          await queryClient.invalidateQueries({ queryKey: getGetSystemDocumentsQueryKey() });
          setEditorTarget(null);
          setSaveMessage('Documento salvo.');
          return;
        }
        const targetSectionId = selectedIndexSectionId || editorTarget.sectionId;
        const targetGroupPath = targetSectionId === editorTarget.sectionId ? editorTarget.groupPath : [];
        const nextSections = insertDocumentIntoGroup(indexSections, targetSectionId, targetGroupPath, document.id);
        persistCatalog(nextSections, deletedIds.filter(id => id !== document.id), async () => {
          await queryClient.invalidateQueries({ queryKey: getGetSystemDocumentsQueryKey() });
          setSelectedId(document.id);
          setEditorTarget(null);
          setSaveMessage('Documento criado e adicionado ao índice.');
        }, () => setSaveMessage('Documento salvo, mas não entrou no índice. Reabra o editor e tente salvar novamente.'));
      },
      onError: () => setSaveMessage('Não foi possível salvar. Suas alterações continuam no editor; tente novamente.'),
    });
  };

  const openIndexEditor = () => {
    setIndexEditorOpen(true);
    setSaveMessage('');
  };

  const navigateInternal = (event: Event) => openDocument((event as CustomEvent<string>).detail);
  const renderGroup = (group: SystemGroup, sectionId: string, key: string, nested = false): ReactNode => (
    <div className={`system-index-group ${nested ? 'system-index-subgroup' : ''}`} key={key}>
      {group.title && <p className="system-group-title">{group.title}</p>}
      {(group.documentIds || []).map(id => {
        const document = mergedDocuments.find(item => item.id === id);
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
  }, [mergedDocuments]);

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
          <div><p className="eyebrow">Índice do sistema</p><p className="system-index-count">{mergedDocuments.length} documentos <span>·</span> {indexSections.length} capítulos</p></div>
          <button type="button" className="system-close-nav" aria-label="Fechar índice" onClick={() => setMobileNavOpen(false)} data-testid="button-system-close-nav"><X size={18} /></button>
        </div>
        {authorized && !term && <div className="system-index-admin-actions">
          <button type="button" onClick={() => startNewDocument()} data-testid="button-system-add-document"><Plus size={14} /> Novo documento</button>
          <button type="button" onClick={openIndexEditor} data-testid="button-system-edit-index"><FolderTree size={14} /> Editar índice</button>
        </div>}
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
          {indexSections.map((section, sectionIndex) => {
            const isCollapsed = collapsedSections.includes(section.id);
            return <section className="system-index-section" key={section.id} aria-label={section.title}>
              <button type="button" className="system-section-title" aria-expanded={!isCollapsed} onClick={() => setCollapsedSections(current => (
                current.includes(section.id) ? current.filter(id => id !== section.id) : [...current, section.id]
              ))}>
                <span className="system-section-number">{String(sectionIndex + 1).padStart(2, '0')}</span>
                <span className="system-section-label">{section.title}</span>
                <ChevronDown className={isCollapsed ? 'is-collapsed' : ''} size={14} />
              </button>
              {!isCollapsed && section.groups.map((group, groupIndex) => renderGroup(group, section.id, `${section.id}-${groupIndex}`))}
            </section>;
          })}
        </nav>}
        <div className="system-sidebar-foot"><span className="system-status-dot" /> Conteúdo local · ramo do sistema</div>
      </aside>
      {mobileNavOpen && <button aria-label="Fechar navegação" className="system-nav-scrim" onClick={() => setMobileNavOpen(false)} data-testid="button-system-nav-scrim" />}
       <section className="system-reader" aria-label="Documento de regras">
        <div className="system-reader-toolbar">
          <button type="button" className="system-mobile-menu" onClick={() => setMobileNavOpen(true)} data-testid="button-system-open-nav"><Menu size={17} /> Índice</button>
          <div className="system-breadcrumb"><span>Regras</span><ChevronRight size={13} /><span>{activeDocument.section}</span>{activeDocument.subsection && <><ChevronRight size={13} /><span>{activeDocument.subsection}</span></>}</div>
          <span className="system-doc-position">{activeDocument.kind === 'inline' ? 'SUBPÁGINA' : 'DOCUMENTO'}</span>
          <div className="system-reader-actions">
            <button type="button" className="system-tool-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} data-testid="button-system-theme">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            {authorized
              ? <button type="button" className="system-tool-button system-edit-button is-authorized" onClick={() => { setEditorTarget({ document: makeEditable(activeDocument), isNew: false, sectionId: '', groupPath: [], locationLabel: '' }); setSaveMessage(''); }} aria-label="Editar documento atual" title="Editar documento" data-testid="button-system-edit"><Pencil size={15} /></button>
              : <button type="button" className="system-tool-button system-edit-button" onClick={() => { setPasswordOpen(true); setPasswordError(''); }} aria-label="Desbloquear edição" title="Desbloquear edição" data-testid="button-system-unlock"><Pencil size={15} /></button>}
          </div>
        </div>
        {documentsQuery.isLoading && <div className="system-query-status" role="status"><span className="system-mini-loader" /> Sincronizando documentos…</div>}
        {documentsQuery.isError && <div className="system-query-error" role="alert"><span>Não foi possível sincronizar alterações salvas. O conteúdo local continua disponível.</span><button type="button" onClick={() => void documentsQuery.refetch()}>Tentar novamente</button></div>}
        {saveMessage && <div className="system-save-status" role="status">{saveMessage}</div>}
        <article className="system-document" key={activeDocument.id} data-testid={`system-document-${activeDocument.id}`}>
          <div className="system-document-kicker"><span className="system-doc-icon"><FileText size={16} /></span>{activeDocument.section}{activeDocument.subsection && <><span className="system-kicker-slash">/</span>{activeDocument.subsection}</>}</div>
          <h1 data-testid="system-document-title">{activeDocument.title}</h1>
          <div className="system-document-meta"><span><BookOpen size={14} /> {activeDocument.kind === 'inline' ? 'Conteúdo complementar' : 'Regra do sistema'}</span><span className="system-meta-separator" /><span>{activeDocument.blocks.length} blocos</span></div>
          {activeDocument.sourceUrl && <a className="system-source-link" href={activeDocument.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-system-source">Fonte original <ArrowUpRight size={14} /></a>}
          <div className="system-rule-content"><RenderBlocks blocks={activeDocument.blocks} onInternal={resolveInternal} /></div>
          {activeDocument.references?.length > 0 && <footer className="system-references" data-testid="system-references">
            <h2><BookMarked size={16} /> Referências deste documento</h2>
            <div>{activeDocument.references.map((reference, index) => {
              const referencedDocument = mergedDocuments.find(document =>
                document.section === reference.section && (document.subsection || null) === (reference.subsection || null) &&
                (document.title === reference.label || document.navTitle.toLocaleLowerCase('pt-BR') === reference.label.toLocaleLowerCase('pt-BR')),
              ) || mergedDocuments.find(document => document.title === reference.label || document.navTitle.toLocaleLowerCase('pt-BR') === reference.label.toLocaleLowerCase('pt-BR'));
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
    {passwordOpen && <div className="system-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPasswordOpen(false); }}>
      <form className="system-password-dialog" onSubmit={event => {
        event.preventDefault();
        setPasswordError('');
        createSession.mutate({ data: { password } }, {
          onSuccess: async result => {
            await queryClient.invalidateQueries({ queryKey: getGetSystemEditorSessionQueryKey() });
            if (result.authorized) { setPasswordOpen(false); setPassword(''); }
            else setPasswordError('Senha incorreta. Confira e tente novamente.');
          },
          onError: () => setPasswordError('Não foi possível validar a senha. Tente novamente.'),
        });
      }}>
        <button type="button" className="system-icon-button system-password-close" aria-label="Fechar solicitação de senha" onClick={() => setPasswordOpen(false)}><X size={17} /></button>
        <div className="system-password-mark"><LockKeyhole size={20} /></div>
        <p className="eyebrow">Área de edição</p><h2>Desbloquear o manual</h2><p>Insira a senha de edição para alterar este documento.</p>
        <label className="system-editor-field"><span>Senha</span><input autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required data-testid="input-system-editor-password" /></label>
        {passwordError && <p className="system-editor-error" role="alert">{passwordError}</p>}
        <button type="submit" className="system-editor-save" disabled={createSession.isPending || !password}>{createSession.isPending ? <span className="system-mini-loader" /> : <LockKeyhole size={15} />}{createSession.isPending ? 'Verificando…' : 'Desbloquear edição'}</button>
      </form>
    </div>}
    {editorTarget && authorized && <SystemDocumentEditor
      document={editorTarget.document}
      isNew={editorTarget.isNew}
      initialIndexSectionId={editorTarget.sectionId}
      indexSectionOptions={indexSections.map(section => ({ id: section.id, title: section.title }))}
      indexLocationLabel={editorTarget.locationLabel}
      busy={editorBusy}
      onClose={() => setEditorTarget(null)}
      onSave={handleSaveDocument}
    />}
    {indexEditorOpen && authorized && <SystemIndexEditor
      sections={indexSections as EditableIndexSection[]}
      documents={mergedDocuments.map(document => ({ id: document.id, navTitle: document.navTitle }))}
      busy={saveCatalog.isPending}
      onClose={() => setIndexEditorOpen(false)}
      onAddDocument={startNewDocument}
      onSave={sections => persistCatalog(sections, deletedIds, () => {
        setIndexEditorOpen(false);
        setSaveMessage('Índice salvo.');
      }, () => setSaveMessage('Não foi possível salvar o índice. Tente novamente.'))}
    />}
    {authorized && <button type="button" className="system-lock-session" onClick={() => deleteSession.mutate(undefined, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetSystemEditorSessionQueryKey() });
        setEditorTarget(null);
        setIndexEditorOpen(false);
      },
    })} disabled={deleteSession.isPending} aria-label="Bloquear editor" title="Bloquear editor" data-testid="button-system-lock"><LockKeyhole size={14} /><span>{deleteSession.isPending ? 'Bloqueando…' : 'Editor desbloqueado'}</span></button>}
  </main>;
}
