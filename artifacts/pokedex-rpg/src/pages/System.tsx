import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSystemCatalogQueryKey, getGetSystemDocumentsQueryKey, getGetSystemEditorSessionQueryKey, useCreateSystemEditorSession, useDeleteSystemEditorSession, useGetSystemCatalog, useGetSystemDocuments, useGetSystemEditorSession, useSaveSystemCatalog, useSaveSystemDocument } from '@workspace/api-client-react';
import { ArrowLeft, ArrowUpRight, BookMarked, BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText, FolderTree, LockKeyhole, Menu, Moon, Pencil, Plus, Search, ShieldCheck, Sun, X } from 'lucide-react';
import { useAppTheme } from '../lib/theme';
import { useFormulaSettings } from '../lib/formulas';
import { normalizeSystemAttackName } from '../lib/systemTrackAttacks';
import { useAttackData } from '../lib/hooks';
import type { Attack } from '../lib/types';
import { SystemDocumentEditor, type EditableSystemDocument } from '../components/SystemEditor';
import { SystemIndexEditor, type EditableIndexGroup, type EditableIndexSection } from '../components/SystemIndexEditor';
import { SystemFormulaGuide } from '../components/SystemFormulaGuide';
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
const hiddenSystemDocumentIds = new Set([
  '3554bb16-8489-8042-8759-ecab1165fd70', // Ficha do Treinador
  '38d4bb16-8489-80ff-9479-c1357f0d02c0', // Low Kick
  '3f14bb16-8489-8091-9449-e9fb4ebccc68', // Smokescreen
  '3f14bb16-8489-802d-9fb3-c211bca17042', // Flash
]);
const blockFiles = import.meta.glob('../data/pokemonSystemBlocks/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, SystemBlock[]>;
const blocksById = new Map(Object.entries(blockFiles).map(([path, blocks]) => [
  path.split('/').pop()?.replace(/\.json$/, '') || '',
  blocks,
]));
function hideRemovedDocuments(groups: PersistedSystemGroup[]): PersistedSystemGroup[] {
  return groups
    .map(group => ({
      ...group,
      documentIds: group.documentIds.filter(id => !hiddenSystemDocumentIds.has(id)),
      groups: hideRemovedDocuments(group.groups || []),
    }))
    .filter(group => group.documentIds.length > 0 || group.groups.length > 0);
}
const normalizeGroups = (groups: SystemGroup[]): PersistedSystemGroup[] => hideRemovedDocuments(groups.map(group => ({
  title: group.title,
  documentIds: [...(group.documentIds || [])],
  groups: normalizeGroups(group.groups || []),
})));
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

function normalizedSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

function blockText(block: SystemBlock): string {
  return `${block.text || ''} ${plainRuns(block.properties?.title)}`;
}

function countBlocks(blocks: SystemBlock[]): number {
  return blocks.reduce((count, block) => count + 1 + countBlocks(block.children || []), 0);
}

function isLegacyFormulaSectionHeading(block: SystemBlock, documentId: string): boolean {
  return documentId === '3554bb16-8489-80a1-b872-efbcaf42027a'
    && block.id === '3554bb16-8489-8050-937b-f78f7a1324ae';
}

const SUPERSEDED_FORMULA_BLOCKS: Record<string, Set<string>> = {
  '3554bb16-8489-80a1-b872-efbcaf42027a': new Set([
    '35c4bb16-8489-80a7-a6ed-d6bdb19d0dad',
    '35c4bb16-8489-80e0-b97d-c583baad77bc',
    '35c4bb16-8489-8065-b648-f156f29f9482',
    '35c4bb16-8489-809b-ab9a-ee118a6ba945',
    '35c4bb16-8489-80e3-9427-c9bbcb65c159',
    '35c4bb16-8489-8010-a31b-e953b381ac52',
    '35c4bb16-8489-802c-a176-c84fd8d5950a',
    '35c4bb16-8489-8005-a394-c75d1d7106d0',
    '35c4bb16-8489-80a7-8dce-fe99ea6d3700',
    '35c4bb16-8489-80b0-9272-f9851c734ccf',
    '35c4bb16-8489-800f-8b67-c842388be09b',
    '35c4bb16-8489-803e-866c-ef13f5ccb904',
    '35c4bb16-8489-808f-bbad-c1e5442f2677',
    '35c4bb16-8489-8008-969e-f4087f468c00',
    '35c4bb16-8489-804c-b06a-e4d9746f10f1',
    '35c4bb16-8489-8023-ad90-e3b33d39fd29',
    '35c4bb16-8489-817f-b371-f58e74699b37',
    '35c4bb16-8489-81da-a789-e923d801f8fa',
    '35c4bb16-8489-8135-b1d5-ddbaeccf3768',
    '35c4bb16-8489-81a4-86d3-ef9b7c4a5a4c',
    '35c4bb16-8489-8025-8e7b-d6e72e4c9aa7',
    '35c4bb16-8489-80fa-adfc-c5a4f58b15e7',
    '35c4bb16-8489-80d4-9ef0-f2818bd7bec5',
    '35c4bb16-8489-809b-bd8f-fa20a7109fe5',
    '3624bb16-8489-80fe-8b49-fc604a207283',
    '3624bb16-8489-8093-b2a1-ef8f71587931',
  ]),
  '3554bb16-8489-8024-8c0b-c7bb34a95e66': new Set([
    '3554bb16-8489-80ff-a3de-cb027e4b0852',
    '3554bb16-8489-804a-b34d-f245a54065d8',
    '3554bb16-8489-8064-aeae-de7d7cbdb569',
  ]),
  '3554bb16-8489-805e-bf10-e4f86983a683': new Set([
    '35c4bb16-8489-804c-bfde-d8b5fcd86dcc',
    '35c4bb16-8489-80c0-8809-fe5f3b8a4763',
    '35c4bb16-8489-8096-a296-d1e600ca664f',
    '35c4bb16-8489-8059-8cfd-d840fa361212',
    '35c4bb16-8489-80b2-a3de-e47795a5d028',
    '35c4bb16-8489-808e-ad0d-e02edbcf691d',
  ]),
};

function containsLegacyDamageTable(block: SystemBlock): boolean {
  if (block.type === 'table' && (block.children || []).some(row =>
    row.type === 'table_row' && normalizedSearchText(row.text).includes('poder (pdr)'),
  )) return true;
  return (block.children || []).some(containsLegacyDamageTable);
}

function getDisplayBlocks(document: SystemDocument, ppMode: 'individual' | 'pool'): SystemBlock[] {
  const superseded = SUPERSEDED_FORMULA_BLOCKS[document.id];
  let replacingStatCalculationSection = false;

  const removeSuperseded = (blocks: SystemBlock[]): SystemBlock[] => {
    const visible: SystemBlock[] = [];
    for (const block of blocks) {
      if (isLegacyFormulaSectionHeading(block, document.id)) {
        replacingStatCalculationSection = true;
        continue;
      }
      if (replacingStatCalculationSection && block.type.startsWith('heading_3')) {
        replacingStatCalculationSection = false;
      }
      if (replacingStatCalculationSection || superseded?.has(block.id)) continue;
      if (document.id === '3554bb16-8489-8042-b7fb-dcaa47eb0bfb') {
        const isLegacyDamageContent = block.id === '3554bb16-8489-8021-93a2-c6411e442fad'
          || block.id === '3554bb16-8489-80b1-9151-d3bf08a3bc47'
          || (block.type === 'column_list' && containsLegacyDamageTable(block))
          || (block.type === 'table' && containsLegacyDamageTable(block));
        const isLegacyIndividualPpDescription = ppMode === 'pool'
          && block.id === '3554bb16-8489-80bf-8168-c753670da0e4';
        if (isLegacyDamageContent || isLegacyIndividualPpDescription) continue;
      }
      const children = block.children ? removeSuperseded(block.children) : undefined;
      visible.push(children ? { ...block, children } : block);
    }
    return visible;
  };

  return removeSuperseded(document.blocks);
}

function filterBlocksForSearch(blocks: SystemBlock[], query: string, isAbilityIndex: boolean): SystemBlock[] {
  const normalizedQuery = normalizedSearchText(query);
  if (!normalizedQuery) return blocks;

  const filterBlock = (block: SystemBlock): SystemBlock | null => {
    const ownText = blockText(block);
    const letterHeading = isAbilityIndex && block.type === 'toggle' && /^[a-z]$/i.test(ownText.trim());
    const matchesSelf = !letterHeading && normalizedSearchText(ownText).includes(normalizedQuery);

    if (block.type === 'table') {
      const rows = block.children || [];
      const hasColumnHeader = Boolean(block.format?.table_block_column_header);
      const header = hasColumnHeader ? rows.find(row => row.type === 'table_row') : undefined;
      const matchedRows = rows.filter(row => row.type === 'table_row' && row !== header
        && normalizedSearchText(blockText(row)).includes(normalizedQuery));
      return matchedRows.length ? { ...block, children: [...(header ? [header] : []), ...matchedRows] } : matchesSelf ? block : null;
    }

    if (matchesSelf) return block;
    const children = (block.children || []).map(filterBlock).filter((child): child is SystemBlock => Boolean(child));
    return children.length ? { ...block, children } : null;
  };

  return blocks.map(filterBlock).filter((block): block is SystemBlock => Boolean(block));
}

function countMatchingBlocks(blocks: SystemBlock[], query: string): number {
  const normalizedQuery = normalizedSearchText(query);
  if (!normalizedQuery) return 0;
  return blocks.reduce((count, block) =>
    count + (normalizedSearchText(blockText(block)).includes(normalizedQuery) ? 1 : 0) + countMatchingBlocks(block.children || [], normalizedQuery), 0);
}

function countMatchingAbilities(blocks: SystemBlock[], query: string): number {
  const normalizedQuery = normalizedSearchText(query);
  let count = 0;

  const includesQuery = (block: SystemBlock): boolean =>
    normalizedSearchText(blockText(block)).includes(normalizedQuery)
    || (block.children || []).some(includesQuery);

  const scan = (items: SystemBlock[]) => {
    for (const block of items) {
      if (block.type === 'toggle' && /^habilidade\s*:/i.test(block.text.trim())) {
        if (includesQuery(block)) count += 1;
        continue;
      }
      scan(block.children || []);
    }
  };

  scan(blocks);
  return count;
}

function getDocumentOutline(blocks: SystemBlock[]): Array<{ id: string; label: string }> {
  const outline: Array<{ id: string; label: string }> = [];
  const visit = (items: SystemBlock[]) => {
    for (const block of items) {
      const heading = block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3'
        || block.type === 'sub_header' || block.type === 'sub_sub_header';
      const sectionToggle = block.type === 'toggle' && Boolean(block.children?.length);
      if (heading || sectionToggle) {
        const label = block.text.replace(/^\/+|\/+$/g, '').replace(/^Habilidade:\s*/i, '').trim();
        if (label) outline.push({ id: heading ? `heading-${block.id}` : `section-${block.id}`, label });
        if (sectionToggle) continue;
      }
      if (block.children?.length) visit(block.children);
    }
  };
  visit(blocks);
  return outline;
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

function isSystemMoveBlock(block: SystemBlock): boolean {
  if (block.type !== 'toggle') return false;
  const lines = block.children ? block.children.flatMap(child => [
    child.text || '',
    ...(child.children || []).map(grandchild => grandchild.text || ''),
  ]) : [];
  return lines.some(line => /categoria\s*:/i.test(line))
    && lines.some(line => /\bPP\s*:/i.test(line));
}

function LiveSystemTrackAttack({ attack, block, forceOpen = false }: { attack: Attack; block: SystemBlock; forceOpen?: boolean }) {
  const contactLabel = attack.makesContact ? 'Sim' : 'Não';
  const priorityLabel = attack.priority > 0 ? `+${attack.priority}` : String(attack.priority);
  return <details id={`section-${block.id}`} className="system-toggle system-live-attack" open={forceOpen || undefined} data-testid={`system-track-move-${block.id}`}>
    <summary><span>{attack.name}</span><span className="system-live-attack-source">Movimentos</span><ChevronDown size={16} /></summary>
    <div className="system-toggle-content">
      <p className="system-live-attack-note">Dados sincronizados com o banco da aba Movimentos.</p>
      <dl className="system-live-attack-grid">
        <div><dt>Tipo</dt><dd>{attack.type}</dd></div>
        <div><dt>Categoria</dt><dd>{attack.category}</dd></div>
        <div><dt>PP</dt><dd>{attack.pp}</dd></div>
        <div><dt>PDR</dt><dd>{attack.power === 0 ? 'Variável' : attack.power ?? '—'}</dd></div>
        <div><dt>Precisão</dt><dd>{attack.accuracy}</dd></div>
        <div><dt>Alvo/área</dt><dd>{attack.target}</dd></div>
        <div><dt>Prioridade</dt><dd>{priorityLabel}</dd></div>
        <div><dt>Contato</dt><dd>{contactLabel}</dd></div>
      </dl>
      {attack.effectSummary && <p className="system-live-attack-summary"><strong>Resumo:</strong> {attack.effectSummary}</p>}
      {attack.effectFull && attack.effectFull !== attack.effectSummary && <p className="system-live-attack-full">{attack.effectFull}</p>}
    </div>
  </details>;
}

function RenderBlocks({
  blocks,
  onInternal,
  forceOpenToggles = false,
  documentId,
  attackByBlockId,
  attackByName,
}: {
  blocks: SystemBlock[];
  onInternal: (url: string) => string | undefined;
  forceOpenToggles?: boolean;
  documentId?: string;
  attackByBlockId?: Map<string, Attack>;
  attackByName?: Map<string, Attack>;
}) {
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
           {item.children?.length ? <div className="system-list-nested"><RenderBlocks blocks={item.children} onInternal={onInternal} forceOpenToggles={forceOpenToggles} documentId={documentId} attackByBlockId={attackByBlockId} attackByName={attackByName} /></div> : null}
        </li>)}
      </List>);
      continue;
    }
    const title = first.text.replace(/^\/+|\/+$/g, '').trim();
    const liveAttack = isSystemMoveBlock(first) && documentId
      ? attackByBlockId?.get(first.id) || attackByName?.get(normalizeSystemAttackName(title))
      : undefined;
    rendered.push(liveAttack
      ? <LiveSystemTrackAttack key={first.id} block={first} attack={liveAttack} forceOpen={forceOpenToggles} />
      : <BlockRenderer key={first.id} block={first} onInternal={onInternal} forceOpenToggles={forceOpenToggles} documentId={documentId} attackByBlockId={attackByBlockId} attackByName={attackByName} />);
    index += 1;
  }
  return <>{rendered}</>;
}

