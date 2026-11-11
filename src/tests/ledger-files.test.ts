import { describe, expect, it } from 'vitest';

import { descendantIds, fileProblem, folderNameProblem, folderPath } from '../lib/ledger/files-rules';

const folders = new Map([
  ['root', { parentId: null, name: 'contabilidade-apostolado' }],
  ['hot', { parentId: 'root', name: 'FT-HOTEIS-REST' }],
  ['y27', { parentId: 'hot', name: '2027' }],
]);

describe('accounting folders', () => {
  it('reads a folder path from the top down', () => {
    expect(folderPath(folders, 'y27')).toEqual(['contabilidade-apostolado', 'FT-HOTEIS-REST', '2027']);
    expect(folderPath(folders, null)).toEqual([]);
  });

  it('stops on a loop instead of hanging', () => {
    const loop = new Map([['a', { parentId: 'b', name: 'A' }], ['b', { parentId: 'a', name: 'B' }]]);
    expect(folderPath(loop, 'a')).toEqual(['B', 'A']);
  });

  it('never offers a folder, or anything inside it, as its own destination', () => {
    const list = [...folders.entries()].map(([id, folder]) => ({ id, parentId: folder.parentId }));
    expect([...descendantIds(list, 'hot')].sort()).toEqual(['hot', 'y27']);
    expect(descendantIds(list, 'y27')).toEqual(new Set(['y27']));
  });

  it('words folder name problems for the admin', () => {
    expect(folderNameProblem('  ')).toBe('Dê um nome à pasta.');
    expect(folderNameProblem('a/b')).toMatch(/não pode ter/);
    expect(folderNameProblem('x'.repeat(121))).toMatch(/demasiado longo/);
    expect(folderNameProblem('Hotéis 2027')).toBeNull();
  });

  it('says what a file still needs', () => {
    expect(fileProblem(0)).toBe('Falta ligar a um movimento do banco');
    expect(fileProblem(2)).toBeNull();
  });
});
