import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

function selectors(css) {
  const result=[];
  postcss.parse(css).walkRules(rule=>{
    let parent=rule.parent;
    while(parent) { if(parent.type==='atrule' && /keyframes$/i.test(parent.name))return; parent=parent.parent; }
    result.push(rule.selector);
  });
  return result;
}
test('every upstream CSS selector is scoped to Task Genius, including modal subjects and pseudo-elements',()=>{
  const directory='src/integrations/habits/';
  const original=selectors(fs.readFileSync(directory+'upstream.css','utf8'));
  const scoped=selectors(fs.readFileSync(directory+'scoped.css','utf8'));
  assert.equal(scoped.length,original.length);
  for(const selector of scoped) {
    selectorParser(root=>root.each(subject=>{
      assert.ok(subject.nodes.some(node=>node.type==='pseudo'&&node.value===':where'&&node.toString().includes('.tg-habits-surface')),selector);
      const pseudoElement=subject.nodes.findIndex(node=>node.type==='pseudo'&&node.value.startsWith('::'));
      const scope=subject.nodes.findIndex(node=>node.type==='pseudo'&&node.value===':where');
      if(pseudoElement>=0)assert.ok(scope<pseudoElement,selector);
    })).processSync(selector);
  }
});
