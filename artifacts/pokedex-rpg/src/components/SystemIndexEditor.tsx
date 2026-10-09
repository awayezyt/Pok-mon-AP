import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, FolderPlus, Plus, Save, Trash2, X } from 'lucide-react';

export type EditableIndexGroup = {
  title: string | null;
  documentIds?: string[];
  groups?: EditableIndexGroup[];
};

export type EditableIndexSection = {
  id: string;
  title: string;
  groups: EditableIndexGroup[];
};

type IndexDocument = { id: string; navTitle: string };

function cloneSections(sections: EditableIndexSection[]) {
  return structuredClone(sections);
}

function updateGroupAt(
  groups: EditableIndexGroup[],
  path: number[],
  updater: (group: EditableIndexGroup) => EditableIndexGroup,
): EditableIndexGroup[] {
  const [index, ...rest] = path;
  if (index === undefined || !groups[index]) return groups;
  return groups.map((group, current) => current !== index
    ? group
    : rest.length
      ? { ...group, groups: updateGroupAt(group.groups || [], rest, updater) }
      : updater(group));
}

function removeGroupAt(groups: EditableIndexGroup[], path: number[]): EditableIndexGroup[] {
  const [index, ...rest] = path;
  if (index === undefined) return groups;
  if (!rest.length) return groups.filter((_, current) => current !== index);
  return groups.map((group, current) => current !== index
    ? group
    : { ...group, groups: removeGroupAt(group.groups || [], rest) });
}

