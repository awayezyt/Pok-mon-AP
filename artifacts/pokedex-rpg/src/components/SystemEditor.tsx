import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, Rows3, Save, Trash2, X } from 'lucide-react';

export type EditableSystemBlock = {
  id: string;
  type: string;
  text: string;
  properties?: Record<string, unknown>;
  format?: Record<string, unknown>;
  richText?: unknown[] | null;
  children?: EditableSystemBlock[];
};

export type EditableSystemDocument = {
  id: string;
  title: string;
  navTitle: string;
  section: string;
  subsection: string | null;
  kind: string;
  sourceUrl?: string;
  references: { section: string; label: string; subsection: string | null; icon?: string | null }[];
  blocks: EditableSystemBlock[];
};

function createBlock(type = 'paragraph'): EditableSystemBlock {
  return { id: `editor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, text: '' };
}

function createTableBlock(): EditableSystemBlock {
  const columns = ['column-1', 'column-2'];
  const makeRow = (index: number): EditableSystemBlock => ({
    ...createBlock(),
    type: 'table_row',
    properties: Object.fromEntries(columns.map((column, columnIndex) => [column, [[index === 0 ? `Coluna ${columnIndex + 1}` : '', []]]])),
  });
  return {
    ...createBlock(),
    type: 'table',
    format: { table_block_column_order: columns, table_block_column_header: true, table_block_row_header: false },
    children: [makeRow(0), makeRow(1)],
  };
}

function tableCellText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map(run => Array.isArray(run) ? String(run[0] ?? '') : '').join('');
}

export function SystemDocumentEditor({
  document,
  isNew = false,
  indexSectionOptions = [],
  initialIndexSectionId = '',
  indexLocationLabel,
  busy,
  onSave,
  onDelete,
  onClose,
}: {
  document: EditableSystemDocument;
  isNew?: boolean;
  indexSectionOptions?: { id: string; title: string }[];
  initialIndexSectionId?: string;
  indexLocationLabel?: string;
  busy: boolean;
  onSave: (document: EditableSystemDocument, indexSectionId: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EditableSystemDocument>(() => structuredClone(document));
  const [indexSectionId, setIndexSectionId] = useState(initialIndexSectionId);
  const [rawBlocksText, setRawBlocksText] = useState(() => JSON.stringify(document.blocks, null, 2));
  const [jsonError, setJsonError] = useState('');
  const updateBlocks = (blocks: EditableSystemBlock[]) => {
    setDraft(current => ({ ...current, blocks }));
    setRawBlocksText(JSON.stringify(blocks, null, 2));
    setJsonError('');
  };
  const updateBlock = (id: string, changes: Partial<EditableSystemBlock>) => {
    const walk = (items: EditableSystemBlock[]): EditableSystemBlock[] => items.map(item => ({
      ...item,
      ...(item.children ? { children: walk(item.children) } : {}),
      ...(item.id === id ? changes : {}),
    }));
    updateBlocks(walk(draft.blocks));
  };
  const removeBlock = (id: string) => {
    const walk = (items: EditableSystemBlock[]): EditableSystemBlock[] => items
      .filter(item => item.id !== id)
      .map(item => ({ ...item, ...(item.children ? { children: walk(item.children) } : {}) }));
    updateBlocks(walk(draft.blocks));
  };
  const moveBlock = (id: string, direction: -1 | 1) => {
    const walk = (items: EditableSystemBlock[]): EditableSystemBlock[] => {
      const index = items.findIndex(item => item.id === id);
      if (index >= 0) {
        const destination = index + direction;
        if (destination < 0 || destination >= items.length) return items;
        const next = [...items];
        [next[index], next[destination]] = [next[destination], next[index]];
        return next;
      }
      return items.map(item => item.children ? { ...item, children: walk(item.children) } : item);
    };
    updateBlocks(walk(draft.blocks));
  };
  const tableOrder = (block: EditableSystemBlock) => {
    const order = block.format?.table_block_column_order;
    return Array.isArray(order) && order.length ? order.map(String) : ['column-1', 'column-2'];
  };
  const updateTableCell = (row: EditableSystemBlock, column: string, text: string) => {
    updateBlock(row.id, { properties: { ...(row.properties || {}), [column]: [[text, []]] } });
  };
  const addTableRow = (block: EditableSystemBlock) => {
    const columns = tableOrder(block);
    const nextRow: EditableSystemBlock = {
      ...createBlock(),
      type: 'table_row',
      properties: Object.fromEntries(columns.map(column => [column, [['', []]]])),
    };
    updateBlock(block.id, { children: [...(block.children || []), nextRow] });
  };
  const addTableColumn = (block: EditableSystemBlock) => {
    const columns = tableOrder(block);
    const newColumn = `column-${Date.now()}`;
    updateBlock(block.id, {
      format: { ...(block.format || {}), table_block_column_order: [...columns, newColumn] },
      children: (block.children || []).map((row, index) => ({
        ...row,
        properties: { ...(row.properties || {}), [newColumn]: [[index === 0 ? `Coluna ${columns.length + 1}` : '', []]] },
      })),
    });
  };
  const removeTableColumn = (block: EditableSystemBlock, column: string) => {
    const columns = tableOrder(block).filter(item => item !== column);
    if (!columns.length) return;
    updateBlock(block.id, {
      format: { ...(block.format || {}), table_block_column_order: columns },
      children: (block.children || []).map(row => {
        const properties = { ...(row.properties || {}) };
        delete properties[column];
        return { ...row, properties };
      }),
    });
  };
  const renderTable = (block: EditableSystemBlock): ReactNode => {
    const columns = tableOrder(block);
    const rows = (block.children || []).filter(row => row.type === 'table_row');
    return <div className="system-editor-table-wrap">
      <table className="system-editor-table"><tbody>
        {rows.map((row, rowIndex) => <tr key={row.id}>
          {columns.map((column, columnIndex) => {
            const isHeader = Boolean(block.format?.table_block_column_header) && rowIndex === 0;
            const Cell = isHeader ? 'th' : 'td';
            return <Cell key={`${row.id}-${column}`}>
              <textarea
                value={tableCellText(row.properties?.[column])}
                onChange={event => updateTableCell(row, column, event.target.value)}
                rows={1}
                aria-label={`${isHeader ? 'Cabeçalho' : 'Célula'} ${rowIndex + 1}, coluna ${columnIndex + 1}`}
                placeholder={isHeader ? `Cabeçalho ${columnIndex + 1}` : 'Conteúdo'}
              />
              {isHeader && <button type="button" onClick={() => removeTableColumn(block, column)} disabled={columns.length <= 1} aria-label={`Remover coluna ${columnIndex + 1}`}><X size={12} /></button>}
            </Cell>;
          })}
          <td className="system-editor-table-row-action"><button type="button" onClick={() => updateBlock(block.id, { children: rows.filter(item => item.id !== row.id) })} disabled={rows.length <= 1} aria-label={`Remover linha ${rowIndex + 1}`}><Trash2 size={13} /></button></td>
        </tr>)}
      </tbody></table>
      <div className="system-editor-table-actions">
        <button type="button" onClick={() => addTableRow(block)}><Plus size={13} /> Linha</button>
        <button type="button" onClick={() => addTableColumn(block)}><Plus size={13} /> Coluna</button>
      </div>
    </div>;
  };
  const renderBlocks = (items: EditableSystemBlock[], depth = 0): ReactNode => items.map((block, index) => <div className={`system-editor-block ${depth ? 'is-nested' : ''}`} key={block.id}>
    <div className="system-editor-block-tools"><span>Bloco {String(index + 1).padStart(2, '0')} <small>{block.type}</small></span><div>
      <button type="button" aria-label={`Mover bloco ${index + 1} para cima`} onClick={() => moveBlock(block.id, -1)} disabled={index === 0}><ChevronUp size={15} /></button>
      <button type="button" aria-label={`Mover bloco ${index + 1} para baixo`} onClick={() => moveBlock(block.id, 1)} disabled={index === items.length - 1}><ChevronDown size={15} /></button>
      <button type="button" aria-label={`Inserir bloco filho em ${index + 1}`} onClick={() => updateBlock(block.id, { children: [...(block.children || []), createBlock()] })}><Plus size={14} /></button>
      <button type="button" aria-label={`Remover bloco ${index + 1}`} onClick={() => removeBlock(block.id)}><Trash2 size={14} /></button>
    </div></div>
    <div className="system-editor-block-fields">
      <select aria-label={`Tipo do bloco ${index + 1}`} value={block.type} onChange={event => updateBlock(block.id, { type: event.target.value })}>
        {[
          ['paragraph', 'Parágrafo'], ['heading_1', 'Título grande'], ['heading_2', 'Título médio'],
          ['heading_3', 'Subtítulo'], ['bulleted_list_item', 'Item com marcador'],
          ['numbered_list_item', 'Item numerado'], ['quote', 'Citação'], ['callout', 'Destaque'],
          ['toggle', 'Parte recolhível'], ['divider', 'Divisor'], ['table', 'Tabela'],
        ].map(([type, label]) => <option key={type} value={type}>{label}</option>)}
      </select>
      <textarea
        value={block.text || ''}
        onChange={event => {
          const text = event.target.value;
          const richText = [[text, []]];
          updateBlock(block.id, {
            text,
            properties: { ...(block.properties || {}), title: richText },
            richText,
          });
        }}
        rows={2}
        aria-label={`Texto do bloco ${index + 1}`}
        placeholder="Texto do bloco"
      />
    </div>
    {block.type === 'table' && renderTable(block)}
    {block.type !== 'table' && Boolean(block.children?.length) && <div className="system-editor-children">{renderBlocks(block.children || [], depth + 1)}</div>}
  </div>);
  const changeBlocksJson = (value: string) => {
    setRawBlocksText(value);
    try {
      const parsed = JSON.parse(value) as EditableSystemBlock[];
      if (!Array.isArray(parsed)) throw new Error('O conteúdo precisa ser uma lista de blocos.');
      setDraft(current => ({ ...current, blocks: parsed }));
      setJsonError('');
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'JSON inválido.');
    }
  };

  return <div className="system-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="system-editor" role="dialog" aria-modal="true" aria-labelledby="system-editor-title">
      <header className="system-editor-head">
        <div><p className="eyebrow">Modo de edição</p><h2 id="system-editor-title">{isNew ? 'Criar documento' : 'Editar documento'}</h2><p>As alterações afetam apenas este documento do manual.</p></div>
        <button type="button" className="system-icon-button" onClick={onClose} aria-label="Fechar editor" disabled={busy}><X size={18} /></button>
      </header>
      <div className="system-editor-body">
        <label className="system-editor-field"><span>Título</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value, navTitle: current.navTitle === current.title ? event.target.value : current.navTitle }))} data-testid="input-system-edit-title" /></label>
        <div className="system-editor-metadata">
          <label className="system-editor-field"><span>Nome exibido no índice</span><input value={draft.navTitle} onChange={event => setDraft(current => ({ ...current, navTitle: event.target.value }))} /></label>
          <label className="system-editor-field"><span>Seção do documento</span><input value={draft.section} onChange={event => setDraft(current => ({ ...current, section: event.target.value }))} /></label>
          <label className="system-editor-field"><span>Subseção (opcional)</span><input value={draft.subsection || ''} onChange={event => setDraft(current => ({ ...current, subsection: event.target.value || null }))} /></label>
          {isNew && indexSectionOptions.length > 0 && <label className="system-editor-field"><span>Capítulo do índice</span>
            <select value={indexSectionId} onChange={event => setIndexSectionId(event.target.value)}>
              {indexSectionOptions.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
          </label>}
          {isNew && indexLocationLabel && <p className="system-index-editor-location">Esta página será criada em <strong>{indexLocationLabel}</strong>.</p>}
        </div>
        <div className="system-editor-section-title"><span>Blocos do documento</span><div className="system-editor-insert-actions">
          <button type="button" className="system-editor-add" onClick={() => updateBlocks([...draft.blocks, createBlock()])}><Plus size={15} /> Parágrafo</button>
          <button type="button" className="system-editor-add" onClick={() => updateBlocks([...draft.blocks, createTableBlock()])}><Rows3 size={15} /> Tabela</button>
        </div></div>
        <div className="system-editor-blocks">
          {renderBlocks(draft.blocks)}
          {draft.blocks.length === 0 && <div className="system-editor-empty">Este documento ainda não tem blocos. Insira o primeiro parágrafo.</div>}
        </div>
       <details className="system-editor-raw"><summary>Editar estrutura completa em JSON</summary><p>Use este modo para alterar células de tabelas, formatação rica e outros dados avançados dos blocos.</p><textarea value={rawBlocksText} onChange={event => changeBlocksJson(event.target.value)} rows={12} spellCheck={false} aria-label="Estrutura completa dos blocos em JSON" />{jsonError && <span className="system-editor-error">{jsonError}</span>}</details>
      </div>
      <footer className="system-editor-foot">
        {onDelete && !isNew && <button type="button" className="system-editor-delete" onClick={onDelete} disabled={busy}><Trash2 size={14} /> Remover documento</button>}
        <button type="button" className="system-editor-cancel" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" className="system-editor-save" onClick={() => onSave(draft, indexSectionId)} disabled={busy || Boolean(jsonError) || !draft.title.trim() || !draft.navTitle.trim() || (isNew && !indexSectionId)}>{busy ? <span className="system-mini-loader" /> : <Save size={15} />}{busy ? 'Salvando…' : <><Check size={15} /> Salvar documento</>}</button>
      </footer>
    </section>
  </div>;
}
