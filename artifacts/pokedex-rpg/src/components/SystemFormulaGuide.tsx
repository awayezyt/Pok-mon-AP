import { Calculator, CircleHelp, Dices, Gauge, HeartPulse } from 'lucide-react';
import {
  FORMULA_META,
  IV_DICE,
  baseStatDice,
  type FormulaKey,
  type FormulaPreset,
} from '../lib/formulas';

const STAT_TITLES: Record<string, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spatk: 'SP.ATK',
  spdef: 'SP.DEF',
  spe: 'SPEED',
};

const FORMULA_GUIDES: Record<string, { title: string; description: string; keys: FormulaKey[] }> = {
  '3554bb16-8489-80a1-b872-efbcaf42027a': {
    title: 'Estatísticas e valores derivados',
    description: 'Estas expressões definem os valores usados na ficha do Pokémon e nas rolagens.',
    keys: ['statFinal', 'statBonus', 'hp', 'rdPhys', 'rdSpec', 'dodge', 'initiative', 'dmgPhys', 'dmgSpec'],
  },
  '3554bb16-8489-8024-8c0b-c7bb34a95e66': {
    title: 'Distribuição dos EVs por estatística',
    description: 'Cada Pokémon tem 3 EVs disponíveis por nível. As fórmulas abaixo definem o máximo permitido em cada estatística.',
    keys: ['evCapHp', 'evCapAtk', 'evCapDef', 'evCapSpAtk', 'evCapSpDef', 'evCapSpe'],
  },
  '3554bb16-8489-805e-bf10-e4f86983a683': {
    title: 'Efeitos dos estágios',
    description: 'O estágio escolhido entra como E; X é o valor que será ajustado pela fórmula.',
    keys: ['stageAtk', 'stageSpAtk', 'stageDef', 'stageSpDef', 'stageSpe', 'stageAccuracy', 'stageEvasion', 'stageCrit'],
  },
  '3554bb16-8489-8042-b7fb-dcaa47eb0bfb': {
    title: 'Dano e PP usados pela ficha',
    description: 'As tabelas e expressões desta seção são as mesmas que a ficha usa para calcular golpes.',
    keys: ['dmgPhys', 'dmgSpec', 'physOverflow', 'specOverflow'],
  },
};

const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  n: 'nível do Pokémon.',
  bs: 'valor-base desta estatística.',
  evs: 'EVs investidos nesta estatística.',
  ivs: 'valor numérico do IV definido no preset.',
  ds: 'quantidade lógica de dados, depois de modo e Natureza.',
  f: 'valor final da estatística, antes do bônus.',
  x: 'valor de entrada que será ajustado.',
  e: 'estágio atual da estatística ou característica.',
  p: 'poder do movimento.',
  pt: 'poder máximo da última faixa da tabela.',
  bt: 'bônus da última faixa da tabela.',
};

const FUNCTION_DESCRIPTIONS: Array<[string, string]> = [
  ['floor', 'arredonda para baixo.'],
  ['ceil', 'arredonda para cima.'],
  ['round', 'arredonda para o inteiro mais próximo.'],
  ['min', 'retorna o menor dos valores informados.'],
  ['max', 'retorna o maior dos valores informados.'],
  ['pow', 'eleva um número a uma potência.'],
  ['clamp', 'limita um valor entre dois extremos.'],
  ['if', 'escolhe um resultado se a condição for verdadeira e outro se for falsa.'],
  ['abs', 'retorna o valor sem sinal negativo.'],
  ['sqrt', 'calcula a raiz quadrada.'],
];