function moveGroupAt(groups: EditableIndexGroup[], path: number[], direction: -1 | 1): EditableIndexGroup[] {
  const [index, ...rest] = path;
  if (index === undefined) return groups;
  if (rest.length) {
    return groups.map((group, current) => current !== index
      ? group
      : { ...group, groups: moveGroupAt(group.groups || [], rest, direction) });
  }
  const target = index + direction;
  if (target < 0 || target >= groups.length) return groups;
  const result = [...groups];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function SystemIndexEditor({
  sections,
  documents,
  busy,
  onClose,
  onSave,
  onAddDocument,
}: {
  sections: EditableIndexSection[];
  documents: IndexDocument[];
  busy: boolean;
  onClose: () => void;
  onSave: (sections: EditableIndexSection[]) => void;
  onAddDocument: (sectionId: string, groupPath: number[]) => void;
}) {
  const [draft, setDraft] = useState(() => cloneSections(sections));
  const [error, setError] = useState('');

  const updateSection = (index: number, updater: (section: EditableIndexSection) => EditableIndexSection) => {
    setDraft(current => current.map((section, currentIndex) => currentIndex === index ? updater(section) : section));
  };

  const updateGroup = (sectionIndex: number, path: number[], updater: (group: EditableIndexGroup) => EditableIndexGroup) => {
    updateSection(sectionIndex, section => ({ ...section, groups: updateGroupAt(section.groups, path, updater) }));
  };

  const renderGroups = (groups: EditableIndexGroup[], sectionIndex: number, parentPath: number[] = []): ReactNode =>
    groups.map((group, groupIndex) => {
      const path = [...parentPath, groupIndex];
      const title = group.title || 'Grupo sem nome';
      const groupDocuments = (group.documentIds || [])
        .map(id => documents.find(document => document.id === id))
        .filter((document): document is IndexDocument => Boolean(document));
      const descendantDocumentCount = (items: EditableIndexGroup[]): number => items.reduce(
        (total, item) => total + (item.documentIds?.length || 0) + descendantDocumentCount(item.groups || []),
        0,
      );
      const canDelete = !groupDocuments.length && !descendantDocumentCount(group.groups || []);

      return <details className="system-index-editor-group" key={path.join('-')} open>
        <summary><span>{title}</span><ChevronDown size={15} /></summary>
        <div className="system-index-editor-group-body">
          <label className="system-editor-field">
            <span>Nome da pasta no índice</span>
            <input
              value={group.title || ''}
              onChange={event => updateGroup(sectionIndex, path, current => ({ ...current, title: event.target.value || null }))}
              placeholder="Nome do grupo"
            />
          </label>
          {groupDocuments.length > 0 && <div className="system-index-editor-pages">
            {groupDocuments.map(document => <span key={document.id}>{document.navTitle}</span>)}
          </div>}
          <div className="system-index-editor-group-actions">
            <button type="button" onClick={() => onAddDocument(draft[sectionIndex].id, path)}><Plus size={14} /> Nova página</button>
            <button type="button" onClick={() => updateGroup(sectionIndex, path, current => ({
              ...current,
              groups: [...(current.groups || []), { title: 'Novo grupo', documentIds: [], groups: [] }],
            }))}><FolderPlus size={14} /> Subgrupo</button>
            <button type="button" onClick={() => updateSection(sectionIndex, section => ({
              ...section,
              groups: moveGroupAt(section.groups, path, -1),
            }))} aria-label={`Mover ${title} para cima`}><ChevronUp size={14} /></button>
            <button type="button" onClick={() => updateSection(sectionIndex, section => ({
              ...section,
              groups: moveGroupAt(section.groups, path, 1),
            }))} aria-label={`Mover ${title} para baixo`}><ChevronDown size={14} /></button>
            <button
              type="button"
              className="is-danger"
              disabled={!canDelete}
              title={canDelete ? 'Apagar pasta vazia' : 'Remova as páginas antes de apagar esta pasta'}
              onClick={() => updateSection(sectionIndex, section => ({ ...section, groups: removeGroupAt(section.groups, path) }))}
            ><Trash2 size={14} /> Remover pasta</button>
          </div>
          {group.groups?.length ? <div className="system-index-editor-subgroups">{renderGroups(group.groups, sectionIndex, path)}</div> : null}
        </div>
      </details>;
    });

  return <div className="system-editor-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section className="system-index-editor" role="dialog" aria-modal="true" aria-labelledby="system-index-editor-title">
      <header className="system-editor-head">
        <div>
          <p className="eyebrow">Organização do manual</p>
          <h2 id="system-index-editor-title">Editar índice</h2>
          <p>Renomeie capítulos e pastas, crie páginas e ajuste a ordem. As regras não são alteradas por esta tela.</p>
        </div>
        <button type="button" className="system-icon-button" onClick={onClose} aria-label="Fechar edição do índice" disabled={busy}><X size={18} /></button>
      </header>
      <div className="system-index-editor-body">
        {draft.map((section, sectionIndex) => {
          const containsPages = (groups: EditableIndexGroup[]): boolean => groups.some(group =>
            (group.documentIds?.length || 0) > 0 || containsPages(group.groups || []),
          );
          const canDelete = !containsPages(section.groups);
          return <section className="system-index-editor-section" key={section.id}>
            <div className="system-index-editor-section-head">
              <label className="system-editor-field">
                <span>Capítulo</span>
                <input value={section.title} onChange={event => updateSection(sectionIndex, current => ({ ...current, title: event.target.value }))} />
              </label>
              <div className="system-index-editor-group-actions">
                <button type="button" onClick={() => updateSection(sectionIndex, current => ({
                  ...current,
                  groups: [...current.groups, { title: 'Novo grupo', documentIds: [], groups: [] }],
                }))}><FolderPlus size={14} /> Novo grupo</button>
                <button type="button" onClick={() => setDraft(current => {
                  const destination = sectionIndex - 1;
                  if (destination < 0) return current;
                  const next = [...current];
                  [next[sectionIndex], next[destination]] = [next[destination], next[sectionIndex]];
                  return next;
                })} aria-label={`Mover capítulo ${section.title} para cima`}><ChevronUp size={14} /></button>
                <button type="button" onClick={() => setDraft(current => {
                  const destination = sectionIndex + 1;
                  if (destination >= current.length) return current;
                  const next = [...current];
                  [next[sectionIndex], next[destination]] = [next[destination], next[sectionIndex]];
                  return next;
                })} aria-label={`Mover capítulo ${section.title} para baixo`}><ChevronDown size={14} /></button>
                <button
                  type="button"
                  className="is-danger"
                  disabled={!canDelete || draft.length === 1}
                  title={canDelete ? 'Apagar capítulo vazio' : 'Remova os grupos antes de apagar este capítulo'}
                  onClick={() => setDraft(current => current.filter((_, index) => index !== sectionIndex))}
                ><Trash2 size={14} /> Remover</button>
              </div>
            </div>
            {section.groups.length ? renderGroups(section.groups, sectionIndex) : <p className="system-index-editor-empty">Este capítulo ainda não tem pastas.</p>}
          </section>;
        })}
        <button type="button" className="system-editor-add system-index-editor-add-section" onClick={() => setDraft(current => [
          ...current,
          { id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: 'Novo capítulo', groups: [] },
        ])}><Plus size={15} /> Adicionar capítulo</button>
        {error && <p className="system-editor-error" role="alert">{error}</p>}
      </div>
      <footer className="system-editor-foot">
        <button type="button" className="system-editor-cancel" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" className="system-editor-save" onClick={() => {
          if (!draft.length || draft.some(section => !section.title.trim())) {
            setError('Cada capítulo precisa ter um nome.');
            return;
          }
          setError('');
          onSave(draft);
        }} disabled={busy}>
          {busy ? <span className="system-mini-loader" /> : <Save size={15} />}{busy ? 'Salvando…' : 'Salvar índice'}
        </button>
      </footer>
    </section>
  </div>;
}