function BlockRenderer({
  block,
  onInternal,
  forceOpenToggles = false,
  documentId,
  attackByBlockId,
  attackByName,
}: {
  block: SystemBlock;
  onInternal: (url: string) => string | undefined;
  forceOpenToggles?: boolean;
  documentId?: string;
  attackByBlockId?: Map<string, Attack>;
  attackByName?: Map<string, Attack>;
}) {
  const children = block.children || [];
  const body = <RichText value={richValue(block)} onInternal={onInternal} />;
  const renderChildren = () => <RenderBlocks blocks={children} onInternal={onInternal} forceOpenToggles={forceOpenToggles} documentId={documentId} attackByBlockId={attackByBlockId} attackByName={attackByName} />;
  switch (block.type) {
    case 'text':
    case 'paragraph':
      return <div className={`system-paragraph ${block.text ? '' : 'system-blank-line'}`} data-testid={`system-block-${block.id}`}>{body}{children.length > 0 && renderChildren()}</div>;
    case 'heading_1':
      return <><h2 className="system-heading system-heading-one" id={`heading-${block.id}`} data-testid={`system-heading-${block.id}`}>{body}</h2>{children.length > 0 && renderChildren()}</>;
    case 'heading_2':
    case 'sub_header':
      return <><h2 className="system-heading system-heading-two" id={`heading-${block.id}`} data-testid={`system-heading-${block.id}`}>{body}</h2>{children.length > 0 && renderChildren()}</>;
    case 'heading_3':
    case 'sub_sub_header':
      return <><h3 className="system-heading system-heading-three" id={`heading-${block.id}`} data-testid={`system-heading-${block.id}`}>{body}</h3>{children.length > 0 && renderChildren()}</>;
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
      return <details id={`section-${block.id}`} className="system-toggle" open={forceOpenToggles || undefined} data-testid={`system-toggle-${block.id}`}><summary>{body}<ChevronDown size={16} /></summary><div className="system-toggle-content">{renderChildren()}</div></details>;
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
      const renderRow = (row: SystemBlock, rowIndex: number) => <tr key={row.id}>{order.map((column, colIndex) => {
        const cell = row.properties?.[column];
        const value = Array.isArray(cell) ? cell : typeof cell === 'string' ? [[cell]] : [];
        const isColumnHeader = headers && rowIndex === 0;
        const isRowHeader = rowHeaders && colIndex === 0 && rowIndex > 0;
         const header = headers ? plainRuns(rows[0]?.properties?.[column]) : '';
        const Cell = isColumnHeader || isRowHeader ? 'th' : 'td';
        const width = columnWidths?.[column]?.width;
         return <Cell key={`${row.id}-${column}`} scope={isColumnHeader ? 'col' : isRowHeader ? 'row' : undefined} style={width ? { width: `${width}px` } : undefined} data-label={header || `Coluna ${colIndex + 1}`}><RichText value={value} onInternal={onInternal} /></Cell>;
      })}</tr>;
      return <div className="system-table-wrap" data-testid={`system-table-${block.id}`}><table className="system-table">
        {headers && rows.length > 0 && <thead>{renderRow(rows[0], 0)}</thead>}
        <tbody>{rows.slice(headers ? 1 : 0).map((row, index) => renderRow(row, headers ? index + 1 : index))}</tbody>
      </table></div>;
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
  const { attacks, systemTrackAttackLinks } = useAttackData();
  const queryClient = useQueryClient();
  const documentsQuery = useGetSystemDocuments({ query: { queryKey: getGetSystemDocumentsQueryKey() } });
  const catalogQuery = useGetSystemCatalog({ query: { queryKey: getGetSystemCatalogQueryKey() } });
  const sessionQuery = useGetSystemEditorSession({ query: { queryKey: getGetSystemEditorSessionQueryKey() } });
  const createSession = useCreateSystemEditorSession();
  const deleteSession = useDeleteSystemEditorSession();
  const saveDocument = useSaveSystemDocument();
  const saveCatalog = useSaveSystemCatalog();
  const { theme, toggleTheme } = useAppTheme();
  const { active: activeFormulaPreset } = useFormulaSettings();
  const globalSearchRef = useRef<HTMLInputElement>(null);
  const firstDocumentId = initialSections.flatMap(section => documentIdsIn(section.groups))[0];
  const [selectedId, setSelectedId] = useState(firstDocumentId);
  const [search, setSearch] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
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
  const sourceIndexSections = storedCatalog?.sections?.length ? storedCatalog.sections : initialSections;
  const indexSections = useMemo(() => sourceIndexSections
    .map(section => ({ ...section, groups: hideRemovedDocuments(section.groups) }))
    .filter(section => section.groups.length > 0), [sourceIndexSections]);
  const deletedIds = storedCatalog?.deletedDocumentIds || [];
  const mergedDocuments = useMemo(() => data.documents.map(document => ({
    ...document,
    ...(persistedDocuments[document.id] || {}),
    id: document.id,
    blocks: cleanSystemBlocks((persistedDocuments[document.id] as SystemDocument | undefined)?.blocks || document.blocks),
  })).filter(document => !deletedIds.includes(document.id) && !hiddenSystemDocumentIds.has(document.id)).concat(
    Object.entries(persistedDocuments)
      .filter(([id]) => !data.documents.some(document => document.id === id) && !deletedIds.includes(id) && !hiddenSystemDocumentIds.has(id))
      .map(([, document]) => ({ ...document, blocks: cleanSystemBlocks(document.blocks || []) })),
  ), [persistedDocuments, deletedIds]);
  const activeDocument = mergedDocuments.find(document => document.id === selectedId) || mergedDocuments[0] || data.documents[0];
  const attackById = useMemo(() => new Map(attacks.map(attack => [attack.id, attack])), [attacks]);
  const attackByBlockId = useMemo(() => {
    const linked = new Map<string, Attack>();
    for (const [blockId, attackId] of Object.entries(systemTrackAttackLinks)) {
      const attack = attackById.get(attackId);
      if (attack) linked.set(blockId, attack);
    }
    return linked;
  }, [systemTrackAttackLinks, attackById]);
  const attackByName = useMemo(() => new Map(attacks.map(attack => [
    normalizeSystemAttackName(attack.name),
    attack,
  ])), [attacks]);
  const displayBlocks = useMemo(() => getDisplayBlocks(activeDocument, activeFormulaPreset.ppMode), [activeDocument, activeFormulaPreset.ppMode]);
  const displayBlockCount = useMemo(() => countBlocks(displayBlocks), [displayBlocks]);
  const searchableDocument = displayBlockCount >= 120 || blockSearchText(displayBlocks).length >= 14000;
  const isAbilityIndex = activeDocument.id === '3554bb16-8489-80b5-a500-cf5efef8aa4f';
  const filteredBlocks = useMemo(() => documentSearch.trim()
    ? filterBlocksForSearch(displayBlocks, documentSearch, isAbilityIndex)
    : displayBlocks, [displayBlocks, documentSearch, isAbilityIndex]);
  const pageSearchResultCount = isAbilityIndex
    ? countMatchingAbilities(displayBlocks, documentSearch)
    : countMatchingBlocks(displayBlocks, documentSearch);
  const pageOutline = useMemo(() => getDocumentOutline(displayBlocks), [displayBlocks]);
  const authorized = Boolean(sessionQuery.data?.authorized);
  const editorBusy = saveDocument.isPending || saveCatalog.isPending;
  const term = normalizedSearchText(search);
  const matches = useMemo(() => term ? mergedDocuments.filter(document =>
    normalizedSearchText(`${document.title} ${document.navTitle} ${document.section} ${document.subsection || ''} ${blockSearchText(document.blocks)}`).includes(term),
  ) : [], [term, mergedDocuments]);

  const openDocument = (id: string) => {
    if (!mergedDocuments.some(document => document.id === id)) return;
    setSelectedId(id);
    setDocumentSearch('');
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
  const scrollToSection = (sectionId: string) => {
    const section = window.document.getElementById(sectionId);
    section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
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
  useEffect(() => {
    const focusGlobalSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '');
      if (event.key === '/' && !isTyping && !passwordOpen && !editorTarget && !indexEditorOpen) {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }
      if (event.key === 'Escape' && documentSearch) setDocumentSearch('');
    };
    window.addEventListener('keydown', focusGlobalSearch);
    return () => window.removeEventListener('keydown', focusGlobalSearch);
  }, [documentSearch, passwordOpen, editorTarget, indexEditorOpen]);

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
           <input ref={globalSearchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar regra ou termo..." aria-label="Buscar no sistema" aria-keyshortcuts="/" data-testid="input-system-search" />
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
          <div className="system-document-meta"><span><BookOpen size={14} /> {activeDocument.kind === 'inline' ? 'Conteúdo complementar' : 'Regra do sistema'}</span><span className="system-meta-separator" /><span>{displayBlockCount.toLocaleString('pt-BR')} blocos</span></div>
          {activeDocument.sourceUrl && <a className="system-source-link" href={activeDocument.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-system-source">Fonte original <ArrowUpRight size={14} /></a>}
          {pageOutline.length >= 4 && !documentSearch && <details className="system-page-outline">
            <summary><FolderTree size={15} /> Nesta página <span>{pageOutline.length} seções</span><ChevronDown size={15} /></summary>
            <nav aria-label={`Seções de ${activeDocument.navTitle}`}>
              {pageOutline.map((item, index) => <button key={`${item.id}-${index}`} type="button" onClick={() => scrollToSection(item.id)}>{item.label}</button>)}
            </nav>
          </details>}
          {searchableDocument && <div className="system-page-search">
            <label className="system-search system-page-search-input">
              <Search size={17} />
              <input value={documentSearch} onChange={event => setDocumentSearch(event.target.value)} placeholder={`Buscar nesta página: ${activeDocument.navTitle}`} aria-label={`Buscar dentro de ${activeDocument.navTitle}`} data-testid="input-system-page-search" />
              {documentSearch && <button type="button" aria-label="Limpar busca nesta página" onClick={() => setDocumentSearch('')} data-testid="button-system-page-search-clear"><X size={15} /></button>}
            </label>
            {documentSearch && <p className="system-page-search-count" role="status" aria-live="polite">
              {pageSearchResultCount
                ? isAbilityIndex
                  ? `${pageSearchResultCount} ${pageSearchResultCount === 1 ? 'habilidade encontrada' : 'habilidades encontradas'}`
                  : `${pageSearchResultCount} ${pageSearchResultCount === 1 ? 'trecho encontrado' : 'trechos encontrados'}`
                : 'Nenhum resultado nesta página. Tente outro termo.'}
            </p>}
          </div>}
          <SystemFormulaGuide documentId={activeDocument.id} preset={activeFormulaPreset} />
          <div className="system-rule-content">{filteredBlocks.length
            ? <RenderBlocks blocks={filteredBlocks} onInternal={resolveInternal} forceOpenToggles={Boolean(documentSearch.trim())} documentId={activeDocument.id} attackByBlockId={attackByBlockId} attackByName={attackByName} />
            : <div className="system-page-search-empty"><Search size={20} /><strong>Nenhum resultado nesta página</strong><span>Tente outro nome ou termo. A busca não altera o conteúdo do manual.</span></div>}
          </div>
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
        <p className="eyebrow">Área de edição</p><h2>Desbloquear o manual</h2><p>Use a senha de edição ou a senha do mestre para alterar este documento.</p>
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