const OPERATOR_DESCRIPTIONS: Array<[string, string]> = [
  ['+', 'somar.'],
  ['-', 'subtrair.'],
  ['*', 'multiplicar.'],
  ['/', 'dividir.'],
  ['%', 'resto de uma divisão.'],
  ['^', 'elevar a uma potência.'],
  ['>=', 'comparar se um valor é maior ou igual ao outro.'],
  ['<=', 'comparar se um valor é menor ou igual ao outro.'],
  ['>', 'comparar se um valor é maior que o outro.'],
  ['<', 'comparar se um valor é menor que o outro.'],
  ['==', 'comparar se dois valores são iguais.'],
  ['!=', 'comparar se dois valores são diferentes.'],
  ['&&', 'exigir que as duas condições sejam verdadeiras.'],
  ['||', 'aceitar quando pelo menos uma condição for verdadeira.'],
  ['?', 'iniciar uma escolha condicional entre dois resultados.'],
  [':', 'separar o resultado verdadeiro do resultado falso em uma condição.'],
];

function getFormulaVariables(formula: string, formulaKey: FormulaKey): string[] {
  const allowed = new Map(FORMULA_META[formulaKey].vars.map(variable => [variable.toLowerCase(), variable]));
  const found = new Set<string>();
  const matches = formula.matchAll(/\b[A-Za-z][A-Za-z0-9_]*\b/g);

  for (const match of matches) {
    const variable = match[0];
    const allowedName = allowed.get(variable.toLowerCase());
    if (allowedName) found.add(allowedName);
  }

  return [...found];
}

function describeVariable(variable: string): string {
  const lower = variable.toLowerCase();
  const statVariable = variable.match(/^(bn|ev|iv|d|f|b)(hp|atk|def|spatk|spdef|spe)$/i);

  if (statVariable) {
    const prefix = statVariable[1].toLowerCase();
    const stat = STAT_TITLES[statVariable[2].toLowerCase()] || statVariable[2].toUpperCase();
    const meaning: Record<string, string> = {
      b: `valor-base de ${stat}.`,
      ev: `EVs investidos em ${stat}.`,
      iv: `valor numérico do IV de ${stat}, conforme o preset.`,
      d: `dados lógicos de ${stat}, depois de modo e Natureza.`,
      f: `valor final calculado para ${stat}.`,
      bn: `bônus calculado para ${stat}.`,
    };
    return meaning[prefix] || `valor ligado a ${stat}.`;
  }

  return VARIABLE_DESCRIPTIONS[lower] || 'variável definida pelo sistema para esta fórmula.';
}

function usesFunction(expressions: string, functionName: string) {
  return new RegExp(`\\b${functionName}\\s*\\(`, 'i').test(expressions);
}

function usesOperator(expressions: string, operator: string) {
  if (operator === '>' || operator === '<') {
    return expressions.split('').some((character, index) =>
      character === operator && expressions[index + 1] !== '=' && expressions[index - 1] !== operator,
    );
  }
  return expressions.includes(operator);
}

