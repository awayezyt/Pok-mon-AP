import type { GMPlanningNode } from './campaign';

export function sanitizePlanningHtml(value: string): string {
  if (!value) return '';
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const allowedTags = new Set([
    'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H2', 'H3', 'I',
    'LI', 'OL', 'P', 'S', 'SPAN', 'STRONG', 'U', 'UL',
  ]);

  const sanitizeNode = (node: Node): void => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        if (child.nodeType !== Node.TEXT_NODE) child.remove();
        return;
      }

      const element = child as HTMLElement;
      if (!allowedTags.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        return;
      }

      [...element.attributes].forEach(attribute => {
        if (element.tagName === 'A' && attribute.name === 'href') {
          try {
            const url = new URL(attribute.value, window.location.origin);
            if (url.protocol === 'https:' || url.protocol === 'http:') return;
          } catch {
            // Invalid links are removed below.
          }
        }
        if (element.tagName === 'A' && attribute.name === 'target' && attribute.value === '_blank') return;
        if (attribute.name === 'style' && element.tagName === 'SPAN') {
          const color = /(?:^|;)\s*color:\s*(#[\da-f]{3,8}|rgb\(\s*[\d.,%\s]+\)|[a-z]{3,20})\s*(?:;|$)/i.exec(attribute.value)?.[1];
          if (color) {
            element.setAttribute('style', `color: ${color}`);
            return;
          }
        }
        element.removeAttribute(attribute.name);
      });

      if (element.tagName === 'A') {
        element.setAttribute('rel', 'noopener noreferrer');
        if (!element.hasAttribute('href')) element.replaceWith(...element.childNodes);
      }
      sanitizeNode(element);
    });
  };

  sanitizeNode(parsed.body);
  return parsed.body.innerHTML;
}

export function textAsPlanningHtml(value: string): string {
  const escaped = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  return escaped.split(/\r?\n/).map(line => `<div>${line || '<br>'}</div>`).join('');
}

export function snapPlanningNodePosition(
  node: GMPlanningNode,
  nodes: GMPlanningNode[],
  zoom: number,
  enabled: boolean,
): { x: number; y: number } {
  if (!enabled) return { x: Math.round(node.x), y: Math.round(node.y) };
  const step = 32;
  const threshold = 16 / Math.max(zoom, 0.4);
  const width = node.width || 252;
  const height = node.height || 172;
  const peers = nodes.filter(candidate => candidate.id !== node.id);
  const centersX = peers.map(peer => peer.x + (peer.width || 252) / 2);
  const centersY = peers.map(peer => peer.y + (peer.height || 172) / 2);
  const gapsX: number[] = [];
  const gapsY: number[] = [];

  for (let first = 0; first < peers.length; first += 1) {
    for (let second = first + 1; second < peers.length; second += 1) {
      const gapX = Math.abs(centersX[first] - centersX[second]);
      const gapY = Math.abs(centersY[first] - centersY[second]);
      if (gapX > 24 && gapX < 1800) gapsX.push(gapX);
      if (gapY > 24 && gapY < 1800) gapsY.push(gapY);
    }
  }

  const xTargets = [Math.round(node.x / step) * step];
  const yTargets = [Math.round(node.y / step) * step];
  peers.forEach(peer => {
    const peerWidth = peer.width || 252;
    const peerHeight = peer.height || 172;
    xTargets.push(
      peer.x,
      peer.x + peerWidth - width,
      peer.x + peerWidth / 2 - width / 2,
    );
    yTargets.push(
      peer.y,
      peer.y + peerHeight - height,
      peer.y + peerHeight / 2 - height / 2,
    );
  });
  centersX.forEach(center => gapsX.forEach(gap => {
    xTargets.push(center + gap - width / 2, center - gap - width / 2);
  }));
  centersY.forEach(center => gapsY.forEach(gap => {
    yTargets.push(center + gap - height / 2, center - gap - height / 2);
  }));

  const nearest = (value: number, targets: number[]) => targets.reduce(
    (best, target) => Math.abs(target - value) < Math.abs(best - value) ? target : best,
    value,
  );
  const snapX = nearest(node.x, xTargets);
  const snapY = nearest(node.y, yTargets);
  return {
    x: Math.round(Math.abs(snapX - node.x) <= threshold ? snapX : node.x),
    y: Math.round(Math.abs(snapY - node.y) <= threshold ? snapY : node.y),
  };
}
