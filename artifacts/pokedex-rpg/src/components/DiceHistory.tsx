import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useDiceHistory } from '../lib/DiceHistoryContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Dices, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

export function DiceHistoryPanel() {
  const { history, clearHistory } = useDiceHistory();
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const isSystemPage = location === '/sistema';

  return (
    <>
      <Button
        variant="default"
        size="icon"
        className={`fixed z-50 transition-all duration-300 ${isSystemPage ? 'right-4 top-auto bottom-4 rounded-xl' : `top-20 rounded-l-none ${isOpen ? 'left-80' : 'left-0'}`}`}
        style={isSystemPage ? { right: '16px', bottom: 'calc(16px + env(safe-area-inset-bottom))', top: 'auto', left: 'auto' } : undefined}
        onClick={() => setIsOpen(!isOpen)}
        title="Histórico de Dados"
        aria-label={isOpen ? 'Fechar histórico de rolagens' : 'Abrir histórico de rolagens'}
      >
        {isOpen ? (isSystemPage ? <ChevronRight size={18} /> : <ChevronLeft size={18} />) : <Dices size={18} />}
      </Button>

      <div
        className={`fixed top-16 bottom-0 ${isSystemPage ? 'right-0 left-auto border-l border-r-0' : 'left-0 border-r'} w-80 max-w-[calc(100vw-3rem)] bg-background border-border shadow-2xl z-40 transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : isSystemPage ? 'translate-x-full' : '-translate-x-full'}`}
        style={isSystemPage ? { width: 'min(20rem, calc(100vw - 3rem))' } : undefined}
      >
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-2">
            <Dices size={20} className="text-primary" />
            <h3 className="font-bold">Histórico de Rolagens</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={clearHistory} title="Limpar Histórico">
            <Trash2 size={16} />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-10">
                  Nenhuma rolagem feita ainda.
                </div>
              ) : (
                history.map(roll => (
                  <motion.div
                    key={roll.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`bg-card border rounded-lg p-3 shadow-sm ${roll.isCrit ? 'border-yellow-500/60' : 'border-border'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-xs text-muted-foreground">
                        {new Date(roll.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="font-bold text-xs text-primary">{roll.pokemonName}</div>
                    </div>

                    <div className="font-medium text-sm mb-2">{roll.actionName}</div>

                    {/* Attack test */}
                    <div className="flex justify-between items-center bg-secondary/30 rounded p-2 mb-1">
                      <div className="text-xs font-mono text-muted-foreground">{roll.notation}</div>
                      <div className="text-xl font-bold text-primary">{roll.total}</div>
                    </div>
                    <div className="text-xs text-muted-foreground break-all mb-2">
                      [{roll.diceResults.join(', ')}] → {roll.keptResult}
                      {roll.bonus !== 0 && <span> {roll.bonus > 0 ? '+' : ''}{roll.bonus}</span>}
                    </div>

                    {/* Damage roll (if present) */}
                    {roll.damageNotation && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="flex justify-between items-center bg-orange-500/10 border border-orange-500/30 rounded p-2 mb-1">
                          <div className="text-xs font-mono text-muted-foreground">{roll.damageNotation}</div>
                          <div className="text-xl font-bold text-orange-400">{roll.damageTotal}</div>
                        </div>
                        {roll.damageResults && (
                          <div className="text-xs text-muted-foreground break-all">
                            Dano: [{roll.damageResults.join(', ')}] = {roll.damageTotal}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1 mt-2">
                      {roll.isCrit && (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">CRÍTICO!</Badge>
                      )}
                      {roll.isStab && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 border-primary/50 text-primary">STAB</Badge>
                      )}
                      {roll.statusEffects?.map((status, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1 py-0 h-4">{status}</Badge>
                      ))}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