function DiceAndAllocationGuide({ preset }: { preset: FormulaPreset }) {
  const ranks = ['D', 'C', 'B', 'A', 'S', 'SS'] as const;
  const usesIvDice = preset.diceMode === 'iv';

  return <div className="system-formula-side-notes">
    <section className="system-formula-mode" aria-labelledby="system-dice-mode-title">
      <header className="system-formula-mode-heading">
        <Dices size={17} />
        <div><h3 id="system-dice-mode-title">Dados dos testes</h3><p>Modo ativo: {usesIvDice ? 'por rank de IV' : 'por estatística-base'}.</p></div>
      </header>
      {usesIvDice ? <div className="system-table-wrap system-formula-small-table">
        <table className="system-table">
          <thead><tr><th>Rank do IV</th><th>Dados lógicos</th><th>Rolagem no site</th></tr></thead>
          <tbody>{ranks.map(rank => {
            const dice = IV_DICE[rank];
            return <tr key={rank}>
              <td>{rank}</td>
              <td>{dice}</td>
              <td>{dice === 0 ? '2d20 · fica com o menor' : `${dice}d20 · fica com o maior`}</td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <div className="system-formula-example">
        <p><code>max(0, min(30, floor((base + 10) / 20)))</code></p>
        <p>A cada faixa de 20 pontos da estatística-base, aumenta um dado lógico. Por exemplo: base 9 → 0; base 10 → 1; base 30 → 2. O resultado é limitado a 30.</p>
      </div>}
      <p className="system-formula-note">A Natureza soma ou remove 1 dado lógico na estatística correspondente; a quantidade nunca fica abaixo de zero. Com 0 dados lógicos, o site rola 2d20 e mantém o menor; com 1 ou mais, mantém o maior.</p>
      <details className="system-formula-details">
        <summary>Valores numéricos de IV do preset</summary>
        <div className="system-table-wrap system-formula-small-table">
          <table className="system-table">
            <thead><tr><th>Rank</th><th>Valor usado em fórmulas que citam IV</th></tr></thead>
            <tbody>{ranks.map(rank => <tr key={rank}><td>{rank}</td><td>{preset.ivValues[rank]}</td></tr>)}</tbody>
          </table>
        </div>
        <p>Esse valor numérico pode ser usado por uma fórmula personalizada. Ele é diferente da quantidade de dados rolados.</p>
      </details>
    </section>

    <section className="system-formula-mode" aria-labelledby="system-ev-title">
      <header className="system-formula-mode-heading">
        <Gauge size={17} />
        <div><h3 id="system-ev-title">Pontos de esforço (EV)</h3><p>O total disponível é 3 × o nível do Pokémon.</p></div>
      </header>
      <p>Os EVs são distribuídos entre as seis estatísticas. A tabela de fórmulas acima mostra o limite individual ativo de cada uma. O site arredonda cada limite para baixo e não aceita valores negativos.</p>
    </section>
  </div>;
}

function DamageTables({ preset }: { preset: FormulaPreset }) {
  const tables: Array<{ title: string; rows: FormulaPreset['physTable'] }> = [
    { title: 'Dano físico', rows: preset.physTable },
    { title: 'Dano especial', rows: preset.specTable },
  ];

  return <section className="system-formula-mode system-formula-damage" aria-label="Tabelas ativas de dano">
    <header className="system-formula-mode-heading">
      <HeartPulse size={17} />
      <div><h3>Tabelas de dano ativas</h3><p>O site usa a primeira faixa cujo limite de poder comporta o golpe.</p></div>
    </header>
    <div className="system-formula-damage-grid">
      {tables.map(({ title, rows }) => <div key={title} className="system-formula-damage-table">
        <h4>{title}</h4>
        <div className="system-table-wrap system-formula-small-table">
          <table className="system-table">
            <thead><tr><th>Poder até</th><th>Rolagem</th><th>Bônus</th></tr></thead>
            <tbody>{rows.map((row, index) => <tr key={`${title}-${row.max}-${index}`}>
              <td>{row.max}</td>
              <td>{row.dice}d{row.sides}</td>
              <td>{row.bonus > 0 ? `+${row.bonus}` : row.bonus}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>)}
    </div>
    <p className="system-formula-note">Se o poder ultrapassar o último limite da tabela, o site conserva os dados da última faixa e calcula o bônus com a fórmula acima.</p>
  </section>;
}

function PpModeGuide({ preset }: { preset: FormulaPreset }) {
  return <section className="system-formula-mode" aria-labelledby="system-pp-mode-title">
    <header className="system-formula-mode-heading">
      <Gauge size={17} />
      <div><h3 id="system-pp-mode-title">Consumo de PP</h3><p>Modo ativo: {preset.ppMode === 'pool' ? 'barra compartilhada' : 'PP individual por golpe'}.</p></div>
    </header>
    {preset.ppMode === 'pool' ? <>
      <p>A fórmula acima define o tamanho máximo da barra compartilhada. Golpes com PP igual ou maior que {preset.ppFreeThreshold} custam 0; abaixo desse limite, o custo é arredondado para cima em intervalos de {preset.ppStep}.</p>
      <p className="system-formula-example"><code>custo = ceil(({preset.ppFreeThreshold} − PP do golpe) / {preset.ppStep})</code></p>
    </> : <p>Cada golpe controla sua própria contagem de PP. Ao usar um golpe, o site desconta 1 PP da contagem daquele golpe; a fórmula da barra compartilhada não é aplicada.</p>}
  </section>;
}

export function SystemFormulaGuide({ documentId, preset }: { documentId: string; preset: FormulaPreset }) {
  const guide = FORMULA_GUIDES[documentId];
  if (!guide) return null;

  const keys = documentId === '3554bb16-8489-8042-b7fb-dcaa47eb0bfb' && preset.ppMode === 'pool'
    ? [...guide.keys, 'ppPool' as FormulaKey]
    : guide.keys;
  const expressions = keys.map(key => preset.formulas[key] || '').join(' ');
  const formulaVariables = [...new Set(keys.flatMap(key => getFormulaVariables(preset.formulas[key] || '', key)))];
  const usedFunctions = FUNCTION_DESCRIPTIONS.filter(([name]) => usesFunction(expressions, name));
  const usedOperators = OPERATOR_DESCRIPTIONS.filter(([operator]) => usesOperator(expressions, operator));

  return <section className="system-formula-guide" aria-label="Cálculos usados atualmente pelo site" data-testid={`system-formula-guide-${documentId}`}>
    <header className="system-formula-guide-header">
      <span className="system-formula-guide-icon"><Calculator size={19} /></span>
      <div>
        <p className="system-formula-eyebrow">CÁLCULOS VIGENTES NO SITE</p>
        <h2>{guide.title}</h2>
        <p>{guide.description}</p>
      </div>
    </header>
    <div className="system-formula-active-preset"><span className="system-formula-active-dot" /> Preset ativo <strong>{preset.name}</strong><span>· sincronizado com “Mudar fórmulas”</span></div>

    <div className="system-table-wrap system-formula-table-wrap">
      <table className="system-table system-formula-table">
        <thead><tr><th>Cálculo</th><th>O que ele define</th><th>Expressão ativa</th></tr></thead>
        <tbody>{keys.map(key => {
          const formula = preset.formulas[key] || '';
          const meaning = FORMULA_META[key].help;
          return <tr key={key} data-system-formula-key={key}>
            <th scope="row">{FORMULA_META[key].label}</th>
            <td>{meaning}</td>
            <td><code className="system-formula-expression">{formula || '—'}</code></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    <details className="system-formula-details">
      <summary><CircleHelp size={16} /> Como entender as siglas e os símbolos?</summary>
      <div className="system-formula-reference">
        <div>
          <h3>Variáveis usadas nestas fórmulas</h3>
          {formulaVariables.length
            ? <dl className="system-formula-variable-list">{formulaVariables.map(variable => <div key={variable}><dt><code>{variable}</code></dt><dd>{describeVariable(variable)}</dd></div>)}</dl>
            : <p>Estas fórmulas não usam variáveis.</p>}
        </div>
        <div>
          <h3>Operações e funções</h3>
          <dl className="system-formula-variable-list">
            {usedOperators.map(([operator, description]) => <div key={operator}><dt><code>{operator}</code></dt><dd>{description}</dd></div>)}
            {usedFunctions.map(([name, description]) => <div key={name}><dt><code>{name}()</code></dt><dd>{description}</dd></div>)}
          </dl>
          <p className="system-formula-note">O site arredonda estatísticas, bônus, valores derivados e efeitos de estágio para inteiros. Limites de EV e PP são arredondados para baixo e nunca ficam negativos; o PV máximo fica em pelo menos 1.</p>
        </div>
      </div>
    </details>

    {documentId === '3554bb16-8489-8024-8c0b-c7bb34a95e66' && <DiceAndAllocationGuide preset={preset} />}
    {documentId === '3554bb16-8489-8042-b7fb-dcaa47eb0bfb' && <><DamageTables preset={preset} /><PpModeGuide preset={preset} /></>}
    <p className="system-formula-footer">As expressões desta tabela vêm diretamente do preset ativo. Se uma anotação antiga nesta página mostrar outro cálculo, use este quadro como referência atual do site.</p>
  </section>;
}
